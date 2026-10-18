import {
  get,
  onValue,
  ref,
  serverTimestamp,
  set,
  type Database,
  type Unsubscribe,
} from "firebase/database";

/**
 * NTP-style clock synchronisation against the Firebase RTDB server clock.
 *
 *   offsetMs = serverTime − localTime
 *   serverNow()        = Date.now() + offsetMs
 *   toLocalTime(S)     = S − offsetMs
 *
 * Two sources are combined:
 *  1. `.info/serverTimeOffset` — Firebase's own estimate, available instantly
 *     after connecting, but only measured once per connection (±RTT/2 error).
 *  2. Ping-pong probes — we write `ServerValue.TIMESTAMP` to
 *     `/clockProbes/$uid`, time the round trip with `performance.now()`, read
 *     back the server-stamped value and assume it was applied at the RTT
 *     midpoint (classic Cristian/NTP). We keep the lowest-RTT samples since
 *     they carry the least asymmetric queuing error.
 */

export interface ClockSample {
  rttMs: number;
  offsetMs: number;
}

export interface ClockSnapshot {
  offsetMs: number;
  /** Average round-trip time of the last calibration (ms). */
  rttMs: number;
  /** Estimated one-way network latency (avg RTT / 2). */
  latencyMs: number;
  /** Estimated ± uncertainty of the offset (best RTT / 2). */
  uncertaintyMs: number;
  source: "none" | "rtdb-info" | "ping-pong";
  calibratedAt: number;
  samples: ClockSample[];
}

type Listener = (s: ClockSnapshot) => void;

const SAMPLE_COUNT = 5;
const RECALIBRATE_MS = 45_000;

export class ClockSync {
  private snapshot: ClockSnapshot = {
    offsetMs: 0,
    rttMs: 0,
    latencyMs: 0,
    uncertaintyMs: Infinity,
    source: "none",
    calibratedAt: 0,
    samples: [],
  };
  private listeners = new Set<Listener>();
  private unsubInfo?: Unsubscribe;
  private timer?: ReturnType<typeof setInterval>;
  private calibrating?: Promise<ClockSnapshot>;

  constructor(
    private readonly db: Database,
    private readonly uid: string,
  ) {}

  /* ------------------------------------------------------------------ */

  get offsetMs() {
    return this.snapshot.offsetMs;
  }

  get state(): ClockSnapshot {
    return this.snapshot;
  }

  serverNow(): number {
    return Date.now() + this.snapshot.offsetMs;
  }

  toLocalTime(serverMs: number): number {
    return serverMs - this.snapshot.offsetMs;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  /* ------------------------------------------------------------------ */

  start(): void {
    if (this.unsubInfo) return;
    this.unsubInfo = onValue(ref(this.db, ".info/serverTimeOffset"), (snap) => {
      const infoOffset = Number(snap.val()) || 0;
      // Only use the SDK estimate until our own probes have run.
      if (this.snapshot.source !== "ping-pong") {
        this.publish({ ...this.snapshot, offsetMs: infoOffset, source: "rtdb-info" });
      }
    });
    void this.calibrate();
    this.timer = setInterval(() => void this.calibrate(), RECALIBRATE_MS);
  }

  stop(): void {
    this.unsubInfo?.();
    this.unsubInfo = undefined;
    if (this.timer) clearInterval(this.timer);
    this.listeners.clear();
  }

  /** Run (or join an in-flight) 5-sample ping-pong calibration. */
  calibrate(): Promise<ClockSnapshot> {
    if (!this.calibrating) {
      this.calibrating = this.runCalibration().finally(() => {
        this.calibrating = undefined;
      });
    }
    return this.calibrating;
  }

  private async probeOnce(): Promise<ClockSample> {
    const probeRef = ref(this.db, `clockProbes/${this.uid}`);
    const perf0 = performance.now();
    const wall0 = Date.now();
    await set(probeRef, serverTimestamp());
    const rttMs = performance.now() - perf0;
    // The server stamped the value while handling our write; read it back.
    const serverMs = Number((await get(probeRef)).val());
    const localMidpoint = wall0 + rttMs / 2;
    return { rttMs, offsetMs: serverMs - localMidpoint };
  }

  private async runCalibration(): Promise<ClockSnapshot> {
    try {
      // Warm-up probe absorbs connection / TLS / cold-path latency.
      await this.probeOnce();
      const samples: ClockSample[] = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        samples.push(await this.probeOnce());
        await new Promise((r) => setTimeout(r, 40));
      }
      const avgRtt = samples.reduce((a, s) => a + s.rttMs, 0) / samples.length;
      // Keep the 3 fastest samples: lowest RTT ⇒ least asymmetric delay.
      const best = [...samples].sort((a, b) => a.rttMs - b.rttMs).slice(0, 3);
      const offsetMs = best.reduce((a, s) => a + s.offsetMs, 0) / best.length;

      this.publish({
        offsetMs,
        rttMs: avgRtt,
        latencyMs: avgRtt / 2,
        uncertaintyMs: best[0].rttMs / 2,
        source: "ping-pong",
        calibratedAt: Date.now(),
        samples,
      });
    } catch (err) {
      console.warn("[SyncBeat] clock calibration failed, using RTDB estimate", err);
    }
    return this.snapshot;
  }

  private publish(next: ClockSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((fn) => fn(next));
  }
}
