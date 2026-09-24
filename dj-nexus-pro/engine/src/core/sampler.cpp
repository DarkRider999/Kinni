#include "sampler.h"

#include <algorithm>
#include <cmath>

#include "dsp.h"

namespace djn {

void Sampler::setup(int sampleRate, int maxBlock) {
  sampleRate_ = sampleRate;
  tmpL_.assign(size_t(maxBlock), 0.0f);
  tmpR_.assign(size_t(maxBlock), 0.0f);
  for (auto& v : voices_) v.stretcher.setup(sampleRate, maxBlock);
  attackStep_ = float(1.0 / (0.001 * sampleRate));   // 1 ms attack: no click at the sample start
  releaseStep_ = float(1.0 / (0.008 * sampleRate));  // 8 ms release
}

Track* Sampler::load(int slot, Track* sample) {
  if (!valid(slot)) return sample;
  for (auto& v : voices_) {
    if (v.active && v.slot == slot) v.active = false;  // the old sample is about to be freed
  }
  Track* old = slots_[size_t(slot)].track;
  slots_[size_t(slot)].track = sample;
  return old;
}

Sampler::Voice* Sampler::allocateVoice() {
  Voice* oldest = &voices_[0];
  for (auto& v : voices_) {
    if (!v.active) return &v;
    if (v.age < oldest->age) oldest = &v;
  }
  return oldest;  // steal the oldest voice
}

void Sampler::trigger(int slot, float velocity, const BeatClock& clock, double quantizeBeats) {
  if (!valid(slot)) return;
  const Slot& s = slots_[size_t(slot)];
  if (!s.track) return;

  // Toggle: a second press stops the loop instead of restarting it.
  if (s.mode == kToggle) {
    bool wasPlaying = false;
    for (auto& v : voices_) {
      if (v.active && v.slot == slot && !v.releasing) {
        releaseVoice(v);
        wasPlaying = true;
      }
    }
    if (wasPlaying) return;
  }
  // Retrigger restarts the pad; a choke group silences its other pads.
  for (auto& v : voices_) {
    if (!v.active || v.releasing) continue;
    if (v.slot == slot || (s.choke > 0 && slots_[size_t(v.slot)].choke == s.choke)) releaseVoice(v);
  }

  int delay = 0;
  if (quantizeBeats > 0 && clock.beatsPerSample > 0) {
    // Start on the next grid line, unless we are only just past one (<30 ms):
    // then start now, as a DJ pressing slightly late expects.
    const double b = clock.at(0) / quantizeBeats;
    const double pastLine = (b - std::floor(b)) * quantizeBeats / clock.beatsPerSample;
    if (pastLine > 0.03 * sampleRate_) {
      const double toNext = (std::ceil(b) - b) * quantizeBeats / clock.beatsPerSample;
      delay = int(std::min(toNext, 8.0 * sampleRate_));
    }
  }

  Voice* v = allocateVoice();
  v->active = true;
  v->slot = slot;
  v->pos = 0.0;
  v->startDelay = delay;
  v->velocity = clampv(velocity, 0.0f, 1.0f);
  v->env = 0.0f;
  v->releasing = false;
  v->stretching = false;
  v->age = ++ageCounter_;
}

void Sampler::release(int slot) {
  if (!valid(slot)) return;
  const int mode = slots_[size_t(slot)].mode;
  if (mode != kGate && mode != kLoop) return;  // one-shots and toggles ignore release
  for (auto& v : voices_) {
    if (v.active && v.slot == slot) releaseVoice(v);
  }
}

void Sampler::stopAll() {
  for (auto& v : voices_) {
    if (v.active) releaseVoice(v);
  }
}

inline float Sampler::readCubic(const Track& t, const float* ch, double p) const {
  p = clampv(p, -double(t.pad) + 2.0, double(t.frames + t.pad) - 3.0);
  const int64_t i = int64_t(std::floor(p));
  const float f = float(p - double(i));
  const float xm1 = ch[i - 1], x0 = ch[i], x1 = ch[i + 1], x2 = ch[i + 2];
  const float a = -0.5f * xm1 + 1.5f * x0 - 1.5f * x1 + 0.5f * x2;
  const float b = xm1 - 2.5f * x0 + 2.0f * x1 - 0.5f * x2;
  const float c = -0.5f * xm1 + 0.5f * x1;
  return ((a * f + b) * f + c) * f + x0;
}

void Sampler::render(float* l, float* r, int n, const BeatClock& clock) {
  for (auto& v : voices_) {
    if (!v.active) continue;
    const Slot& s = slots_[size_t(v.slot)];
    const Track* t = s.track;
    if (!t) {
      v.active = false;
      continue;
    }
    int start = std::min(v.startDelay, n);
    v.startDelay -= start;
    if (start >= n) continue;
    const int m = n - start;
    const bool loop = looping(s.mode);
    const float gain = dbToGain(clampv(s.gainDb, -60.0f, 12.0f)) * v.velocity;
    const double frames = double(t->frames);

    // Synced loops keep their pitch and follow the master tempo (key lock).
    const bool wantStretch = loop && s.sync && t->bpm > 0 && clock.bpm > 0 &&
                             clock.bpm / t->bpm >= Stretcher::kMinRate && clock.bpm / t->bpm <= Stretcher::kMaxRate;
    if (wantStretch) {
      const double rate = clock.bpm / t->bpm;
      if (!v.stretching) {
        v.stretcher.setLoop(true, 0.0, frames);
        v.stretcher.reset(*t, v.pos, rate);
        v.stretching = true;
      }
      v.stretcher.process(*t, rate, tmpL_.data(), tmpR_.data(), m);
      v.pos = v.stretcher.position();
    } else {
      v.stretching = false;
      const double rate = std::pow(2.0, clampv(s.pitch, -24.0f, 24.0f) / 12.0);
      for (int i = 0; i < m; ++i) {
        if (v.pos >= frames) {
          if (loop) {
            v.pos -= frames;
          } else {
            tmpL_[size_t(i)] = tmpR_[size_t(i)] = 0.0f;
            continue;
          }
        }
        tmpL_[size_t(i)] = readCubic(*t, t->l(), v.pos);
        tmpR_[size_t(i)] = readCubic(*t, t->r(), v.pos);
        v.pos += rate;
      }
    }

    for (int i = 0; i < m; ++i) {
      if (v.releasing) {
        v.env -= releaseStep_;
        if (v.env <= 0.0f) {
          v.env = 0.0f;
          v.active = false;
          break;
        }
      } else if (v.env < 1.0f) {
        v.env = std::min(1.0f, v.env + attackStep_);
      }
      const float g = gain * v.env;
      l[start + i] += tmpL_[size_t(i)] * g;
      r[start + i] += tmpR_[size_t(i)] * g;
    }
    if (!loop && v.pos >= frames) v.active = false;  // one-shot / gate reached the end
  }
}

uint64_t Sampler::loadedMask() const {
  uint64_t m = 0;
  for (int s = 0; s < kSlots; ++s) {
    if (slots_[size_t(s)].track) m |= uint64_t(1) << s;
  }
  return m;
}

uint64_t Sampler::playingMask() const {
  uint64_t m = 0;
  for (const auto& v : voices_) {
    if (v.active && !v.releasing) m |= uint64_t(1) << v.slot;
  }
  return m;
}

}  // namespace djn
