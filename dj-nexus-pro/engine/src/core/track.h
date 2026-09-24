// Decoded track audio held in memory at the engine's sample rate.
#pragma once

#include <cstdint>
#include <memory>
#include <vector>

namespace djn {

// Planar stereo PCM with silent padding on both sides, so readers (the
// interpolator and the time-stretcher's search window) never need bounds checks
// near the start or end of the track.
struct Track {
  static constexpr int64_t kPad = 16384;

  std::vector<float> left;   // size = frames + 2 * kPad
  std::vector<float> right;
  int64_t frames = 0;        // real audio frames (without padding)
  int32_t sampleRate = 0;    // always the engine rate
  double bpm = 0.0;          // 0 = unknown grid
  double firstBeatFrame = 0; // first downbeat position in frames

  // Pointers to frame 0 (valid range is [-kPad, frames + kPad)).
  const float* l() const { return left.data() + kPad; }
  const float* r() const { return right.data() + kPad; }

  double framesPerBeat() const { return bpm > 0 ? sampleRate * 60.0 / bpm : 0.0; }
};

// Builds a Track from interleaved PCM (1 or 2 channels), converting to
// `engineRate` with a windowed-sinc resampler when the rates differ.
// Runs on a control/loader thread; allocates. Returns nullptr on bad input.
std::unique_ptr<Track> makeTrack(const float* interleaved, int64_t frames, int channels,
                                 int sourceRate, int engineRate, double bpm, double firstBeatSec);

// Band-limited offline sample-rate conversion of one planar channel.
// Exposed for tests.
void resampleChannel(const float* in, int64_t inFrames, double ratio /* out/in */,
                     float* out, int64_t outFrames);

}  // namespace djn
