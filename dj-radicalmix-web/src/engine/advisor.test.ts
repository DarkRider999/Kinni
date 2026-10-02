// Mirrors dj-nexus-pro/engine/tests/test_advisor.cpp.
import { describe, expect, it } from "vitest";
import { type AdvisorWeights, type TrackInfo, scoreNextTrack } from "./advisor";

function track(
  bpm: number,
  pc: number,
  minor: boolean,
  energy: number,
  genre = "",
  sinceSec = -1,
  bias = 0,
): TrackInfo {
  return { bpm, keyPitchClass: pc, keyIsMinor: minor, energy, genre, secondsSincePlayed: sinceSec, userBias: bias };
}

describe("next-track advisor", () => {
  it("scores identical key and tempo perfectly on those axes", () => {
    const current = track(128, 0, false, 6, "techno");
    const candidate = track(128, 0, false, 6, "techno");
    const s = scoreNextTrack(current, candidate);
    expect(s.harmonic).toBeCloseTo(1.0, 9);
    expect(s.tempo).toBeCloseTo(1.0, 9);
    expect(s.total).toBeGreaterThan(0.9);
  });

  it("scores relative major/minor higher than a distant key", () => {
    const current = track(128, 0, false, 6); // C major, 8B
    const relative = track(128, 9, true, 6); // A minor, 8A
    const distant = track(128, 6, false, 6); // F# major, 2B
    expect(scoreNextTrack(current, relative).harmonic).toBeGreaterThan(scoreNextTrack(current, distant).harmonic);
  });

  it("scores an adjacent Camelot number higher than two steps away", () => {
    const current = track(128, 0, false, 6); // 8B
    const adjacent = track(128, 7, false, 6); // G major, 9B
    const twoAway = track(128, 2, false, 6); // D major, 10B
    expect(scoreNextTrack(current, adjacent).harmonic).toBeGreaterThan(scoreNextTrack(current, twoAway).harmonic);
  });

  it("treats an unknown key as neutral, not a penalty", () => {
    const s = scoreNextTrack(track(128, -1, false, 6), track(128, 0, false, 6));
    expect(s.harmonic).toBeCloseTo(0.5, 9);
  });

  it("favors close BPM and credits half-time", () => {
    const current = track(128, -1, false, 6);
    const close = track(130, -1, false, 6);
    const far = track(100, -1, false, 6);
    const halfTime = track(64, -1, false, 6);
    expect(scoreNextTrack(current, close).tempo).toBeGreaterThan(scoreNextTrack(current, far).tempo);
    expect(scoreNextTrack(current, halfTime).tempo).toBeGreaterThan(scoreNextTrack(current, far).tempo);
  });

  it("prefers the arc target over the current track's energy once one is set", () => {
    const current = track(128, -1, false, 4);
    const high = track(128, -1, false, 9);
    const low = track(128, -1, false, 2);
    expect(scoreNextTrack(current, low).energy).toBeGreaterThan(scoreNextTrack(current, high).energy);
    expect(scoreNextTrack(current, high, 9).energy).toBeGreaterThan(scoreNextTrack(current, low, 9).energy);
  });

  it("matches genre case-insensitively and treats unknown as neutral", () => {
    const current = track(128, -1, false, 6, "Techno");
    const same = track(128, -1, false, 6, "techno");
    const other = track(128, -1, false, 6, "Pop");
    const unknown = track(128, -1, false, 6, "");
    expect(scoreNextTrack(current, same).genre).toBeGreaterThan(scoreNextTrack(current, other).genre);
    expect(scoreNextTrack(current, unknown).genre).toBeCloseTo(0.5, 9);
  });

  it("scores never-played higher than just-played on recency", () => {
    const current = track(128, -1, false, 6);
    const fresh = track(128, -1, false, 6, "", -1);
    const justPlayed = track(128, -1, false, 6, "", 0);
    expect(scoreNextTrack(current, fresh).recency).toBeGreaterThan(scoreNextTrack(current, justPlayed).recency);
  });

  it("lets a positive user bias raise the total without changing sub-scores", () => {
    const current = track(128, 0, false, 6, "techno");
    const neutral = track(128, 0, false, 3, "techno", -1, 0);
    const favored = track(128, 0, false, 3, "techno", -1, 1);
    const sN = scoreNextTrack(current, neutral);
    const sF = scoreNextTrack(current, favored);
    expect(sN.harmonic).toBeCloseTo(sF.harmonic, 9);
    expect(sF.total).toBeGreaterThan(sN.total);
  });

  it("isolates one axis when every other weight is zero", () => {
    const onlyHarmonic: AdvisorWeights = {
      harmonic: 1,
      tempo: 0,
      energy: 0,
      genre: 0,
      recency: 0,
      bias: 0,
      recencyHorizonSec: 2700,
    };
    const current = track(128, 0, false, 6);
    const perfectKeyBadTempo = track(999, 0, false, 6);
    const s = scoreNextTrack(current, perfectKeyBadTempo, -1, onlyHarmonic);
    expect(s.total).toBeCloseTo(1.0, 9);
  });
});
