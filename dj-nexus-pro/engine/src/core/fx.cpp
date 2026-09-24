#include "fx.h"

#include <algorithm>
#include <cmath>

#include "dsp.h"

namespace djn {

namespace {

size_t nextPow2(size_t v) {
  size_t p = 1;
  while (p < v) p <<= 1;
  return p;
}

inline double frac(double x) { return x - std::floor(x); }

// Reverb line lengths (ms): mutually prime-ish so the echoes don't line up.
constexpr double kReverbMs[8] = {31.7, 37.3, 41.9, 45.1, 53.3, 59.9, 67.3, 73.7};

}  // namespace

void DelayLine::setup(size_t minSize) {
  const size_t n = nextPow2(minSize);
  buf_.assign(n, 0.0f);
  mask_ = n - 1;
  count_ = 0;
  validFrom_ = 0;
}

void FxUnit::setup(int sampleRate, int /*maxBlock*/) {
  sr_ = sampleRate;
  // 16 s of history: echo times up to 8 s, and room for long rolls.
  for (auto& d : dl_) d.setup(size_t(16.0 * sampleRate) + 16);
  for (int k = 0; k < kLines; ++k) {
    rvLen_[size_t(k)] = kReverbMs[k] * 0.001 * sampleRate;
    rvLine_[size_t(k)].setup(size_t(rvLen_[size_t(k)]) + 8);
  }
  engageStep_ = float(1.0 / (0.004 * sampleRate));  // 4 ms on/off ramp
  echoLpC_ = float(1.0 - std::exp(-2.0 * kPi * 3500.0 / sampleRate));
  echoHpC_ = float(1.0 - std::exp(-2.0 * kPi * 120.0 / sampleRate));
  rvDampC_ = float(1.0 - std::exp(-2.0 * kPi * 5000.0 / sampleRate));
  resetEffect(type_);
}

void FxUnit::resetEffect(int type) {
  for (auto& d : dl_) d.clear();
  for (auto& line : rvLine_) line.clear();
  rvDamp_.fill(0.0f);
  delay_ = 0.0;
  fbLp_[0] = fbLp_[1] = fbHp_[0] = fbHp_[1] = 0.0f;
  for (auto& ch : apZ_) std::fill(std::begin(ch), std::end(ch), 0.0f);
  phFb_[0] = phFb_[1] = 0.0f;
  rolling_ = false;
  transGain_ = 1.0f;
  pitchPhase_ = 0.0;
  toneLp_[0] = toneLp_[1] = 0.0f;
  crushHold_[0] = crushHold_[1] = 0.0f;
  crushCount_ = 0;
  tail_ = false;
  (void)type;
}

void FxUnit::startRoll(const BeatClock& clock, double beats) {
  // The slice starts at the most recent grid line of the chosen division, so
  // the roll stays on the beat even when pressed a little late. Audio after
  // that line is already in the history; the first pass plays live.
  const double beatLen = beatSamples(clock);
  double len = beats * beatLen;
  len = clampv(len, 32.0, 8.0 * sr_);
  const double since = frac(clock.at(0) / beats) * len;
  rollLen_ = int64_t(len);
  rollElapsed_ = int64_t(since);
  rollStart_ = dl_[0].count() - rollElapsed_;
  rollBeats_ = beats;
  rolling_ = true;
}

void FxUnit::echo(float xl, float xr, float gate, float& yl, float& yr, float fb, bool filtered) {
  yl = dl_[0].read(delay_);
  yr = dl_[1].read(delay_);
  float fl = yl, fr = yr;
  if (filtered) {
    // Darken and thin the repeats like a tape echo: LP ~3.5 kHz, HP ~120 Hz.
    const float lpC = echoLpC_, hpC = echoHpC_;
    fbLp_[0] += lpC * (fl - fbLp_[0]);
    fbLp_[1] += lpC * (fr - fbLp_[1]);
    fbHp_[0] += hpC * (fbLp_[0] - fbHp_[0]);
    fbHp_[1] += hpC * (fbLp_[1] - fbHp_[1]);
    fl = fbLp_[0] - fbHp_[0];
    fr = fbLp_[1] - fbHp_[1];
  }
  dl_[0].push(xl * gate + fl * fb);
  dl_[1].push(xr * gate + fr * fb);
}

void FxUnit::pingPong(float xl, float xr, float gate, float& yl, float& yr, float fb) {
  yl = dl_[0].read(delay_);
  yr = dl_[1].read(delay_);
  // Mono input enters on the left; each repeat crosses to the other side.
  dl_[0].push((xl + xr) * 0.5f * gate + yr * fb);
  dl_[1].push(yl * fb);
}

void FxUnit::reverb(float xl, float xr, float gate, float& yl, float& yr) {
  const float in = (xl + xr) * 0.5f * gate * 0.35f;
  float o[kLines];
  float sum = 0.0f;
  const float damp = rvDampC_;  // one-pole low-pass in each line: air absorbs highs
  for (int k = 0; k < kLines; ++k) {
    const float v = rvLine_[size_t(k)].read(rvLen_[size_t(k)]);
    rvDamp_[size_t(k)] += damp * (v - rvDamp_[size_t(k)]);
    o[k] = rvDamp_[size_t(k)] * rvGain_[size_t(k)];
    sum += o[k];
  }
  // Householder feedback matrix: lossless mixing of all lines.
  const float h = sum * (2.0f / kLines);
  for (int k = 0; k < kLines; ++k) rvLine_[size_t(k)].push(o[k] - h + (k & 1 ? -in : in));
  yl = (o[0] - o[2] + o[4] - o[6]) * 0.7f;
  yr = (o[1] - o[3] + o[5] - o[7]) * 0.7f;
}

void FxUnit::process(float* l, float* r, int n, const FxParams& p, const BeatClock& clock) {
  const int type = clampv(p.type, 0, int(FxType::Count) - 1);
  const double beats = clampv(p.beats, 1.0 / 16.0, 16.0);
  const float depth = clampv(p.depth, 0.0f, 1.0f);
  const bool historyType = type == int(FxType::Roll) || type == int(FxType::Stutter);

  if (type != type_) {
    type_ = type;
    resetEffect(type);
    lastOn_ = false;
  }

  // Idle: nothing to do, but roll/stutter keep recording history so a roll
  // can start from the last beat line.
  if (!p.on && engage_ == 0.0f && !tail_) {
    if (historyType) {
      for (int i = 0; i < n; ++i) {
        dl_[0].push(l[i]);
        dl_[1].push(r[i]);
      }
    }
    lastOn_ = false;
    wet_ = p.wet;
    return;
  }

  if (p.on && !lastOn_) {
    if (historyType) startRoll(clock, beats);
    tail_ = false;
  }
  if (p.on && historyType && rolling_ && beats != rollBeats_) startRoll(clock, beats);
  if (!p.on && lastOn_ && isSend(type)) {
    tail_ = true;
    silentSamples_ = 0;
  }
  lastOn_ = p.on;

  const float target = p.on ? 1.0f : 0.0f;
  const float wetStart = wet_, wetEnd = clampv(p.wet, 0.0f, 1.0f);
  const float dw = (wetEnd - wetStart) / float(n);
  const double beatLen = beatSamples(clock);
  float tailPeak = 0.0f;

  // Delay time for echo-type effects: the division, halved until it fits.
  double div = beats * beatLen;
  while (div > 8.0 * sr_) div *= 0.5;
  div = std::max(16.0, div);
  if (delay_ == 0.0) delay_ = div;

  if (type == int(FxType::Reverb)) {
    const float rt60 = 0.5f + depth * 9.5f;
    if (rt60 != rvDecay_) {
      rvDecay_ = rt60;
      for (int k = 0; k < kLines; ++k) rvGain_[size_t(k)] = float(std::pow(10.0, -3.0 * rvLen_[size_t(k)] / (rt60 * sr_)));
    }
  }

  float apCoef = apCoef_;
  const float fbEcho = 0.35f + 0.55f * depth;
  const float fbDelay = 0.6f * depth;
  const int semis = int(std::lround((depth - 0.5f) * 24.0f));
  const double pitchRatio = std::pow(2.0, semis / 12.0);
  const double pitchWin = 0.06 * sr_;
  const float drive = 1.0f + depth * 30.0f;
  const float driveNorm = 1.0f / std::tanh(drive);
  const float toneC = float(1.0 - std::exp(-2.0 * kPi * 6500.0 / sr_));
  const float bits = 16.0f - depth * 13.0f;
  const float step = 2.0f / std::pow(2.0f, bits);
  const int hold = 1 + int(depth * 15.0f);

  for (int i = 0; i < n; ++i) {
    if (engage_ != target) {
      engage_ = target > engage_ ? std::min(target, engage_ + engageStep_) : std::max(target, engage_ - engageStep_);
    }
    const float w = wetStart + dw * float(i + 1);
    const float xl = l[i], xr = r[i];
    float yl = xl, yr = xr;

    switch (FxType(type)) {
      case FxType::Echo:
      case FxType::Delay:
      case FxType::PingPong: {
        delay_ += (div - delay_) * 0.002;  // glide on tempo / division changes
        if (type == int(FxType::PingPong)) pingPong(xl, xr, engage_, yl, yr, fbEcho);
        else echo(xl, xr, engage_, yl, yr, type == int(FxType::Echo) ? fbEcho : fbDelay, type == int(FxType::Echo));
        tailPeak = std::max(tailPeak, std::max(std::fabs(yl), std::fabs(yr)));
        l[i] = xl + yl * w;
        r[i] = xr + yr * w;
        continue;
      }
      case FxType::Reverb: {
        reverb(xl, xr, engage_, yl, yr);
        tailPeak = std::max(tailPeak, std::max(std::fabs(yl), std::fabs(yr)));
        l[i] = xl + yl * w;
        r[i] = xr + yr * w;
        continue;
      }
      case FxType::Flanger: {
        const double ph = frac(clock.at(i) / beats);
        const double tri = 1.0 - std::fabs(2.0 * ph - 1.0);
        const double d = (0.3 + 3.2 * tri) * 0.001 * sr_;
        const float fb = 0.2f + 0.7f * depth;
        const float dl = dl_[0].read(d), dr = dl_[1].read(d);
        dl_[0].push(xl + fb * dl);
        dl_[1].push(xr + fb * dr);
        yl = 0.65f * (xl + dl);
        yr = 0.65f * (xr + dr);
        break;
      }
      case FxType::Phaser: {
        if ((i & 15) == 0) {
          const double ph = frac(clock.at(i) / beats);
          const double lfo = 0.5 - 0.5 * std::cos(2.0 * kPi * ph);
          const double f = 200.0 * std::pow(20.0, lfo);  // 200 Hz .. 4 kHz
          const double t = std::tan(kPi * std::min(f, 0.45 * sr_) / sr_);
          apCoef = float((t - 1.0) / (t + 1.0));
        }
        const float fb = 0.2f + 0.6f * depth;
        for (int ch = 0; ch < 2; ++ch) {
          float in = (ch == 0 ? xl : xr) + phFb_[ch] * fb;
          for (int s = 0; s < 6; ++s) {
            const float y = apCoef * in + apZ_[ch][s];
            apZ_[ch][s] = in - apCoef * y;
            in = y;
          }
          phFb_[ch] = in;
          (ch == 0 ? yl : yr) = 0.5f * ((ch == 0 ? xl : xr) + in);
        }
        break;
      }
      case FxType::Roll:
      case FxType::Stutter: {
        dl_[0].push(xl);
        dl_[1].push(xr);
        if (rolling_) {
          const int64_t t = rollElapsed_ % rollLen_;
          const int64_t idx = rollStart_ + t;
          const float ramp = float(std::min<int64_t>(48, rollLen_ / 4));
          float e = std::min(1.0f, std::min(float(t) / ramp, float(rollLen_ - t) / ramp));
          if (type == int(FxType::Stutter)) {
            // Gate each repeat to 55% of the slice for the classic stutter.
            const float gateEnd = 0.55f * float(rollLen_);
            if (float(t) > gateEnd) e = std::max(0.0f, 1.0f - (float(t) - gateEnd) / ramp);
          }
          yl = dl_[0].readAbs(idx) * e;
          yr = dl_[1].readAbs(idx) * e;
          ++rollElapsed_;
        }
        break;
      }
      case FxType::Trans: {
        const double ph = frac(clock.at(i) / beats);
        const float tg = ph < 0.5 ? 1.0f : 1.0f - depth;
        transGain_ += (tg - transGain_) * 0.02f;  // ~1 ms edges
        yl = xl * transGain_;
        yr = xr * transGain_;
        break;
      }
      case FxType::Pitch: {
        dl_[0].push(xl);
        dl_[1].push(xr);
        // Two crossfading read heads sweep a 60 ms window at the pitch ratio.
        pitchPhase_ = frac(pitchPhase_ + (1.0 - pitchRatio) / pitchWin);
        const double p2 = frac(pitchPhase_ + 0.5);
        const double d1 = 2.0 + pitchPhase_ * pitchWin, d2 = 2.0 + p2 * pitchWin;
        const float g1 = float(1.0 - std::fabs(2.0 * pitchPhase_ - 1.0)), g2 = 1.0f - g1;
        yl = dl_[0].read(d1) * g1 + dl_[0].read(d2) * g2;
        yr = dl_[1].read(d1) * g1 + dl_[1].read(d2) * g2;
        break;
      }
      case FxType::Distortion: {
        const float dl = std::tanh(drive * xl) * driveNorm * 0.8f;
        const float dr = std::tanh(drive * xr) * driveNorm * 0.8f;
        toneLp_[0] += toneC * (dl - toneLp_[0]);
        toneLp_[1] += toneC * (dr - toneLp_[1]);
        yl = toneLp_[0];
        yr = toneLp_[1];
        break;
      }
      case FxType::Crush: {
        if (crushCount_++ % hold == 0) {
          crushHold_[0] = xl;
          crushHold_[1] = xr;
        }
        yl = std::round(crushHold_[0] / step) * step;
        yr = std::round(crushHold_[1] / step) * step;
        break;
      }
      case FxType::Count: break;
    }
    // Insert effects: blend towards the processed signal.
    const float m = w * engage_;
    l[i] = xl + (yl - xl) * m;
    r[i] = xr + (yr - xr) * m;
  }
  wet_ = wetEnd;
  apCoef_ = apCoef;

  if (!p.on && engage_ == 0.0f) {
    rolling_ = false;
    if (tail_) {
      // Tail over after ~300 ms below -100 dB.
      silentSamples_ = tailPeak < 1e-5f ? silentSamples_ + n : 0;
      if (silentSamples_ > int(0.3 * sr_)) {
        tail_ = false;
        resetEffect(type);
      }
    }
  }
}

}  // namespace djn
