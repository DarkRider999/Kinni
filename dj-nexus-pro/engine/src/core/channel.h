// Mixer channel strip: trim -> 3-band EQ -> bipolar filter -> channel fader.
// Also taps the pre-fader signal for the headphone cue bus.
#pragma once

#include "colorfx.h"
#include "dsp.h"

namespace djn {

struct ChannelParams {
  float trimDb = 0.0f;
  float eqDb[3] = {0.0f, 0.0f, 0.0f};  // low, mid, high
  float filter = 0.0f;                 // -1 (LPF) .. 0 (off) .. +1 (HPF)
  float fader = 1.0f;                  // 0..1
  int eqMode = 0;                      // 0 classic, 1 isolator
  float resonance = 0.3f;              // 0..1, the colour parameter
  int colorType = 0;                   // ColorType: 0 = filter, else the knob plays that colour FX
  double bpm = 120.0;                  // beat clock tempo (dub echo timing)
};

class ChannelStrip {
 public:
  static constexpr int kSubBlock = 32;

  // Classic EQ (DJ mixer centre frequencies)
  static constexpr double kLowShelfHz = 70.0;
  static constexpr double kMidHz = 1000.0;
  static constexpr double kHighShelfHz = 13000.0;
  // Isolator crossover points
  static constexpr double kIsoLowHz = 250.0;
  static constexpr double kIsoHighHz = 2500.0;

  void setup(double fs);
  void reset();

  // In place. `cueL/cueR` (may be null) get the pre-fader signal added.
  void process(float* l, float* r, int n, const ChannelParams& p, float* cueL, float* cueR);

  float blockPeakL() const { return peakL_; }
  float blockPeakR() const { return peakR_; }

 private:
  void updateCoefficients(int eqMode);
  float isoGain(float db) const { return db <= -40.0f ? 0.0f : dbToGain(clampv(db, -40.0f, 6.0f)); }

  double fs_ = 48000.0;
  float smoothCoeff_ = 0.05f;
  Smoothed trim_, eq_[3], filter_, fader_;
  int lastEqMode_ = -1;
  float lastEq_[3] = {1e9f, 1e9f, 1e9f};

  // Classic
  Biquad low_, mid_, high_;
  // Isolator: low = LP1 -> allpass(LP2+HP2); mid = HP1 -> LP2; high = HP1 -> HP2
  LR4 isoLp1_, isoHp1_, isoLp2_, isoHp2_, isoApLp_, isoApHp_;

  Svf svf_;
  ColorFx color_;
  float lastFilter_ = 1e9f, lastRes_ = -1.0f;
  float peakL_ = 0.0f, peakR_ = 0.0f;
  bool first_ = true;  // the first block starts at the target values, no glide
};

}  // namespace djn
