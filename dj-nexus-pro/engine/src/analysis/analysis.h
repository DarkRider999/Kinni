// Offline track analysis: tempo, beat grid, downbeat and musical key.
//
// Classic signal processing, no trained models (those come later, see
// docs/dj-nexus-pro/AI_TRAINING_BLUEPRINT.md, models A1-A3). Runs on any
// thread; typical cost is well under a second per track natively.
#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace djn {
namespace analysis {

struct TempoResult {
  double bpm = 0.0;           // 0: no steady beat
  double firstBeat = 0.0;     // seconds; a downbeat (bar start)
  double confidence = 0.0;    // 0..1
  double downbeatConfidence = 0.0;
  bool stable = false;        // one constant grid fits the whole track
};

struct KeyResult {
  int key = -1;               // 0-11 major C..B, 12-23 minor C..B
  double confidence = 0.0;    // 0..1
  double tuningCents = 0.0;   // reference pitch offset from A = 440 Hz
  std::array<double, 12> chroma{};
};

struct Options {
  double minBpm = 78.0;
  double maxBpm = 180.0;
  bool tempo = true;
  bool key = true;
};

// Mono mixdown resampled to `rate` (band-limited).
std::vector<float> monoAt(const float* interleaved, int64_t frames, int channels, int sourceRate, double rate);

TempoResult analyzeTempo(const std::vector<float>& mono, double rate, const Options& opt);
KeyResult analyzeKey(const std::vector<float>& mono, double rate);

// Names for key indexes: "A minor", "8A" (Camelot), "1m" (Open Key).
std::string keyName(int key);
std::string camelot(int key);
std::string openKey(int key);

// Analysis sample rates (exposed for tests).
constexpr double kTempoRate = 11025.0;
constexpr double kKeyRate = 5512.5;

}  // namespace analysis
}  // namespace djn
