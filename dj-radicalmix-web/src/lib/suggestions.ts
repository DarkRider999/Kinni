// Shared next-track suggestion logic, used by both the Library screen's full
// RadicalAI panel and the Decks screen's compact "Next-Track Radar" rail
// (docs/dj-radicalmix Sec 3 Issue 5 / Sec 7) -- one source of truth so the
// two surfaces never silently disagree on what the AI recommends.
import { explainSuggestion, scoreNextTrack, type NextTrackScore, type TrackInfo } from "../engine/advisor";
import { secondsSincePlayed, type Track } from "./library";

export function toTrackInfo(t: Track): TrackInfo {
  return {
    bpm: t.bpm,
    keyPitchClass: t.keyPitchClass,
    keyIsMinor: t.keyIsMinor,
    energy: t.energy,
    genre: t.genre,
    secondsSincePlayed: secondsSincePlayed(t),
    userBias: t.userBias,
  };
}

export interface Suggestion {
  track: Track;
  score: NextTrackScore;
  reason: string;
}

export function suggestNextTracks(reference: Track, pool: Track[], targetEnergy = -1, limit = 6): Suggestion[] {
  const current = toTrackInfo(reference);
  return pool
    .filter((t) => t.id !== reference.id)
    .map((t) => {
      const score = scoreNextTrack(current, toTrackInfo(t), targetEnergy);
      return { track: t, score, reason: explainSuggestion(current, toTrackInfo(t), score) };
    })
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);
}
