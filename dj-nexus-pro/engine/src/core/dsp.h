// Small DSP building blocks shared by the deck, mixer and master bus.
// Everything here is allocation-free and safe to use on the audio thread.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <iterator>

namespace djn {

constexpr double kPi = 3.14159265358979323846;

inline float dbToGain(float db) { return db <= -80.0f ? 0.0f : std::pow(10.0f, db / 20.0f); }
inline float gainToDb(float g) { return g <= 1e-6f ? -120.0f : 20.0f * std::log10(g); }

template <typename T>
inline T clampv(T v, T lo, T hi) { return v < lo ? lo : (v > hi ? hi : v); }

// One-pole smoothing towards a target, advanced once per sub-block.
class Smoothed {
 public:
  void reset(float v) { current_ = target_ = v; }
  void setTarget(float v) { target_ = v; }
  // `coeff` is the fraction of the remaining distance covered per step.
  float step(float coeff) {
    current_ += (target_ - current_) * coeff;
    if (std::fabs(target_ - current_) < 1e-6f) current_ = target_;
    return current_;
  }
  float current() const { return current_; }
  float target() const { return target_; }
  bool settled() const { return current_ == target_; }

 private:
  float current_ = 0.0f;
  float target_ = 0.0f;
};

// Biquad coefficients (RBJ audio EQ cookbook), normalised so a0 = 1.
struct BiquadCoeffs {
  float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;

  static BiquadCoeffs normalise(double b0, double b1, double b2, double a0, double a1, double a2) {
    BiquadCoeffs c;
    c.b0 = float(b0 / a0);
    c.b1 = float(b1 / a0);
    c.b2 = float(b2 / a0);
    c.a1 = float(a1 / a0);
    c.a2 = float(a2 / a0);
    return c;
  }

  static BiquadCoeffs lowShelf(double fs, double f, double db) {
    const double A = std::pow(10.0, db / 40.0), w = 2 * kPi * f / fs, cs = std::cos(w);
    const double alpha = std::sin(w) / 2 * std::sqrt(2.0), sa = 2 * std::sqrt(A) * alpha;
    return normalise(A * ((A + 1) - (A - 1) * cs + sa), 2 * A * ((A - 1) - (A + 1) * cs),
                     A * ((A + 1) - (A - 1) * cs - sa), (A + 1) + (A - 1) * cs + sa,
                     -2 * ((A - 1) + (A + 1) * cs), (A + 1) + (A - 1) * cs - sa);
  }

  static BiquadCoeffs highShelf(double fs, double f, double db) {
    const double A = std::pow(10.0, db / 40.0), w = 2 * kPi * f / fs, cs = std::cos(w);
    const double alpha = std::sin(w) / 2 * std::sqrt(2.0), sa = 2 * std::sqrt(A) * alpha;
    return normalise(A * ((A + 1) + (A - 1) * cs + sa), -2 * A * ((A - 1) + (A + 1) * cs),
                     A * ((A + 1) + (A - 1) * cs - sa), (A + 1) - (A - 1) * cs + sa,
                     2 * ((A - 1) - (A + 1) * cs), (A + 1) - (A - 1) * cs - sa);
  }

  static BiquadCoeffs peaking(double fs, double f, double q, double db) {
    const double A = std::pow(10.0, db / 40.0), w = 2 * kPi * f / fs, cs = std::cos(w);
    const double alpha = std::sin(w) / (2 * q);
    return normalise(1 + alpha * A, -2 * cs, 1 - alpha * A, 1 + alpha / A, -2 * cs, 1 - alpha / A);
  }

  static BiquadCoeffs lowPass(double fs, double f, double q = 0.70710678) {
    const double w = 2 * kPi * f / fs, cs = std::cos(w), alpha = std::sin(w) / (2 * q);
    return normalise((1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + alpha, -2 * cs, 1 - alpha);
  }

  static BiquadCoeffs highPass(double fs, double f, double q = 0.70710678) {
    const double w = 2 * kPi * f / fs, cs = std::cos(w), alpha = std::sin(w) / (2 * q);
    return normalise((1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + alpha, -2 * cs, 1 - alpha);
  }
};

// Stereo biquad, transposed direct form II.
class Biquad {
 public:
  void setCoeffs(const BiquadCoeffs& c) { c_ = c; }
  void reset() { z1_[0] = z1_[1] = z2_[0] = z2_[1] = 0; }

  inline float tick(float x, int ch) {
    const float y = c_.b0 * x + z1_[ch];
    z1_[ch] = c_.b1 * x - c_.a1 * y + z2_[ch];
    z2_[ch] = c_.b2 * x - c_.a2 * y;
    return y;
  }

  void process(float* l, float* r, int n) {
    for (int i = 0; i < n; ++i) {
      l[i] = tick(l[i], 0);
      r[i] = tick(r[i], 1);
    }
  }

 private:
  BiquadCoeffs c_;
  float z1_[2] = {0, 0}, z2_[2] = {0, 0};
};

// 4th-order Linkwitz-Riley section (two cascaded Butterworth biquads).
class LR4 {
 public:
  void setLowPass(double fs, double f) {
    const auto c = BiquadCoeffs::lowPass(fs, f);
    a_.setCoeffs(c);
    b_.setCoeffs(c);
  }
  void setHighPass(double fs, double f) {
    const auto c = BiquadCoeffs::highPass(fs, f);
    a_.setCoeffs(c);
    b_.setCoeffs(c);
  }
  inline float tick(float x, int ch) { return b_.tick(a_.tick(x, ch), ch); }
  void reset() {
    a_.reset();
    b_.reset();
  }

 private:
  Biquad a_, b_;
};

// Stereo state-variable filter (Zavalishin TPT form). Stable under fast
// cutoff modulation, which is what a DJ filter knob does all the time.
class Svf {
 public:
  void set(double fs, double cutoff, double k) {
    cutoff = clampv(cutoff, 10.0, fs * 0.45);
    const double g = std::tan(kPi * cutoff / fs);
    k_ = float(k);
    a1_ = float(1.0 / (1.0 + g * (g + k)));
    a2_ = float(g) * a1_;
    a3_ = float(g) * a2_;
  }
  void reset() { ic1_[0] = ic1_[1] = ic2_[0] = ic2_[1] = 0; }

  // Returns low-pass; high-pass through `hp`.
  inline float tick(float v0, int ch, float& hp) {
    const float v3 = v0 - ic2_[ch];
    const float v1 = a1_ * ic1_[ch] + a2_ * v3;
    const float v2 = ic2_[ch] + a2_ * ic1_[ch] + a3_ * v3;
    ic1_[ch] = 2 * v1 - ic1_[ch];
    ic2_[ch] = 2 * v2 - ic2_[ch];
    hp = v0 - k_ * v1 - v2;
    return v2;
  }

 private:
  float k_ = 1.414f, a1_ = 1, a2_ = 0, a3_ = 0;
  float ic1_[2] = {0, 0}, ic2_[2] = {0, 0};
};

// Look-ahead peak limiter for the master bus. Delays the signal by `kLookahead`
// samples so gain reduction is in place before a peak arrives.
class Limiter {
 public:
  static constexpr int kLookahead = 64;

  void setup(double fs) {
    release_ = float(std::exp(-1.0 / (0.080 * fs)));  // 80 ms release
    attack_ = float(1.0 - std::exp(-1.0 / (kLookahead / 5.0)));  // settles within the look-ahead
    reset();
  }
  void setCeilingDb(float db) { ceiling_ = dbToGain(clampv(db, -24.0f, 0.0f)); }
  void setEnabled(bool on) { enabled_ = on; }
  void reset() {
    std::fill(std::begin(delayL_), std::end(delayL_), 0.0f);
    std::fill(std::begin(delayR_), std::end(delayR_), 0.0f);
    std::fill(std::begin(need_), std::end(need_), 1.0f);
    pos_ = 0;
    gain_ = 1.0f;
    minGain_ = 1.0f;
  }
  float lastGain() const { return minGain_; }

  void process(float* l, float* r, int n) {
    minGain_ = 1.0f;
    for (int i = 0; i < n; ++i) {
      const float peak = std::max(std::fabs(l[i]), std::fabs(r[i]));
      need_[pos_] = (enabled_ && peak > ceiling_) ? ceiling_ / peak : 1.0f;
      delayL_[pos_] = l[i];
      delayR_[pos_] = r[i];
      // Smallest gain needed anywhere in the look-ahead window.
      float target = 1.0f;
      for (int k = 0; k < kLookahead; ++k) target = std::min(target, need_[k]);
      gain_ = target < gain_ ? gain_ + (target - gain_) * attack_ : target + (gain_ - target) * release_;
      const int out = (pos_ + 1) % kLookahead;  // oldest sample in the delay line
      // The smoothed gain has normally reached the window minimum by now; the
      // min() with the sample's own requirement guarantees the ceiling anyway.
      const float g = std::min(gain_, need_[out]);
      l[i] = delayL_[out] * g;
      r[i] = delayR_[out] * g;
      minGain_ = std::min(minGain_, g);
      pos_ = out;
    }
  }

 private:
  float delayL_[kLookahead] = {}, delayR_[kLookahead] = {}, need_[kLookahead] = {};
  int pos_ = 0;
  float gain_ = 1.0f, minGain_ = 1.0f, ceiling_ = 0.944f, release_ = 0.9999f, attack_ = 0.05f;
  bool enabled_ = true;
};

// Crossfader curves. Returns {gainA, gainB} for position 0 (A) .. 1 (B).
inline void crossfaderGains(float pos, int curve, float& a, float& b) {
  pos = clampv(pos, 0.0f, 1.0f);
  if (curve == 1) {  // sharp cut for scratching
    const float cut = 0.04f;
    a = pos >= 1.0f - cut ? (1.0f - pos) / cut : 1.0f;
    b = pos <= cut ? pos / cut : 1.0f;
    return;
  }
  a = float(std::cos(pos * kPi * 0.5));  // constant power
  b = float(std::sin(pos * kPi * 0.5));
}

// Channel fader law: roughly logarithmic, 0 = silence.
inline float faderLaw(float v) {
  v = clampv(v, 0.0f, 1.0f);
  return v * v * (3.0f - 2.0f * v) * v;  // gentle S-curve biased towards the top
}

}  // namespace djn
