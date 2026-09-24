// Performance macros that automate several effects at once and land on a bar line:
//   Riser    - noise sweep + rising tone over N bars.
//   Build-up - high-pass sweep, reverb wash and riser over N bars, with a roll
//              that speeds up (1 -> 1/2 -> 1/4 -> 1/8 beat) in the last bar;
//              at the bar line everything snaps back clean.
//   Drop     - cuts the audio until the next bar line, then slams back in.
// Build-up and drop can fire an impact (sub boom + noise burst) on the drop.
#pragma once

#include <cstdint>

#include "colorfx.h"
#include "dsp.h"
#include "fx.h"

namespace djn {

class MacroFx {
 public:
  enum Type { kNone = -1, kRiser = 0, kBuildUp = 1, kDrop = 2 };

  void setup(int sampleRate);
  // Audio thread. `bars` sets the riser/build-up length; the macro ends on the
  // bar line `bars` bars after the current bar's start (bars = 4 beats from beat 0).
  void start(int type, int bars, bool impact, const BeatClock& clock);
  void cancel();
  // In place. Keeps running after the macro ends while the impact rings.
  void process(float* l, float* r, int n, const BeatClock& clock);

  int type() const { return type_; }
  bool busy() const { return type_ != kNone || impactT_ >= 0.0; }
  double progress() const { return progress_; }
  double beatsLeft() const { return beatsLeft_; }

 private:
  void startRoll(double beat, double division, double samplesPerBeat);
  void finish(bool withImpact);

  double sr_ = 48000.0;
  int type_ = kNone;
  double startBeat_ = 0.0, endBeat_ = 0.0;
  bool impact_ = false;
  float amount_ = 0.0f;       // 0..1 ramp between dry and macro output
  float rampStep_ = 0.01f;
  bool fading_ = false;       // macro over: ramping back to dry
  double progress_ = 0.0, beatsLeft_ = 0.0;

  Svf hpf_, riserSvf_;
  float lastHp_ = -1.0f;
  uint32_t noise_ = 424242u;
  double tonePhase_ = 0.0;
  SmallReverb reverb_;

  DelayLine hist_[2];         // for the roll in the last bar
  bool rolling_ = false;
  double rollDiv_ = 0.0;
  int64_t rollStart_ = 0, rollLen_ = 1, rollElapsed_ = 0;

  double impactT_ = -1.0;     // seconds since the impact, < 0 = none
  double impactPhase_ = 0.0;
  float impactLp_ = 0.0f;
};

}  // namespace djn
