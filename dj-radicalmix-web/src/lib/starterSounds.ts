// Procedurally synthesized placeholder one-shots for the sampler pads, so the
// app has something to trigger immediately with no download. These are NOT
// the blueprint's "10,000+ free sampler/plugin library" (docs/dj-radicalmix
// Sec 5) -- that needs real licensed/produced audio content this environment
// has no way to source. They exist to make the sampler screen real and
// playable today; swap in a real content pack later without changing the UI.
export interface StarterSound {
  name: string;
  color: string;
  generate: (sampleRate: number) => Float32Array; // mono
}

function noise(n: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return out;
}

function envelope(buf: Float32Array, attack: number, decay: number, sampleRate: number) {
  const a = Math.floor(attack * sampleRate);
  const d = Math.floor(decay * sampleRate);
  for (let i = 0; i < buf.length; i++) {
    let g = 1;
    if (i < a) g = i / Math.max(1, a);
    else g = Math.exp((-(i - a) * 4) / Math.max(1, d));
    buf[i] *= g;
  }
}

function sine(n: number, freq: number, sampleRate: number, sweepTo?: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = sweepTo !== undefined ? freq + (sweepTo - freq) * (i / n) : freq;
    out[i] = Math.sin((2 * Math.PI * f * i) / sampleRate);
  }
  return out;
}

export const STARTER_SOUNDS: StarterSound[] = [
  {
    name: "Kick",
    color: "#ff1744",
    generate: (sr) => {
      const n = Math.floor(0.3 * sr);
      const buf = sine(n, 150, sr, 40);
      envelope(buf, 0.001, 0.25, sr);
      return buf;
    },
  },
  {
    name: "Clap",
    color: "#7c3aed",
    generate: (sr) => {
      const n = Math.floor(0.25 * sr);
      const buf = noise(n, 7);
      envelope(buf, 0.001, 0.15, sr);
      return buf;
    },
  },
  {
    name: "Closed Hat",
    color: "#00e5ff",
    generate: (sr) => {
      const n = Math.floor(0.08 * sr);
      const buf = noise(n, 13);
      envelope(buf, 0.0005, 0.04, sr);
      return buf;
    },
  },
  {
    name: "Open Hat",
    color: "#00e5ff",
    generate: (sr) => {
      const n = Math.floor(0.4 * sr);
      const buf = noise(n, 17);
      envelope(buf, 0.0005, 0.3, sr);
      return buf;
    },
  },
  {
    name: "Tom",
    color: "#ff1744",
    generate: (sr) => {
      const n = Math.floor(0.35 * sr);
      const buf = sine(n, 220, sr, 90);
      envelope(buf, 0.001, 0.3, sr);
      return buf;
    },
  },
  {
    name: "Riser",
    color: "#7c3aed",
    generate: (sr) => {
      const n = Math.floor(2.0 * sr);
      const tone = sine(n, 200, sr, 2200);
      const hiss = noise(n, 23);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = tone[i] * 0.6 + hiss[i] * 0.2 * (i / n);
      envelope(out, n / sr, 0.05, sr);
      return out;
    },
  },
  {
    name: "Impact",
    color: "#ffb020",
    generate: (sr) => {
      const n = Math.floor(1.0 * sr);
      const tone = sine(n, 80, sr, 30);
      const hiss = noise(n, 29);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = tone[i] * 0.8 + hiss[i] * 0.3 * Math.exp((-i * 6) / n);
      envelope(out, 0.001, 0.7, sr);
      return out;
    },
  },
  {
    name: "Tag Zap",
    color: "#00e5ff",
    generate: (sr) => {
      const n = Math.floor(0.3 * sr);
      const buf = sine(n, 1800, sr, 300);
      envelope(buf, 0.001, 0.2, sr);
      return buf;
    },
  },
];

export function toStereo(mono: Float32Array): [Float32Array, Float32Array] {
  return [mono, mono.slice()];
}
