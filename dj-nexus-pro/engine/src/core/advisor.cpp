#include "advisor.h"

#include <algorithm>
#include <cctype>
#include <cmath>

#include "analysis.h"
#include "dsp.h"

namespace djn {
namespace {

// Camelot wheel distance. Same key is a perfect match; the relative
// major/minor (same number) and the adjacent fifth (+-1, same letter) are the
// two classic "always safe" harmonic moves DJs reach for; a +-1 move that also
// crosses major/minor is the riskier "diagonal" energy-change mix.
double harmonicScore(int n1, char l1, int n2, char l2) {
  const int diff = std::abs(n1 - n2);
  const int d = std::min(diff, 12 - diff);  // 0..6 around the 12-position wheel
  const bool sameLetter = (l1 == l2);
  if (d == 0) return sameLetter ? 1.0 : 0.90;
  if (d == 1) return sameLetter ? 0.80 : 0.50;
  if (d == 2) return sameLetter ? 0.35 : 0.20;
  return std::max(0.0, 0.15 - 0.02 * d);
}

// Credits an exact tempo match and, with slightly less weight, a half-/
// double-time match (mixing a 140 BPM track under a 70 BPM half-time track is
// a standard move).
double tempoScore(double bpmA, double bpmB) {
  if (bpmA <= 0.0 || bpmB <= 0.0) return 0.5;  // unknown tempo: neither helps nor hurts
  double best = 0.0;
  const double kSigma = 0.08;  // ~8% pitch range feels "the same tempo"
  for (const double mult : {1.0, 0.5, 2.0}) {
    const double pct = (bpmB * mult) / bpmA - 1.0;
    const double s = std::exp(-(pct * pct) / (2.0 * kSigma * kSigma)) * (mult == 1.0 ? 1.0 : 0.85);
    best = std::max(best, s);
  }
  return best;
}

std::string lower(const std::string& s) {
  std::string out = s;
  std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) { return std::tolower(c); });
  return out;
}

double genreScore(const std::string& a, const std::string& b) {
  if (a.empty() || b.empty()) return 0.5;  // unknown: neutral, not a penalty
  return lower(a) == lower(b) ? 1.0 : 0.3;
}

}  // namespace

NextTrackScore scoreNextTrack(const TrackInfo& current, const TrackInfo& candidate, double targetEnergy,
                              const AdvisorWeights& weights) {
  NextTrackScore out;

  int n1 = 0, n2 = 0;
  char l1 = 'A', l2 = 'A';
  const bool k1 = camelotOf(current.key_pitch_class, current.key_is_minor, n1, l1);
  const bool k2 = camelotOf(candidate.key_pitch_class, candidate.key_is_minor, n2, l2);
  out.harmonic = (k1 && k2) ? harmonicScore(n1, l1, n2, l2) : 0.5;

  out.tempo = tempoScore(current.bpm, candidate.bpm);

  const double target = targetEnergy >= 0.0 ? targetEnergy : current.energy;
  out.energy = clampv(1.0 - std::fabs(candidate.energy - target) / 6.0, 0.0, 1.0);

  out.genre = genreScore(current.genre, candidate.genre);

  out.recency = candidate.seconds_since_played < 0.0
                    ? 1.0
                    : clampv(candidate.seconds_since_played / std::max(1.0, weights.recency_horizon_sec), 0.0, 1.0);

  const double sumW = weights.harmonic + weights.tempo + weights.energy + weights.genre + weights.recency;
  const double weighted = sumW > 1e-9
      ? (weights.harmonic * out.harmonic + weights.tempo * out.tempo + weights.energy * out.energy +
         weights.genre * out.genre + weights.recency * out.recency) / sumW
      : 0.0;
  // The learned bias nudges rather than dominates: halved before applying its
  // own weight, so a maximal +-1 bias can shift the score by at most weights.bias/2.
  out.total = clampv(weighted + weights.bias * (candidate.user_bias * 0.5), 0.0, 1.0);
  return out;
}

}  // namespace djn
