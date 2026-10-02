// The "RadicalAI" next-track advisor. A JS port of
// dj-nexus-pro/engine/src/core/advisor.cpp (unit-tested there); kept in sync
// with it rather than called directly, for the same reason as analysis.ts --
// the compiled djnexus.wasm this app loads predates that native module.
import { camelotOf } from "./camelot";

export interface TrackInfo {
  bpm: number; // <= 0: unknown
  keyPitchClass: number; // 0..11, or -1: unknown
  keyIsMinor: boolean;
  energy: number; // 0..10
  genre: string; // empty: unknown
  secondsSincePlayed: number; // < 0: never played
  userBias: number; // -1..+1
}

export interface AdvisorWeights {
  harmonic: number;
  tempo: number;
  energy: number;
  genre: number;
  recency: number;
  bias: number;
  recencyHorizonSec: number;
}

export const DEFAULT_WEIGHTS: AdvisorWeights = {
  harmonic: 1.0,
  tempo: 1.0,
  energy: 0.8,
  genre: 0.5,
  recency: 0.6,
  bias: 0.4,
  recencyHorizonSec: 45 * 60,
};

export interface NextTrackScore {
  total: number;
  harmonic: number;
  tempo: number;
  energy: number;
  genre: number;
  recency: number;
}

function harmonicScore(n1: number, l1: string, n2: number, l2: string): number {
  const diff = Math.abs(n1 - n2);
  const d = Math.min(diff, 12 - diff);
  const sameLetter = l1 === l2;
  if (d === 0) return sameLetter ? 1.0 : 0.9;
  if (d === 1) return sameLetter ? 0.8 : 0.5;
  if (d === 2) return sameLetter ? 0.35 : 0.2;
  return Math.max(0, 0.15 - 0.02 * d);
}

function tempoScore(bpmA: number, bpmB: number): number {
  if (bpmA <= 0 || bpmB <= 0) return 0.5;
  const sigma = 0.08;
  let best = 0;
  for (const [mult, weight] of [[1, 1], [0.5, 0.85], [2, 0.85]] as const) {
    const pct = (bpmB * mult) / bpmA - 1;
    const s = Math.exp(-(pct * pct) / (2 * sigma * sigma)) * weight;
    best = Math.max(best, s);
  }
  return best;
}

function genreScore(a: string, b: string): number {
  if (!a || !b) return 0.5;
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1.0 : 0.3;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function scoreNextTrack(
  current: TrackInfo,
  candidate: TrackInfo,
  targetEnergy = -1,
  weights: AdvisorWeights = DEFAULT_WEIGHTS,
): NextTrackScore {
  const k1 = camelotOf(current.keyPitchClass, current.keyIsMinor);
  const k2 = camelotOf(candidate.keyPitchClass, candidate.keyIsMinor);
  const harmonic = k1 && k2 ? harmonicScore(k1.number, k1.letter, k2.number, k2.letter) : 0.5;

  const tempo = tempoScore(current.bpm, candidate.bpm);

  const target = targetEnergy >= 0 ? targetEnergy : current.energy;
  const energy = clamp01(1 - Math.abs(candidate.energy - target) / 6);

  const genre = genreScore(current.genre, candidate.genre);

  const recency =
    candidate.secondsSincePlayed < 0
      ? 1.0
      : clamp01(candidate.secondsSincePlayed / Math.max(1, weights.recencyHorizonSec));

  const sumW = weights.harmonic + weights.tempo + weights.energy + weights.genre + weights.recency;
  const weighted =
    sumW > 1e-9
      ? (weights.harmonic * harmonic +
          weights.tempo * tempo +
          weights.energy * energy +
          weights.genre * genre +
          weights.recency * recency) /
        sumW
      : 0;
  const total = clamp01(weighted + weights.bias * (candidate.userBias * 0.5));

  return { total, harmonic, tempo, energy, genre, recency };
}

/** A short, human-readable reason for a suggestion, for the "why this?" UI. */
export function explainSuggestion(current: TrackInfo, candidate: TrackInfo, s: NextTrackScore): string {
  const bits: string[] = [];
  const k1 = camelotOf(current.keyPitchClass, current.keyIsMinor);
  const k2 = camelotOf(candidate.keyPitchClass, candidate.keyIsMinor);
  if (k1 && k2) {
    if (s.harmonic >= 0.99) bits.push("same key");
    else if (s.harmonic >= 0.9) bits.push("relative key");
    else if (s.harmonic >= 0.8) bits.push("adjacent key");
    else if (s.harmonic <= 0.35) bits.push("harmonic clash");
  }
  if (current.bpm > 0 && candidate.bpm > 0) {
    const pct = Math.abs(candidate.bpm / current.bpm - 1);
    if (pct < 0.01) bits.push("same tempo");
    else if (s.tempo > 0.6) bits.push(`${candidate.bpm > current.bpm ? "+" : "-"}${Math.round(Math.abs(candidate.bpm - current.bpm))} BPM`);
  }
  if (s.energy > 0.85) bits.push("matches the energy target");
  if (s.recency >= 1) bits.push("not played tonight");
  else if (s.recency < 0.2) bits.push("played very recently");
  return bits.length ? bits.join(", ") : "metadata match";
}
