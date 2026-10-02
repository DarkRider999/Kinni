// Offline BPM and musical-key detection, running entirely in the browser.
//
// This is a JS port of dj-nexus-pro/engine/src/core/analysis.cpp (the engine's
// native, unit-tested analyzer) rather than a separate algorithm: the compiled
// djnexus.wasm this app loads predates that native module, so it can't be
// called directly here. If djnexus.wasm is ever rebuilt from the current
// engine sources, djn_analyze_pcm should replace this file. Keep the two
// implementations in sync until then.
import { camelotOf, wrap12 } from "./camelot";

export interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  firstBeatSec: number;
  keyPitchClass: number; // -1 = unknown
  keyIsMinor: boolean;
  keyConfidence: number;
  camelot: string;
}

const MIN_BPM = 60;
const MAX_BPM = 200;
const ONSET_HOP = 256;
const ONSET_FFT = 1024;
const KEY_FRAME = 4096;
const KEY_HOP = 2048;
const KEY_MIN_HZ = 80;
const KEY_MAX_HZ = 5000;
// Shorter than the native engine's 120s cap, to keep in-browser import snappy;
// a track's key rarely changes enough in the first minute to matter here.
const KEY_MAX_ANALYSIS_SEC = 60;

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i];
    out[i] = sum / channels.length;
  }
  return out;
}

// Spectral flux: half-wave-rectified frame-to-frame increase in magnitude,
// summed across frequency bins. See analysis.cpp's onsetNovelty() for why
// this replaced a plain energy-diff novelty curve: a sustained chord's own
// beating can out-correlate the actual drum hits under a simple energy
// measure, while spectral flux (energy appearing in a bin that didn't have
// it a moment ago) stays locked on percussive transients under a full mix.
function onsetNovelty(mono: Float32Array): Float64Array {
  if (mono.length < ONSET_FFT + ONSET_HOP) return new Float64Array(0);
  const window = new Float64Array(ONSET_FFT);
  for (let i = 0; i < ONSET_FFT; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (ONSET_FFT - 1));

  const numFrames = Math.floor((mono.length - ONSET_FFT) / ONSET_HOP) + 1;
  const novelty = new Float64Array(numFrames);
  const prevMag = new Float64Array(ONSET_FFT / 2);
  const re = new Float64Array(ONSET_FFT);
  const im = new Float64Array(ONSET_FFT);
  for (let f = 0; f < numFrames; f++) {
    const start = f * ONSET_HOP;
    im.fill(0);
    for (let i = 0; i < ONSET_FFT; i++) re[i] = mono[start + i] * window[i];
    fft(re, im);
    let flux = 0;
    for (let bin = 1; bin < ONSET_FFT / 2; bin++) {
      const mag = Math.hypot(re[bin], im[bin]);
      flux += Math.max(0, mag - prevMag[bin]);
      prevMag[bin] = mag;
    }
    novelty[f] = flux;
  }
  return novelty;
}

interface TempoEstimate {
  bpm: number;
  confidence: number;
  firstBeatSec: number;
}

function estimateTempo(novelty: Float64Array, sampleRate: number): TempoEstimate {
  const none: TempoEstimate = { bpm: 0, confidence: 0, firstBeatSec: 0 };
  if (novelty.length < 8) return none;
  const frameRate = sampleRate / ONSET_HOP;

  const minLag = Math.max(1, Math.floor((frameRate * 60) / MAX_BPM));
  const maxLag = Math.ceil((frameRate * 60) / MIN_BPM);
  if (minLag >= maxLag || maxLag + 1 >= novelty.length) return none;

  const score = new Float64Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let norm = 0;
    const count = novelty.length - lag;
    for (let i = 0; i < count; i++) {
      sum += novelty[i] * novelty[i + lag];
      norm += novelty[i] * novelty[i];
    }
    score[lag] = norm > 1e-12 && count > 0 ? sum / norm : 0;
  }

  // See analysis.cpp's estimateTempo() for why sub-harmonic summation (with a
  // local-max read of each harmonic) is needed to avoid half/double-time
  // octave errors: a perfectly periodic beat scores just as well at every
  // integer multiple of its true period.
  const peakNear = (lag: number): number => {
    if (lag < minLag || lag > maxLag) return 0;
    let m = score[lag];
    if (lag > minLag) m = Math.max(m, score[lag - 1]);
    if (lag < maxLag) m = Math.max(m, score[lag + 1]);
    return m;
  };
  let bestLag = minLag;
  let bestCombined = score[minLag] + 0.5 * peakNear(2 * minLag) + 0.33 * peakNear(3 * minLag);
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    const combined = score[lag] + 0.5 * peakNear(2 * lag) + 0.33 * peakNear(3 * lag);
    if (combined > bestCombined) {
      bestCombined = combined;
      bestLag = lag;
    }
  }
  const maxScore = score[bestLag];
  if (maxScore <= 0) return none;

  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const sL = score[bestLag - 1];
    const sC = score[bestLag];
    const sR = score[bestLag + 1];
    const denom = sL - 2 * sC + sR;
    if (Math.abs(denom) > 1e-12) {
      const delta = (0.5 * (sL - sR)) / denom;
      if (delta > -1 && delta < 1) refinedLag += delta;
    }
  }
  if (refinedLag <= 0) return none;

  const bpm = (frameRate * 60) / refinedLag;
  let meanScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) meanScore += score[lag];
  meanScore /= maxLag - minLag + 1;
  const confidence = Math.min(1, Math.max(0, (maxScore - meanScore) / Math.max(maxScore, 1e-9)));

  const searchEnd = Math.min(novelty.length, Math.max(bestLag, 1));
  let peakFrame = 0;
  let peakVal = -1;
  for (let i = 0; i < searchEnd; i++) {
    if (novelty[i] > peakVal) {
      peakVal = novelty[i];
      peakFrame = i;
    }
  }
  return { bpm, confidence, firstBeatSec: (peakFrame * ONSET_HOP) / sampleRate };
}

// Minimal iterative radix-2 FFT (in place), n must be a power of two.
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * wRe - im[i + k + len / 2] * wIm;
        const vIm = re[i + k + len / 2] * wIm + im[i + k + len / 2] * wRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nwRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nwRe;
      }
    }
  }
}

function computeChroma(mono: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  const maxSamples = Math.min(mono.length, Math.floor(KEY_MAX_ANALYSIS_SEC * sampleRate));
  if (maxSamples < KEY_FRAME) return chroma;

  const n = KEY_FRAME; // already a power of two
  const window = new Float64Array(KEY_FRAME);
  for (let i = 0; i < KEY_FRAME; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (KEY_FRAME - 1));

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const numFrames = Math.floor((maxSamples - KEY_FRAME) / KEY_HOP) + 1;
  for (let f = 0; f < numFrames; f++) {
    const start = f * KEY_HOP;
    im.fill(0);
    for (let i = 0; i < n; i++) re[i] = mono[start + i] * window[i];
    fft(re, im);
    for (let bin = 1; bin < n / 2; bin++) {
      const freq = (bin * sampleRate) / n;
      if (freq < KEY_MIN_HZ || freq > KEY_MAX_HZ) continue;
      const mag = Math.hypot(re[bin], im[bin]);
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = wrap12(Math.round(midi));
      chroma[pc] += mag;
    }
  }
  return chroma;
}

function correlation(a: number[], b: number[]): number {
  const meanA = a.reduce((s, v) => s + v, 0) / 12;
  const meanB = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < 12; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 1e-12 ? num / den : 0;
}

interface KeyEstimate {
  pitchClass: number;
  isMinor: boolean;
  confidence: number;
}

function estimateKey(chroma: number[]): KeyEstimate {
  const none: KeyEstimate = { pitchClass: -1, isMinor: false, confidence: 0 };
  const total = chroma.reduce((s, v) => s + v, 0);
  if (total <= 1e-9) return none;

  let best = -2;
  let pitchClass = -1;
  let isMinor = false;
  for (let rotation = 0; rotation < 12; rotation++) {
    const rotatedMajor = Array.from({ length: 12 }, (_, i) => MAJOR_PROFILE[wrap12(i - rotation)]);
    const rotatedMinor = Array.from({ length: 12 }, (_, i) => MINOR_PROFILE[wrap12(i - rotation)]);
    const cMaj = correlation(chroma, rotatedMajor);
    const cMin = correlation(chroma, rotatedMinor);
    if (cMaj > best) {
      best = cMaj;
      pitchClass = rotation;
      isMinor = false;
    }
    if (cMin > best) {
      best = cMin;
      pitchClass = rotation;
      isMinor = true;
    }
  }
  return { pitchClass, isMinor, confidence: Math.min(1, Math.max(0, best)) };
}

export function analyzeTrack(channels: Float32Array[], sampleRate: number): AnalysisResult {
  const mono = downmix(channels);
  const tempo = estimateTempo(onsetNovelty(mono), sampleRate);
  const key = estimateKey(computeChroma(mono, sampleRate));
  const pos = key.pitchClass >= 0 ? camelotOf(key.pitchClass, key.isMinor) : null;
  return {
    bpm: tempo.bpm,
    bpmConfidence: tempo.confidence,
    firstBeatSec: tempo.firstBeatSec,
    keyPitchClass: key.pitchClass,
    keyIsMinor: key.isMinor,
    keyConfidence: key.confidence,
    camelot: pos ? `${pos.number}${pos.letter}` : "",
  };
}
