#include "channel.h"

#include <algorithm>
#include <cmath>

namespace djn {

void ChannelStrip::setup(double fs) {
  fs_ = fs;
  // ~15 ms time constant per sub-block step: fast enough for a knob twist,
  // slow enough to avoid zipper noise.
  smoothCoeff_ = float(1.0 - std::exp(-double(kSubBlock) / (0.015 * fs)));
  isoLp1_.setLowPass(fs, kIsoLowHz);
  isoHp1_.setHighPass(fs, kIsoLowHz);
  isoLp2_.setLowPass(fs, kIsoHighHz);
  isoHp2_.setHighPass(fs, kIsoHighHz);
  isoApLp_.setLowPass(fs, kIsoHighHz);
  isoApHp_.setHighPass(fs, kIsoHighHz);
  reset();
}

void ChannelStrip::reset() {
  trim_.reset(0.0f);
  for (auto& e : eq_) e.reset(0.0f);
  filter_.reset(0.0f);
  fader_.reset(1.0f);
  low_.reset();
  mid_.reset();
  high_.reset();
  isoLp1_.reset();
  isoHp1_.reset();
  isoLp2_.reset();
  isoHp2_.reset();
  isoApLp_.reset();
  isoApHp_.reset();
  svf_.reset();
  lastEqMode_ = -1;
  first_ = true;
}

void ChannelStrip::updateCoefficients(int eqMode) {
  const float lo = eq_[0].current(), mi = eq_[1].current(), hi = eq_[2].current();
  if (eqMode == lastEqMode_ && lo == lastEq_[0] && mi == lastEq_[1] && hi == lastEq_[2]) return;
  lastEqMode_ = eqMode;
  lastEq_[0] = lo;
  lastEq_[1] = mi;
  lastEq_[2] = hi;
  if (eqMode == 0) {
    low_.setCoeffs(BiquadCoeffs::lowShelf(fs_, kLowShelfHz, clampv(lo, -26.0f, 6.0f)));
    mid_.setCoeffs(BiquadCoeffs::peaking(fs_, kMidHz, 0.5, clampv(mi, -26.0f, 6.0f)));
    high_.setCoeffs(BiquadCoeffs::highShelf(fs_, kHighShelfHz, clampv(hi, -26.0f, 6.0f)));
  }
}

void ChannelStrip::process(float* l, float* r, int n, const ChannelParams& p, float* cueL, float* cueR) {
  trim_.setTarget(clampv(p.trimDb, -24.0f, 12.0f));
  for (int b = 0; b < 3; ++b) eq_[b].setTarget(p.eqDb[b]);
  filter_.setTarget(clampv(p.filter, -1.0f, 1.0f));
  fader_.setTarget(faderLaw(p.fader));
  if (first_) {
    first_ = false;
    trim_.reset(trim_.target());
    for (auto& e : eq_) e.reset(e.target());
    filter_.reset(filter_.target());
    fader_.reset(fader_.target());
  }
  peakL_ = peakR_ = 0.0f;

  for (int off = 0; off < n; off += kSubBlock) {
    const int m = std::min(kSubBlock, n - off);
    float* L = l + off;
    float* R = r + off;

    const float trimGain = dbToGain(trim_.step(smoothCoeff_));
    for (auto& e : eq_) e.step(smoothCoeff_);
    const float filt = filter_.step(smoothCoeff_);
    const float faderStart = fader_.current();
    const float faderEnd = fader_.step(smoothCoeff_);
    updateCoefficients(p.eqMode);

    // Filter: LPF cutoff sweeps 20 kHz -> 60 Hz, HPF 20 Hz -> 10 kHz. The wet
    // amount fades in over the first 5% of travel so the centre detent and the
    // LPF/HPF switch-over are click-free.
    const float amount = std::fabs(filt);
    const float wet = clampv(amount / 0.05f, 0.0f, 1.0f);
    const bool lowPass = filt < 0.0f;
    if (wet > 0.0f && (filt != lastFilter_ || p.resonance != lastRes_)) {
      const double cutoff = lowPass ? 20000.0 * std::pow(60.0 / 20000.0, double(amount))
                                    : 20.0 * std::pow(10000.0 / 20.0, double(amount));
      const double k = 1.414 - 1.2 * clampv(double(p.resonance), 0.0, 1.0);
      svf_.set(fs_, cutoff, k);
      lastFilter_ = filt;
      lastRes_ = p.resonance;
    }

    const float iLo = isoGain(eq_[0].current()), iMi = isoGain(eq_[1].current()), iHi = isoGain(eq_[2].current());
    for (int i = 0; i < m; ++i) {
      for (int ch = 0; ch < 2; ++ch) {
        float x = (ch == 0 ? L[i] : R[i]) * trimGain;
        if (p.eqMode == 0) {
          x = low_.tick(x, ch);
          x = mid_.tick(x, ch);
          x = high_.tick(x, ch);
        } else {
          const float lowBand = isoLp1_.tick(x, ch);
          const float rest = isoHp1_.tick(x, ch);
          const float lowAligned = isoApLp_.tick(lowBand, ch) + isoApHp_.tick(lowBand, ch);
          x = lowAligned * iLo + isoLp2_.tick(rest, ch) * iMi + isoHp2_.tick(rest, ch) * iHi;
        }
        if (wet > 0.0f) {
          float hp;
          const float lp = svf_.tick(x, ch, hp);
          x = x + ((lowPass ? lp : hp) - x) * wet;
        }
        if (ch == 0) L[i] = x; else R[i] = x;
      }
    }

    // Pre-fader cue tap, then the fader (ramped across the sub-block).
    if (cueL) {
      for (int i = 0; i < m; ++i) {
        cueL[off + i] += L[i];
        cueR[off + i] += R[i];
      }
    }
    const float dg = (faderEnd - faderStart) / float(m);
    float g = faderStart;
    for (int i = 0; i < m; ++i) {
      g += dg;
      L[i] *= g;
      R[i] *= g;
      peakL_ = std::max(peakL_, std::fabs(L[i]));
      peakR_ = std::max(peakR_, std::fabs(R[i]));
    }
  }
}

}  // namespace djn
