// Mirrors dj-nexus-pro/engine/tests/test_analysis.cpp -- same fixtures, same
// assertions, verifying the JS port (analysis.ts) matches the native engine's
// tested behavior.
import { describe, expect, it } from "vitest";
import { analyzeTrack } from "./analysis";
import { camelotCode } from "./camelot";

function makeClickTrack(bpm: number, seconds: number, sampleRate: number): Float32Array {
  const buf = new Float32Array(Math.floor(seconds * sampleRate));
  const period = 60 / bpm;
  const clickLen = Math.floor(0.004 * sampleRate);
  for (let t = 0; t < seconds; t += period) {
    const start = Math.floor(t * sampleRate);
    for (let i = 0; i < clickLen && start + i < buf.length; i++) {
      buf[start + i] += Math.exp((-6 * i) / clickLen);
    }
  }
  return buf;
}

function makeKickTrack(bpm: number, seconds: number, sampleRate: number): Float32Array {
  const buf = new Float32Array(Math.floor(seconds * sampleRate));
  const period = 60 / bpm;
  const kickLen = Math.floor(0.05 * sampleRate);
  for (let t = 0; t < seconds; t += period) {
    const start = Math.floor(t * sampleRate);
    for (let i = 0; i < kickLen && start + i < buf.length; i++) {
      buf[start + i] += 0.9 * Math.exp((-30 * i) / kickLen) * Math.sin((2 * Math.PI * 90 * i) / sampleRate);
    }
  }
  return buf;
}

function makeChord(rootHz: number, minorThird: boolean, seconds: number, sampleRate: number): Float32Array {
  const buf = new Float32Array(Math.floor(seconds * sampleRate));
  const thirdRatio = minorThird ? 2 ** (3 / 12) : 2 ** (4 / 12);
  const fifthRatio = 2 ** (7 / 12);
  const freqs = [rootHz, rootHz * thirdRatio, rootHz * fifthRatio];
  for (let i = 0; i < buf.length; i++) {
    let s = 0;
    for (const f of freqs) s += Math.sin((2 * Math.PI * f * i) / sampleRate);
    buf[i] = s / 3;
  }
  return buf;
}

function makeShapedTrack(seconds: number, sampleRate: number): Float32Array {
  const buf = new Float32Array(Math.floor(seconds * sampleRate));
  const introEnd = seconds * 0.2;
  const outroStart = seconds * 0.8;
  const dropAt = seconds * 0.5;
  for (let i = 0; i < buf.length; i++) {
    const t = i / sampleRate;
    let amp: number;
    if (t < introEnd) amp = 0.1;
    else if (t > outroStart) amp = 0.1;
    else if (Math.abs(t - dropAt) < 1.0) amp = 1.0;
    else amp = 0.5;
    buf[i] = amp * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }
  return buf;
}

const SR = 44100;

describe("BPM detection", () => {
  it("finds a clean click track", () => {
    const r = analyzeTrack([makeClickTrack(128, 12, SR)], SR);
    expect(r.bpm).toBeGreaterThan(0);
    expect(Math.abs(r.bpm - 128)).toBeLessThan(2);
    expect(r.bpmConfidence).toBeGreaterThan(0.2);
  });

  it("scales with tempo", () => {
    const slow = analyzeTrack([makeClickTrack(90, 12, SR)], SR);
    const fast = analyzeTrack([makeClickTrack(174, 12, SR)], SR);
    expect(Math.abs(slow.bpm - 90)).toBeLessThan(2);
    expect(Math.abs(fast.bpm - 174)).toBeLessThan(2);
  });

  it("reports nothing on silence", () => {
    const r = analyzeTrack([new Float32Array(5 * SR)], SR);
    expect(r.bpm).toBe(0);
  });

  it("survives a sustained chord under the beat", () => {
    // Regression test: a plain energy-based onset curve locked onto the
    // chord's own beating pattern instead of the kick (128 BPM measured as
    // ~186 BPM) before this was switched to spectral flux. See analysis.ts's
    // onsetNovelty() and dj-nexus-pro/engine's matching test for why.
    const buf = makeKickTrack(128, 15, SR);
    const chord = makeChord(261.63, false, 15, SR);
    for (let i = 0; i < buf.length; i++) buf[i] += 0.15 * chord[i]; // undo makeChord's /3 average
    const r = analyzeTrack([buf], SR);
    expect(Math.abs(r.bpm - 128)).toBeLessThan(2);
  });

  it("downmixes stereo before analysis", () => {
    const mono = makeClickTrack(140, 10, SR);
    const r = analyzeTrack([mono, mono], SR);
    expect(Math.abs(r.bpm - 140)).toBeLessThan(2);
  });
});

describe("key detection", () => {
  it("finds C major", () => {
    const r = analyzeTrack([makeChord(261.63, false, 6, SR)], SR);
    expect(r.keyPitchClass).toBe(0);
    expect(r.keyIsMinor).toBe(false);
    expect(r.keyConfidence).toBeGreaterThan(0.5);
  });

  it("finds A minor", () => {
    const r = analyzeTrack([makeChord(220.0, true, 6, SR)], SR);
    expect(r.keyPitchClass).toBe(9);
    expect(r.keyIsMinor).toBe(true);
  });

  it("reports nothing on silence", () => {
    const r = analyzeTrack([new Float32Array(5 * SR)], SR);
    expect(r.keyPitchClass).toBe(-1);
  });
});

describe("structural cue detection", () => {
  it("finds intro, drop, and outro on a shaped track", () => {
    const seconds = 30;
    const r = analyzeTrack([makeShapedTrack(seconds, SR)], SR);
    expect(r.introEndSec).toBeGreaterThanOrEqual(0);
    expect(r.dropSec).toBeGreaterThanOrEqual(0);
    expect(r.outroStartSec).toBeGreaterThanOrEqual(0);
    // Generous tolerances: this is a loudness heuristic, not exact segmentation.
    expect(Math.abs(r.introEndSec - seconds * 0.2)).toBeLessThan(2);
    expect(Math.abs(r.dropSec - seconds * 0.5)).toBeLessThan(2);
    expect(Math.abs(r.outroStartSec - seconds * 0.8)).toBeLessThan(2);
    expect(r.introEndSec).toBeLessThan(r.dropSec);
    expect(r.dropSec).toBeLessThan(r.outroStartSec);
  });

  it("reports nothing on silence", () => {
    const r = analyzeTrack([new Float32Array(5 * SR)], SR);
    expect(r.introEndSec).toBeLessThan(0);
    expect(r.dropSec).toBeLessThan(0);
    expect(r.outroStartSec).toBeLessThan(0);
  });
});

describe("camelotCode", () => {
  it("matches the standard wheel", () => {
    expect(camelotCode(0, false)).toBe("8B"); // C major
    expect(camelotCode(9, true)).toBe("8A"); // A minor
    expect(camelotCode(7, false)).toBe("9B"); // G major
    expect(camelotCode(2, true)).toBe("7A"); // D minor
    expect(camelotCode(-1, false)).toBe("");
    expect(camelotCode(12, false)).toBe("");
  });
});
