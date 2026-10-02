// The "RadicalAI" next-track advisor: scores how well a candidate track would
// mix next after the one currently playing, from metadata alone (key, BPM,
// energy, genre, play history). Pure, allocation-free, real-time safe (it's
// cheap enough to run every UI frame over a whole library), and fully
// deterministic so the same inputs always explain the same score.
//
// This is NOT the audio engine: it never touches a deck or a sample. Hosts
// call it once per candidate track to rank a library, independent of
// djn_engine entirely.
#pragma once

#include <string>

namespace djn {

struct TrackInfo {
  double bpm = 0.0;                  // <= 0: unknown, tempo scores neutral
  int key_pitch_class = -1;          // 0..11, or -1: unknown, harmonic scores neutral
  bool key_is_minor = false;
  double energy = 5.0;               // 0..10 (subjective "how hard does this hit")
  std::string genre;                 // free text; empty: unknown, genre scores neutral
  // Seconds since this track last played, or < 0 if it has never been played
  // (treated as maximally fresh).
  double seconds_since_played = -1.0;
  // A learned per-user preference nudge for this track, e.g. from how often a
  // DJ accepts vs. skips this suggestion. -1 (avoid) .. 0 (neutral) .. +1 (favor).
  double user_bias = 0.0;
};

struct AdvisorWeights {
  double harmonic = 1.0;
  double tempo = 1.0;
  double energy = 0.8;
  double genre = 0.5;
  double recency = 0.6;
  double bias = 0.4;
  // Tracks played more recently than this are heavily penalized; this is the
  // "won't repeat within a session" horizon, not a hard ban.
  double recency_horizon_sec = 45.0 * 60.0;
};

struct NextTrackScore {
  double total = 0.0;       // 0..1, higher = better next pick
  double harmonic = 0.0;    // each sub-score is 0..1, for an explainable "why" UI
  double tempo = 0.0;
  double energy = 0.0;
  double genre = 0.0;
  double recency = 0.0;
};

// Scores `candidate` as the next track after `current`.
// `targetEnergy` is the set-arc's desired energy at this point in the set
// (e.g. from a warm-up/peak/closing template); pass < 0 to just match
// `current`'s energy (the "keep it steady" default with no planned arc).
NextTrackScore scoreNextTrack(const TrackInfo& current, const TrackInfo& candidate, double targetEnergy = -1.0,
                              const AdvisorWeights& weights = AdvisorWeights());

}  // namespace djn
