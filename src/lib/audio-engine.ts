/**
 * SyncAudioEngine — sample-accurate scheduled playback with drift correction.
 *
 * Primary path: Web Audio API. Tracks are fetched + decoded into an
 * AudioBuffer, and playback is scheduled with
 * `source.start(contextTimeFor(executeAt), offset)` so that the first sample
 * hits the speaker at the agreed server instant regardless of JS jitter.
 *
 * Fallback path: HTMLAudioElement (used if fetch/decode fails, e.g. a remote
 * URL without CORS headers). Less precise, but the same drift loop corrects it.
 *
 * Time domains
 *  - local wall clock (Date.now)       → used by the sync protocol
 *  - AudioContext time (ctx.currentTime) → used for scheduling
 *  - "heard" context time               → ctx time of the sample currently
 *    leaving the speaker (accounts for output latency); derived from
 *    getOutputTimestamp() when available.
 */

export type EngineMode = "webaudio" | "element";

export interface ScheduleRequest {
  /** Track position (s) that must be audible at `executeAtLocalMs`. */
  positionSec: number;
  /** Local wall-clock ms (Date.now domain) of the agreed start instant. */
  executeAtLocalMs: number;
}

export interface DriftReport {
  driftMs: number;
  rate: number;
  action: "none" | "nudge" | "seek" | "idle";
}

const SYNC_TOLERANCE_S = 0.03; // ≤30ms: in sync
const HARD_SEEK_S = 0.15; // >150ms: jump
const MIN_RATE = 0.97;
const MAX_RATE = 1.03;
const CORRECTION_HORIZON_S = 2; // remove nudge-band drift over ~one tick
const FADE_S = 0.012;
const SETTLE_MS = 400; // ignore drift readings right after (re)starting

interface Anchor {
  /** Context time (scheduling domain) of the anchor point. */
  ctxTime: number;
  /** Track position at ctxTime. */
  trackPos: number;
  rate: number;
}

export class SyncAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private sourceGain: GainNode | null = null;
  private anchor: Anchor | null = null;
  private element: HTMLAudioElement | null = null;
  private elementTimer: ReturnType<typeof setTimeout> | null = null;
  private schedule: ScheduleRequest | null = null;
  private lastStartWall = 0;
  private volume = 0.9;
  private muted = false;

  mode: EngineMode = "webaudio";
  url: string | null = null;
  duration = 0;
  unlocked = false;
  rate = 1;

  /* --------------------------- lifecycle --------------------------- */

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.analyserNode = analyser;
    return ctx;
  }

  /**
   * MUST be called from a direct user gesture (click/touchend). Resumes the
   * context, plays an inaudible buffer and primes the <audio> fallback so iOS
   * / Android treat this page as user-activated for audio.
   */
  async unlock(): Promise<boolean> {
    try {
      // iOS 16.4+: route Web Audio through the "playback" session so the
      // ring/silent switch doesn't mute it.
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) {
        try {
          nav.audioSession.type = "playback";
        } catch {
          /* ignore */
        }
      }

      const ctx = this.ensureContext();

      // Synchronously trigger silent buffer in user gesture
      try {
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        /* ignore */
      }

      // Resume context with timeout safety (never hang indefinitely)
      if (ctx.state !== "running") {
        await Promise.race([
          ctx.resume(),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]).catch(() => {});
      }

      this.unlocked = true;
      return true;
    } catch (err) {
      console.warn("[SyncBeat] Unlock fallback:", err);
      this.unlocked = true;
      return true;
    }
  }

  get contextState(): AudioContextState | "uninitialised" {
    return this.ctx?.state ?? "uninitialised";
  }

  get analyser(): AnalyserNode | null {
    return this.mode === "webaudio" ? this.analyserNode : null;
  }

  get outputLatencyMs(): number {
    if (!this.ctx) return 0;
    return ((this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)) * 1000;
  }

  get isPlaying(): boolean {
    return this.schedule !== null;
  }

  private ensureElement(): HTMLAudioElement {
    if (!this.element) {
      const el = new Audio();
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      el.setAttribute("playsinline", "true");
      el.volume = this.muted ? 0 : this.volume;
      this.element = el;
    }
    return this.element;
  }

  /* ----------------------------- loading ---------------------------- */

  private decode(url: string): Promise<AudioBuffer> {
    let p = this.buffers.get(url);
    if (!p) {
      const ctx = this.ensureContext();
      p = fetch(url, { mode: "cors" })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(
          (data) =>
            new Promise<AudioBuffer>((resolve, reject) =>
              // callback form for older Safari
              ctx.decodeAudioData(data, resolve, reject),
            ),
        );
      p.catch(() => this.buffers.delete(url));
      this.buffers.set(url, p);
    }
    return p;
  }

  /** Fetch + decode (or fall back to streaming element). Idempotent per URL. */
  async load(url: string): Promise<{ mode: EngineMode; duration: number }> {
    if (this.url === url && (this.buffer || this.mode === "element")) {
      return { mode: this.mode, duration: this.duration };
    }
    this.stop();
    this.url = url;
    this.buffer = null;
    try {
      const buffer = await this.decode(url);
      if (this.url !== url) throw new Error("superseded");
      this.buffer = buffer;
      this.mode = "webaudio";
      this.duration = buffer.duration;
    } catch (err) {
      if ((err as Error).message === "superseded") throw err;
      console.warn("[SyncBeat] Web Audio decode failed, using <audio> fallback", err);
      this.mode = "element";
      this.duration = await this.loadElement(url);
    }

    if (this.pendingSchedule) {
      const p = this.pendingSchedule;
      this.pendingSchedule = null;
      this.play(p);
    }

    return { mode: this.mode, duration: this.duration };
  }

  private loadElement(url: string): Promise<number> {
    const el = this.ensureElement();
    return new Promise((resolve, reject) => {
      const done = () => {
        cleanup();
        resolve(Number.isFinite(el.duration) ? el.duration : 0);
      };
      const fail = () => {
        cleanup();
        reject(new Error("Unable to load audio source"));
      };
      const cleanup = () => {
        el.removeEventListener("canplaythrough", done);
        el.removeEventListener("error", fail);
      };
      el.addEventListener("canplaythrough", done, { once: true });
      el.addEventListener("error", fail, { once: true });
      // Retry without CORS if the server doesn't send ACAO headers.
      el.crossOrigin = null;
      el.src = url;
      el.load();
    });
  }

  /* ---------------------------- time maps --------------------------- */

  /** Map a local wall-clock instant to the ctx time at which it is *heard*. */
  private ctxTimeForLocalMs(localMs: number): number {
    const ctx = this.ctx!;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      const perfTarget = performance.now() + (localMs - Date.now());
      return ts.contextTime + (perfTarget - ts.performanceTime) / 1000;
    }
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return ctx.currentTime + (localMs - Date.now()) / 1000 - latency;
  }

  /** Track position currently leaving the speaker. */
  currentPosition(): number | null {
    if (!this.schedule) return null;
    if (this.mode === "element") return this.element?.currentTime ?? null;
    if (!this.anchor || !this.ctx) return null;
    const heard = this.ctxTimeForLocalMs(Date.now());
    return this.anchor.trackPos + (heard - this.anchor.ctxTime) * this.anchor.rate;
  }

  /** Position the master timeline says should be audible right now. */
  expectedPosition(): number | null {
    if (!this.schedule) return null;
    return this.schedule.positionSec + (Date.now() - this.schedule.executeAtLocalMs) / 1000;
  }

  /* ---------------------------- transport --------------------------- */

  private pendingSchedule: ScheduleRequest | null = null;

  /** Schedule playback so `positionSec` is audible at `executeAtLocalMs`. */
  play(req: ScheduleRequest): void {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    this.schedule = req;
    this.lastStartWall = Math.max(Date.now(), req.executeAtLocalMs);
    this.rate = 1;

    // If buffer is still loading, queue it to play as soon as decode finishes
    if (this.mode === "webaudio") {
      if (!this.buffer) {
        this.pendingSchedule = req;
        // Also fallback to element immediately if buffer takes more than 1s
        setTimeout(() => {
          if (this.schedule === req && !this.source && this.url) {
            console.log("[SyncBeat] Buffer decode taking time, engaging <audio> playback");
            this.startElement(req);
          }
        }, 800);
        return;
      }
      this.startBuffer(req);
    } else {
      this.startElement(req);
    }
  }

  private startBuffer(req: ScheduleRequest) {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    if (!this.buffer || !this.master) {
      if (this.url) this.startElement(req);
      return;
    }
    this.fadeOutSource();

    const leadIn = 0.02;
    let when = this.ctxTimeForLocalMs(req.executeAtLocalMs);
    let offset = req.positionSec;
    const earliest = ctx.currentTime + leadIn;
    if (when < earliest) {
      // Late joiner / late command: start mid-track at the right spot.
      offset += earliest - when;
      when = earliest;
    }
    if (offset < 0) {
      // positionSec < 0 is never written, but guard anyway.
      when += -offset;
      offset = 0;
    }
    if (offset >= this.buffer.duration) {
      this.schedule = null;
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + FADE_S);
    src.connect(g).connect(this.master);
    src.start(when, offset);
    src.onended = () => {
      if (this.source === src) {
        this.source = null;
        this.anchor = null;
        this.schedule = null;
      }
    };
    this.source = src;
    this.sourceGain = g;
    this.anchor = { ctxTime: when, trackPos: offset, rate: 1 };
  }

  private startElement(req: ScheduleRequest) {
    const el = this.ensureElement();
    if (this.elementTimer) clearTimeout(this.elementTimer);
    el.playbackRate = 1;
    const delay = req.executeAtLocalMs - Date.now();
    if (delay > 0) {
      el.pause();
      el.currentTime = req.positionSec;
      this.elementTimer = setTimeout(() => {
        void el.play().catch(() => undefined);
      }, delay);
    } else {
      el.currentTime = req.positionSec - delay / 1000;
      void el.play().catch(() => undefined);
    }
  }

  private fadeOutSource() {
    const ctx = this.ctx;
    const src = this.source;
    const g = this.sourceGain;
    this.source = null;
    this.sourceGain = null;
    this.anchor = null;
    if (!ctx || !src || !g) return;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + FADE_S);
    try {
      src.stop(t + FADE_S + 0.005);
    } catch {
      /* already stopped */
    }
  }

  stop(): void {
    this.schedule = null;
    this.rate = 1;
    this.fadeOutSource();
    if (this.elementTimer) clearTimeout(this.elementTimer);
    if (this.element && !this.element.paused) this.element.pause();
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyGain();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  private applyGain() {
    const v = this.muted ? 0 : this.volume;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
    if (this.element) this.element.volume = v;
  }

  /* ------------------------- drift correction ------------------------ */

  private setRate(rate: number) {
    if (Math.abs(rate - this.rate) < 0.0005) return;
    this.rate = rate;
    if (this.mode === "element") {
      if (this.element) this.element.playbackRate = rate;
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.source || !this.anchor) return;
    // Re-anchor at the scheduling frontier so position math stays exact.
    const t = ctx.currentTime;
    if (t > this.anchor.ctxTime) {
      this.anchor = {
        ctxTime: t,
        trackPos: this.anchor.trackPos + (t - this.anchor.ctxTime) * this.anchor.rate,
        rate,
      };
    } else {
      this.anchor = { ...this.anchor, rate };
    }
    this.source.playbackRate.setValueAtTime(rate, Math.max(t, this.anchor.ctxTime));
  }

  /**
   * Compare the audible position with the master timeline and correct:
   *  |drift| ≤ 30ms        → leave it (rate 1.0)
   *  30ms < |drift| ≤ 150ms → nudge playbackRate within 0.97–1.03
   *  |drift| > 150ms        → hard re-seek (with micro-crossfade)
   */
  correctDrift(): DriftReport {
    const actual = this.currentPosition();
    const expected = this.expectedPosition();
    if (actual === null || expected === null || !this.schedule) {
      return { driftMs: 0, rate: this.rate, action: "idle" };
    }
    if (Date.now() - this.lastStartWall < SETTLE_MS || expected < 0) {
      return { driftMs: (actual - expected) * 1000, rate: this.rate, action: "idle" };
    }
    if (this.mode === "element" && this.element?.paused) {
      return { driftMs: 0, rate: this.rate, action: "idle" };
    }

    const drift = actual - expected; // + ahead, − behind
    const abs = Math.abs(drift);

    if (abs > HARD_SEEK_S) {
      this.play(this.schedule);
      return { driftMs: drift * 1000, rate: 1, action: "seek" };
    }
    if (abs > SYNC_TOLERANCE_S) {
      const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, 1 - drift / CORRECTION_HORIZON_S));
      this.setRate(rate);
      return { driftMs: drift * 1000, rate, action: "nudge" };
    }
    this.setRate(1);
    return { driftMs: drift * 1000, rate: 1, action: "none" };
  }

  dispose() {
    this.stop();
    this.element?.removeAttribute("src");
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
