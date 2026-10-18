/**
 * Procedurally synthesises the bundled SyncBeat demo tracks as WAV files.
 *
 * Why generated audio? It is royalty free, same-origin (no CORS headaches for
 * `decodeAudioData`) and the transient-heavy material (clicks, kicks, hats)
 * makes inter-device drift immediately audible when testing sync.
 *
 * Usage: node scripts/generate-tracks.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 32000;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
mkdirSync(OUT, { recursive: true });

/* ---------- deterministic noise ---------- */
let seed = 1337;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;

/* ---------- note helpers ---------- */
const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const hz = (name) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
};

/* ---------- voices ---------- */
function makeTrack(seconds) {
  const buf = new Float32Array(Math.ceil(seconds * SR));
  const at = (t) => Math.floor(t * SR);

  const voice = {
    buf,
    click(t, freq, gain = 0.8) {
      const s = at(t), n = at(0.03);
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        buf[s + i] += Math.sin(2 * Math.PI * freq * x) * Math.exp(-x * 160) * gain;
      }
    },
    kick(t, gain = 1) {
      const s = at(t), n = at(0.45);
      let phase = 0;
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        const f = 45 + 110 * Math.exp(-x * 28);
        phase += (2 * Math.PI * f) / SR;
        const click = i < 40 ? noise() * 0.25 * (1 - i / 40) : 0;
        buf[s + i] += (Math.sin(phase) * Math.exp(-x * 7) + click) * gain;
      }
    },
    snare(t, gain = 0.55) {
      const s = at(t), n = at(0.3);
      let lp = 0;
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        const nz = noise();
        lp += 0.5 * (nz - lp);
        const body = Math.sin(2 * Math.PI * 185 * x) * Math.exp(-x * 30) * 0.6;
        buf[s + i] += ((nz - lp) * Math.exp(-x * 16) + body) * gain;
      }
    },
    rim(t, gain = 0.35) {
      const s = at(t), n = at(0.06);
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        buf[s + i] += (Math.sin(2 * Math.PI * 1700 * x) * 0.6 + noise() * 0.4) * Math.exp(-x * 90) * gain;
      }
    },
    hat(t, open = false, gain = 0.18) {
      const s = at(t), n = at(open ? 0.22 : 0.05);
      let prev = 0;
      const decay = open ? 14 : 70;
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        const nz = noise();
        const hp = nz - prev; // crude high-pass
        prev = nz;
        buf[s + i] += hp * Math.exp(-x * decay) * gain;
      }
    },
    saw(t, freq, dur, { gain = 0.25, cutoff = 0.12, attack = 0.005, release = 0.08, detune = 0 } = {}) {
      const s = at(t), n = at(dur + release);
      let lp = 0, lp2 = 0;
      const phases = detune ? [0, 0.33, 0.66] : [0];
      const ratios = detune ? [1, 1 + detune, 1 - detune] : [1];
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        let v = 0;
        for (let k = 0; k < phases.length; k++) {
          phases[k] = (phases[k] + (freq * ratios[k]) / SR) % 1;
          v += phases[k] * 2 - 1;
        }
        v /= phases.length;
        lp += cutoff * (v - lp);
        lp2 += cutoff * (lp - lp2);
        let env = Math.min(1, x / attack);
        if (x > dur) env *= Math.max(0, 1 - (x - dur) / release);
        buf[s + i] += lp2 * env * gain;
      }
    },
    keys(t, freq, dur, gain = 0.16) {
      // Rhodes-ish: sine + soft 2nd harmonic, bell attack, tremolo.
      const s = at(t), n = at(dur + 0.4);
      for (let i = 0; i < n && s + i < buf.length; i++) {
        const x = i / SR;
        const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * 4.5 * x);
        const bell = Math.sin(2 * Math.PI * freq * 4 * x) * Math.exp(-x * 18) * 0.25;
        const tone = Math.sin(2 * Math.PI * freq * x) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * x) * Math.exp(-x * 3);
        let env = Math.min(1, x / 0.004) * Math.exp(-x * 1.4);
        if (x > dur) env *= Math.max(0, 1 - (x - dur) / 0.4);
        buf[s + i] += (tone + bell) * env * trem * gain;
      }
    },
    vinyl(gain = 0.012) {
      let lp = 0;
      for (let i = 0; i < buf.length; i++) {
        lp += 0.08 * (noise() - lp);
        buf[i] += lp * gain + (rand() < 0.00012 ? noise() * 0.25 : 0);
      }
    },
  };
  return voice;
}

/* ---------- WAV writer (16-bit PCM mono) ---------- */
function writeWav(name, buf) {
  // Normalise + gentle tanh soft-clip
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const norm = peak > 0 ? 0.95 / peak : 1;
  const fadeN = Math.floor(0.02 * SR);
  const pcm = Buffer.alloc(44 + buf.length * 2);
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(36 + buf.length * 2, 4);
  pcm.write("WAVE", 8);
  pcm.write("fmt ", 12);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36);
  pcm.writeUInt32LE(buf.length * 2, 40);
  for (let i = 0; i < buf.length; i++) {
    let v = Math.tanh(buf[i] * norm * 1.1) / Math.tanh(1.1);
    if (i < fadeN) v *= i / fadeN;
    if (i > buf.length - fadeN) v *= (buf.length - i) / fadeN;
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
  }
  writeFileSync(join(OUT, name), pcm);
  console.log(`  ✓ ${name}  ${(pcm.length / 1024 / 1024).toFixed(2)} MB  ${(buf.length / SR).toFixed(1)}s`);
}

/* =========================================================
 * 1. Calibration Pulse — 120 BPM click track (sync testing)
 * ========================================================= */
{
  const bpm = 120, beats = 120;
  const beat = 60 / bpm;
  const v = makeTrack(beats * beat + 0.5);
  for (let b = 0; b < beats; b++) {
    const t = b * beat;
    v.click(t, b % 4 === 0 ? 1760 : 1100, b % 4 === 0 ? 0.9 : 0.6);
    if (b % 16 === 0) v.kick(t, 0.7);
  }
  writeWav("calibration-pulse.wav", v.buf);
}

/* =========================================================
 * 2. Neon Drive — 118 BPM synthwave (Am – F – C – G)
 * ========================================================= */
{
  const bpm = 118, bars = 32;
  const beat = 60 / bpm, bar = beat * 4, s16 = beat / 4;
  const v = makeTrack(bars * bar + 1.5);
  const prog = [
    { root: "A1", chord: ["A3", "C4", "E4"] },
    { root: "F1", chord: ["F3", "A3", "C4"] },
    { root: "C2", chord: ["G3", "C4", "E4"] },
    { root: "G1", chord: ["G3", "B3", "D4"] },
  ];
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const { root, chord } = prog[Math.floor(b / 2) % 4];
    const intro = b < 4, breakdown = b >= 16 && b < 20;
    // pad
    chord.forEach((n) => v.saw(t0, hz(n), bar - 0.05, { gain: 0.07, cutoff: 0.05, attack: 0.25, release: 0.4, detune: 0.004 }));
    // drums
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      if (!breakdown) v.kick(t, 0.95);
      if (!intro && (q === 1 || q === 3)) v.snare(t);
      for (let h = 0; h < 2; h++) v.hat(t + h * 2 * s16, h === 1 && !intro && !breakdown, 0.14);
    }
    // bass: driving 8th notes with octave jumps
    if (!intro) {
      const f = hz(root);
      for (let e = 0; e < 8; e++) {
        v.saw(t0 + e * 2 * s16, e % 2 ? f * 2 : f, 2 * s16 * 0.8, { gain: 0.32, cutoff: 0.09, release: 0.03 });
      }
    }
    // arpeggio lead
    if (b >= 8 && !breakdown) {
      for (let k = 0; k < 16; k++) {
        const n = chord[k % 3];
        v.saw(t0 + k * s16, hz(n) * 2, s16 * 0.6, { gain: 0.06, cutoff: 0.2, release: 0.06 });
      }
    }
  }
  v.kick(bars * bar, 0.9);
  writeWav("neon-drive.wav", v.buf);
}

/* =========================================================
 * 3. Midnight Lo-Fi — 84 BPM, swung keys (Dm9 – G13 – Cmaj9 – A7)
 * ========================================================= */
{
  const bpm = 84, bars = 20;
  const beat = 60 / bpm, bar = beat * 4;
  const swing = beat * 0.58;
  const v = makeTrack(bars * bar + 2);
  const prog = [
    ["D3", "F3", "A3", "C4", "E4"],
    ["G2", "F3", "B3", "E4"],
    ["C3", "E3", "G3", "B3", "D4"],
    ["A2", "G3", "C#4", "E4"],
  ];
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const chord = prog[b % 4];
    chord.forEach((n, i) => v.keys(t0 + i * 0.012, hz(n), bar * 0.9, 0.1));
    v.saw(t0, hz(chord[0]) / 2, beat * 2.5, { gain: 0.3, cutoff: 0.04, release: 0.2 });
    v.saw(t0 + beat * 2.5, hz(chord[0]) / 2, beat * 1.2, { gain: 0.25, cutoff: 0.04, release: 0.2 });
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      if (q === 0 || (q === 2 && b % 2)) v.kick(t, 0.85);
      if (q === 2 && b % 2 === 0) v.kick(t + swing, 0.6);
      if (q === 1 || q === 3) v.rim(t, 0.4);
      v.hat(t, false, 0.1);
      v.hat(t + swing, false, 0.06);
    }
  }
  v.vinyl();
  writeWav("midnight-lofi.wav", v.buf);
}

console.log("Done → public/audio");
