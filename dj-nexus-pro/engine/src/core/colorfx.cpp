#include "colorfx.h"

#include <algorithm>
#include <cmath>

namespace djn {

namespace {

inline float white(uint32_t& s) {
  s = s * 1664525u + 1013904223u;
  return float(int32_t(s)) * (1.0f / 2147483648.0f);
}

constexpr double kSpaceMs[4] = {37.1, 43.9, 53.3, 61.7};

}  // namespace

// ---------------------------------------------------------------- SmallReverb

void SmallReverb::setup(int sampleRate) {
  sr_ = sampleRate;
  for (int k = 0; k < 4; ++k) {
    len_[size_t(k)] = kSpaceMs[k] * 0.001 * sampleRate;
    lines_[size_t(k)].setup(size_t(len_[size_t(k)]) + 8);
  }
  dampC_ = float(1.0 - std::exp(-2.0 * kPi * 4500.0 / sampleRate));
  setDecay(2.5f);
}

void SmallReverb::clear() {
  for (auto& l : lines_) l.clear();
  damp_.fill(0.0f);
}

void SmallReverb::setDecay(float rt60) {
  if (rt60 == rt60_) return;
  rt60_ = rt60;
  for (int k = 0; k < 4; ++k) gain_[size_t(k)] = float(std::pow(10.0, -3.0 * len_[size_t(k)] / (rt60 * sr_)));
}

// ---------------------------------------------------------------- ColorFx

void ColorFx::setup(int sampleRate) {
  sr_ = sampleRate;
  for (auto& d : dl_) d.setup(size_t(2.5 * sampleRate) + 16);
  reverb_.setup(sampleRate);
  shifter_.setup(sampleRate);
  reset();
}

void ColorFx::reset() {
  svf_.reset();
  for (auto& d : dl_) d.clear();
  reverb_.clear();
  delay_ = 0.0;
  send_ = 0.0f;
  shifter_.reset();
  crushHold_[0] = crushHold_[1] = 0.0f;
  lastCut_ = -1.0f;
}

void ColorFx::process(float* l, float* r, int n, int type, float knob, float param, double bpm) {
  if (type != type_) {
    type_ = type;
    reset();
  }
  if (type <= int(ColorType::Filter) || type >= int(ColorType::Count)) return;

  knob = clampv(knob, -1.0f, 1.0f);
  param = clampv(param, 0.0f, 1.0f);
  const bool low = knob < 0.0f;
  const float mag = std::fabs(knob);
  // Dead zone around the centre detent, then a smooth curve.
  const float x = clampv((mag - 0.02f) / 0.98f, 0.0f, 1.0f);
  // Sends (noise, dub echo, space) respond linearly so a small turn is audible.
  const float amount = x;
  const float wet = clampv(x * 8.0f, 0.0f, 1.0f);  // fully wet within the first 1/8 of travel

  // The effect's own filter: left = low-pass, right = high-pass, milder than the main filter.
  const float cut = low ? float(20000.0 * std::pow(200.0 / 20000.0, double(mag)))
                        : float(30.0 * std::pow(4000.0 / 30.0, double(mag)));
  if (cut != lastCut_ || low != lastLow_) {
    svf_.set(sr_, cut, 1.2);
    lastCut_ = cut;
    lastLow_ = low;
  }
  const float sendStart = send_;
  const float ds = (amount - sendStart) / float(n);

  switch (ColorType(type)) {
    case ColorType::Noise: {
      // Filtered white noise on top of the music: left = dark rumble, right = hiss.
      const float level = 0.05f + 0.25f * param;
      for (int i = 0; i < n; ++i) {
        const float s = sendStart + ds * float(i + 1);
        float hpL, hpR;
        const float lpL = svf_.tick(white(noise_[0]), 0, hpL);
        const float lpR = svf_.tick(white(noise_[1]), 1, hpR);
        l[i] += (low ? lpL : hpL) * level * s;
        r[i] += (low ? lpR : hpR) * level * s;
      }
      break;
    }
    case ColorType::DubEcho: {
      // Echo send rises with the knob; repeats are filtered and saturated in the
      // feedback path. Returning the knob to centre stops the send but lets the
      // echoes ring out.
      double target = 0.75 * (bpm > 0 ? 60.0 / bpm : 0.5) * sr_;
      target = clampv(target, 0.05 * sr_, 2.4 * sr_);
      if (delay_ == 0.0) delay_ = target;
      const float fb = 0.4f + 0.5f * param;
      for (int i = 0; i < n; ++i) {
        const float s = sendStart + ds * float(i + 1);
        delay_ += (target - delay_) * 0.001;
        const float yl = dl_[0].read(delay_), yr = dl_[1].read(delay_);
        float hpL, hpR;
        const float lpL = svf_.tick(yl, 0, hpL), lpR = svf_.tick(yr, 1, hpR);
        const float fl = mag < 0.02f ? yl : (low ? lpL : hpL);
        const float fr = mag < 0.02f ? yr : (low ? lpR : hpR);
        dl_[0].push(l[i] * s + std::tanh(fl * fb * 1.2f) / 1.2f);
        dl_[1].push(r[i] * s + std::tanh(fr * fb * 1.2f) / 1.2f);
        l[i] += yl;
        r[i] += yr;
      }
      break;
    }
    case ColorType::Pitch: {
      // Left pitches down, right up, up to an octave.
      const double ratio = std::pow(2.0, double(knob));
      for (int i = 0; i < n; ++i) {
        float yl, yr;
        shifter_.process(l[i], r[i], ratio, yl, yr);
        l[i] += (yl - l[i]) * wet;
        r[i] += (yr - r[i]) * wet;
      }
      break;
    }
    case ColorType::Crush: {
      // Bit and sample-rate reduction, then the effect filter.
      const float bits = 16.0f - 12.0f * amount;
      const float step = 2.0f / std::pow(2.0f, bits);
      const int hold = 1 + int(amount * 12.0f);
      for (int i = 0; i < n; ++i) {
        if (crushCount_++ % hold == 0) {
          crushHold_[0] = l[i];
          crushHold_[1] = r[i];
        }
        const float cl = std::round(crushHold_[0] / step) * step;
        const float cr = std::round(crushHold_[1] / step) * step;
        float hpL, hpR;
        const float lpL = svf_.tick(cl, 0, hpL), lpR = svf_.tick(cr, 1, hpR);
        l[i] += ((low ? lpL : hpL) - l[i]) * wet;
        r[i] += ((low ? lpR : hpR) - r[i]) * wet;
      }
      break;
    }
    case ColorType::Space: {
      // Reverb send with a filtered return; the parameter sets the decay.
      reverb_.setDecay(1.0f + 5.0f * param);
      for (int i = 0; i < n; ++i) {
        const float s = sendStart + ds * float(i + 1);
        float rl, rr, hpL, hpR;
        reverb_.tick((l[i] + r[i]) * 0.5f * s * 0.8f, rl, rr);
        const float lpL = svf_.tick(rl, 0, hpL), lpR = svf_.tick(rr, 1, hpR);
        l[i] += (mag < 0.02f ? rl : (low ? lpL : hpL));
        r[i] += (mag < 0.02f ? rr : (low ? lpR : hpR));
      }
      break;
    }
    default: break;
  }
  send_ = amount;
}

}  // namespace djn
