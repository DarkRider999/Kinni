// Key-lock time-stretcher: WSOLA (waveform-similarity overlap-add).
//
// Plays a track at a different tempo without changing its pitch. Each hop, it
// picks the segment near the ideal source position whose waveform best
// continues the previous segment, then overlap-adds it with a Hann window.
//
// This is the engine's built-in stretcher. It sits behind this small interface
// so a commercial one (Rubber Band, Superpowered) can replace it after the
// quality bake-off in the spec without touching the deck code.
#pragma once

#include <cstdint>
#include <vector>

#include "track.h"

namespace djn {

class Stretcher {
 public:
  // Allocates all buffers. Call once, off the audio thread.
  void setup(int sampleRate, int maxBlock);

  // Restart at `sourcePos` (frames). `rate` is used to pre-roll one hop so the
  // first output doesn't fade in from silence.
  void reset(const Track& track, double sourcePos, double rate);

  // Render n frames at `rate` source frames per output frame (0.5..2).
  void process(const Track& track, double rate, float* outL, float* outR, int n);

  // Source position of the next output frame.
  double position() const { return chunkPos_ + double(fifoRead_) * chunkRate_; }

  // Active loop region in source frames. Wrapping happens per hop, so the
  // similarity search and the overlap-add blend the loop seam.
  void setLoop(bool active, double start, double end) {
    loopActive_ = active && end > start;
    loopStart_ = start;
    loopEnd_ = end;
  }

  static constexpr double kMinRate = 0.5;
  static constexpr double kMaxRate = 2.0;

 private:
  void hop(const Track& track, double rate);

  int frameLen_ = 2048;   // analysis/synthesis frame
  int hopLen_ = 1024;     // synthesis hop = frameLen / 2
  int search_ = 512;      // +- search range in frames
  std::vector<float> window_;
  std::vector<float> olaL_, olaR_;    // overlap-add accumulator (frameLen)
  std::vector<float> fifoL_, fifoR_;  // finished output (hopLen)
  int fifoRead_ = 0;
  int fifoCount_ = 0;
  double analysisPos_ = 0.0;
  int64_t prevStart_ = 0;
  bool havePrev_ = false;
  double chunkPos_ = 0.0;   // source position of fifo[0]
  double chunkRate_ = 1.0;  // rate used for the chunk in the fifo
  bool loopActive_ = false;
  double loopStart_ = 0.0, loopEnd_ = 0.0;
};

}  // namespace djn
