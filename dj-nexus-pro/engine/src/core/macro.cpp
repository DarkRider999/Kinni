#include "macro.h"

#include <algorithm>
#include <cmath>

namespace djn {

namespace {
inline float white(uint32_t& s) {
  s = s * 1664525u + 1013904223u;
  return float(int32_t(s)) * (1.0f / 2147483648.0f);
}
inline double frac(double x) { return x - std::floor(x); }
}  // namespace

void MacroFx::setup(int sampleRate) {
  sr_ = sampleRate;
  for (auto& h : hist_) h.setup(size_t(4.5 * sampleRate) + 16);
  reverb_.setup(sampleRate);
  reverb_.setDecay(3.5f);
  rampStep_ = float(1.0 / (0.003 * sampleRate));  // 3 ms in and out
}

void MacroFx::start(int type, int bars, bool impact, const BeatClock& clock) {
  if (type < kRiser || type > kDrop) return;
  bars = clampv(bars, 1, 16);
  const double b = clock.at(0);
  startBeat_ = b;
  if (type == kDrop) {
    endBeat_ = std::ceil(b / 4.0) * 4.0;  // the next bar line...
    if (endBeat_ - b < 1.0) endBeat_ += 4.0;  // ...at least a beat away
  } else {
    endBeat_ = std::floor(b / 4.0) * 4.0 + 4.0 * bars;
    if (endBeat_ - b < 1.0) endBeat_ += 4.0;
  }
  type_ = type;
  impact_ = impact;
  fading_ = false;
  rolling_ = false;
  hpf_.reset();
  riserSvf_.reset();
  reverb_.clear();
  lastHp_ = -1.0f;
  tonePhase_ = 0.0;
  progress_ = 0.0;
  beatsLeft_ = endBeat_ - b;
}

void MacroFx::cancel() {
  if (type_ != kNone) fading_ = true;  // ramps back to dry, no impact
}

void MacroFx::finish(bool withImpact) {
  fading_ = true;
  if (withImpact && (type_ == kBuildUp || type_ == kDrop)) {
    impactT_ = 0.0;
    impactPhase_ = 0.0;
    impactLp_ = 0.0f;
  }
}

void MacroFx::startRoll(double beat, double division, double samplesPerBeat) {
  const double len = clampv(division * samplesPerBeat, 32.0, 4.0 * sr_);
  const double since = frac(beat / division) * len;
  rollLen_ = int64_t(len);
  rollElapsed_ = int64_t(since);
  rollStart_ = hist_[0].count() - rollElapsed_;
  rollDiv_ = division;
  rolling_ = true;
}

void MacroFx::process(float* l, float* r, int n, const BeatClock& clock) {
  if (!busy()) return;
  const double spb = clock.bpm > 0 ? sr_ * 60.0 / clock.bpm : sr_ * 0.5;
  const double span = std::max(1e-9, endBeat_ - startBeat_);

  for (int i = 0; i < n; ++i) {
    const double b = clock.at(i);
    const float xl = l[i], xr = r[i];

    if (type_ != kNone) {
      if (!fading_ && b >= endBeat_) finish(impact_);
      const double p = clampv((b - startBeat_) / span, 0.0, 1.0);
      float wl = xl, wr = xr;

      // Riser: noise through a rising high-pass plus a rising tone (riser and build-up).
      float riser = 0.0f;
      if ((type_ == kRiser || type_ == kBuildUp) && !fading_) {
        if ((i & 31) == 0) riserSvf_.set(sr_, 300.0 * std::pow(8000.0 / 300.0, p), 0.9);
        float hp;
        riserSvf_.tick(white(noise_), 0, hp);
        tonePhase_ += 2.0 * kPi * 220.0 * std::pow(8.0, p) / sr_;
        const float env = float(p * p) * float(std::min(1.0, p * 50.0));
        riser = (hp * 0.28f + float(std::sin(tonePhase_)) * 0.05f) * env;
      }

      if (type_ == kRiser) {
        wl = xl + riser;
        wr = xr + riser;
      } else if (type_ == kBuildUp) {
        // Roll in the last bar, speeding up towards the drop.
        const double rel = endBeat_ - b;
        if (rel <= 4.0 && !fading_) {
          const double div = rel > 2.0 ? 1.0 : rel > 1.0 ? 0.5 : rel > 0.5 ? 0.25 : 0.125;
          if (!rolling_ || div != rollDiv_) startRoll(b, div, spb);
        }
        hist_[0].push(xl);
        hist_[1].push(xr);
        float sl = xl, sr = xr;
        if (rolling_) {
          const int64_t t = rollElapsed_ % rollLen_;
          const int64_t idx = rollStart_ + t;
          const float ramp = float(std::min<int64_t>(48, rollLen_ / 4));
          const float e = std::min(1.0f, std::min(float(t) / ramp, float(rollLen_ - t) / ramp));
          sl = hist_[0].readAbs(idx) * e;
          sr = hist_[1].readAbs(idx) * e;
          ++rollElapsed_;
        }
        // High-pass sweep: 20 Hz -> 1 kHz, steeper towards the end.
        if ((i & 31) == 0) {
          const float cut = float(20.0 * std::pow(50.0, std::pow(p, 1.6)));
          if (cut != lastHp_) {
            hpf_.set(sr_, cut, 1.0);
            lastHp_ = cut;
          }
        }
        float hl, hr;
        hpf_.tick(sl, 0, hl);
        hpf_.tick(sr, 1, hr);
        // Reverb wash grows with the build.
        float rl, rrv;
        reverb_.tick((hl + hr) * 0.5f * float(p) * 0.6f, rl, rrv);
        wl = hl + rl * float(p) + riser;
        wr = hr + rrv * float(p) + riser;
      } else if (type_ == kDrop) {
        wl = 0.0f;  // the cut before the drop
        wr = 0.0f;
      }

      if (fading_) {
        amount_ -= rampStep_;
        if (amount_ <= 0.0f) {
          amount_ = 0.0f;
          type_ = kNone;
          fading_ = false;
          rolling_ = false;
        }
      } else if (amount_ < 1.0f) {
        amount_ = std::min(1.0f, amount_ + rampStep_);
      }
      l[i] = xl + (wl - xl) * amount_;
      r[i] = xr + (wr - xr) * amount_;
    }

    // Impact: sub boom plus a noise burst, on top of everything.
    if (impactT_ >= 0.0) {
      const double t = impactT_;
      impactPhase_ += 2.0 * kPi * (38.0 + 120.0 * std::exp(-t * 10.0)) / sr_;
      const float body = float(std::sin(impactPhase_) * std::exp(-t * 2.2));
      impactLp_ += 0.15f * (white(noise_) - impactLp_);
      const float burst = impactLp_ * float(std::exp(-t * 12.0)) * 2.0f;
      const float s = std::tanh((body * 0.9f + burst) * 1.3f) * 0.7f * float(std::min(1.0, t * 2000.0));
      l[i] += s;
      r[i] += s;
      impactT_ += 1.0 / sr_;
      if (impactT_ > 2.5) impactT_ = -1.0;
    }
  }

  const double b = clock.at(n);
  progress_ = type_ == kNone ? 0.0 : clampv((b - startBeat_) / span, 0.0, 1.0);
  beatsLeft_ = type_ == kNone ? 0.0 : std::max(0.0, endBeat_ - b);
}

}  // namespace djn
