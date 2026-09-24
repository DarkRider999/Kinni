// Colour FX: one effect type for the whole mixer, played per channel by that
// channel's colour (filter) knob, like the COLOR FX section of a club mixer.
// Turning left and right gives two flavours of each effect.
#pragma once

#include <array>
#include <cstdint>

#include "dsp.h"
#include "fx.h"

namespace djn {

enum class ColorType : int { Filter = 0, Noise, DubEcho, Pitch, Crush, Space, Count };

// Small 4-line feedback delay network, shared by Space and the build-up macro.
class SmallReverb {
 public:
  void setup(int sampleRate);
  void clear();
  void setDecay(float rt60Seconds);
  // Mono in, stereo wet out.
  inline void tick(float in, float& l, float& r) {
    float o[4], sum = 0.0f;
    for (int k = 0; k < 4; ++k) {
      const float v = lines_[size_t(k)].read(len_[size_t(k)]);
      damp_[size_t(k)] += dampC_ * (v - damp_[size_t(k)]);
      o[k] = damp_[size_t(k)] * gain_[size_t(k)];
      sum += o[k];
    }
    const float h = sum * 0.5f;  // Householder for N = 4
    for (int k = 0; k < 4; ++k) lines_[size_t(k)].push(o[k] - h + (k & 1 ? -in : in));
    l = (o[0] - o[2]) * 0.8f;
    r = (o[1] - o[3]) * 0.8f;
  }

 private:
  std::array<DelayLine, 4> lines_;
  std::array<double, 4> len_{};
  std::array<float, 4> damp_{}, gain_{};
  float dampC_ = 0.4f, rt60_ = -1.0f;
  double sr_ = 48000.0;
};

class ColorFx {
 public:
  void setup(int sampleRate);
  void reset();

  // In place on one channel. `knob` is the channel's colour knob (-1..1),
  // `param` the mixer-wide colour parameter (0..1), `bpm` the beat clock tempo.
  void process(float* l, float* r, int n, int type, float knob, float param, double bpm);

 private:
  double sr_ = 48000.0;
  int type_ = 0;
  Svf svf_;
  float lastCut_ = -1.0f;
  bool lastLow_ = true;
  DelayLine dl_[2];       // dub echo line / pitch-shifter history
  double delay_ = 0.0;
  float send_ = 0.0f;     // smoothed send / wet amount
  PitchShifter shifter_;
  float crushHold_[2] = {0, 0};
  int crushCount_ = 0;
  uint32_t noise_[2] = {12345u, 67890u};
  SmallReverb reverb_;
};

}  // namespace djn
