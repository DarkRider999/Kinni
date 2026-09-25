#include "deck.h"

#include <algorithm>
#include <cmath>

#include "dsp.h"

namespace djn {

void Deck::setup(int sampleRate, int maxBlock) {
  sampleRate_ = sampleRate;
  stretcher_.setup(sampleRate, maxBlock);
}

Track* Deck::load(Track* track) {
  Track* old = track_;
  track_ = track;
  playing_ = false;
  pos_ = 0.0;
  cuePoint_ = 0.0;
  hotCueSet_.fill(false);
  looping_ = false;
  stretcher_.setLoop(false, 0, 0);
  pendingLoopIn_ = -1.0;
  playGain_ = 0.0f;
  stretching_ = false;
  xfadeRemaining_ = 0;
  slipPos_ = 0.0;
  wasExcursion_ = false;
  lastRate_ = 0.0;
  touched_ = false;
  nudge_ = 0.0;
  stemTarget_.fill(1.0f);  // a new track starts with every stem up
  stemGain_.fill(1.0f);
  return old;
}

Track* Deck::attachStems(Track* carrier) {
  if (track_ && carrier && carrier->stems && carrier->stemsFor == track_->serial &&
      carrier->stems->frames == track_->frames && carrier->stems->pad == track_->pad) {
    track_->stems.swap(carrier->stems);  // the carrier takes the old stems away
  }
  return carrier;
}

void Deck::setStemGain(int stem, float gain) {
  if (stem >= 0 && stem < 4) stemTarget_[size_t(stem)] = clampv(gain, 0.0f, 1.0f);
}

Track* Deck::unload() { return load(nullptr); }

void Deck::play() {
  if (!track_ || pos_ >= double(track_->frames)) return;
  playing_ = true;
  if (sync_) pendingPhaseSnap_ = true;
}

void Deck::pause() { playing_ = false; }

void Deck::cue() {
  if (!track_) return;
  if (playing_) {
    // Back to the cue point and stop. The old stream fades out; the new
    // position stays silent because playback stops.
    const double oldPos = stretching_ ? stretcher_.position() : pos_;
    xfadePos_ = oldPos;
    xfadeRemaining_ = playGain_ > 0 ? kXfadeLen : 0;
    playing_ = false;
    playGain_ = 0.0f;
    stretching_ = false;
    pos_ = cuePoint_;
    return;
  }
  cuePoint_ = (quantize_ && hasGrid()) ? snapToBeat(pos_) : pos_;
  cuePoint_ = clampv(cuePoint_, 0.0, double(track_->frames));
  pos_ = cuePoint_;
  stretching_ = false;
}

void Deck::seekSeconds(double s) {
  if (!track_) return;
  jumpTo(s * sampleRate_);
}

void Deck::hotCueSet(int slot) {
  if (!track_ || slot < 0 || slot >= int(hotCues_.size())) return;
  hotCues_[size_t(slot)] = (quantize_ && hasGrid()) ? snapToBeat(pos_) : pos_;
  hotCueSet_[size_t(slot)] = true;
}

void Deck::hotCueSetAt(int slot, double seconds) {
  if (!track_ || slot < 0 || slot >= int(hotCues_.size())) return;
  hotCues_[size_t(slot)] = clampv(seconds * sampleRate_, 0.0, double(track_->frames));
  hotCueSet_[size_t(slot)] = true;
}

void Deck::hotCueTrigger(int slot) {
  if (!track_ || slot < 0 || slot >= int(hotCues_.size())) return;
  if (!hotCueSet_[size_t(slot)]) {
    hotCueSet(slot);  // an empty pad stores the current position, like a CDJ
    return;
  }
  double target = hotCues_[size_t(slot)];
  if (playing_ && quantize_ && hasGrid()) target = phasePreservingTarget(target);
  jumpTo(target);
  if (!playing_) play();
}

void Deck::hotCueClear(int slot) {
  if (slot < 0 || slot >= int(hotCues_.size())) return;
  hotCueSet_[size_t(slot)] = false;
}

void Deck::loopIn() {
  if (!track_) return;
  pendingLoopIn_ = (quantize_ && hasGrid()) ? snapToBeat(pos_) : pos_;
}

void Deck::loopOut() {
  if (!track_ || pendingLoopIn_ < 0 || pos_ <= pendingLoopIn_) return;
  loopStart_ = pendingLoopIn_;
  if (quantize_ && hasGrid()) {
    const double fpb = track_->framesPerBeat();
    const double beats = std::max(1.0, std::round((pos_ - loopStart_) / fpb));
    loopEnd_ = loopStart_ + beats * fpb;
  } else {
    loopEnd_ = pos_;
  }
  setLoopActive(true);
  if (pos_ >= loopEnd_) jumpTo(loopStart_ + std::fmod(pos_ - loopStart_, loopEnd_ - loopStart_));
}

void Deck::loopBeats(double beats) {
  if (!hasGrid()) return;
  beats = clampv(beats, 1.0 / 32.0, 64.0);
  const double fpb = track_->framesPerBeat();
  const double len = beats * fpb;
  if (looping_ && std::fabs((loopEnd_ - loopStart_) - len) < 1.0) {
    loopExit();  // pressing the active loop length again exits it
    return;
  }
  double start = pos_;
  if (quantize_) {
    const double unit = std::min(beats, 1.0) * fpb;
    start = track_->firstBeatFrame + std::floor((pos_ - track_->firstBeatFrame) / unit) * unit;
  }
  loopStart_ = start;
  loopEnd_ = start + len;
  setLoopActive(true);
}

void Deck::loopExit() { setLoopActive(false); }

void Deck::loopHalve() {
  if (!looping_) return;
  const double minLen = hasGrid() ? track_->framesPerBeat() / 32.0 : 32.0;
  const double len = std::max(minLen, (loopEnd_ - loopStart_) / 2.0);
  loopEnd_ = loopStart_ + len;
  setLoopActive(true);
  if (pos_ >= loopEnd_) jumpTo(loopStart_ + std::fmod(pos_ - loopStart_, len));
}

void Deck::loopDouble() {
  if (!looping_ || !track_) return;
  loopEnd_ = std::min(double(track_->frames), loopStart_ + 2.0 * (loopEnd_ - loopStart_));
  setLoopActive(true);
}

void Deck::setPitch(double p) { pitch_ = clampv(p, -0.5, 0.5); }

void Deck::slipRoll(bool on, double beats) {
  if (on) {
    if (!hasGrid()) return;  // rolls are defined in beats
    beats = clampv(beats, 1.0 / 16.0, 4.0);
    if (!slipRoll_ && !censor_) savedSlip_ = slip_;
    slip_ = true;
    slipRoll_ = true;
    // The slice starts on the latest grid line of the division (at most a beat
    // back), so the current position is inside it and nothing jumps now.
    const double fpb = track_->framesPerBeat();
    const double unit = std::min(beats, 1.0) * fpb;
    loopStart_ = track_->firstBeatFrame + std::floor((pos_ - track_->firstBeatFrame) / unit) * unit;
    loopEnd_ = loopStart_ + beats * fpb;
    setLoopActive(true);
  } else if (slipRoll_) {
    slipRoll_ = false;
    setLoopActive(false);
    if (!censor_) restoreSlip_ = true;  // after the slip return in render()
  }
}

void Deck::censor(bool on) {
  if (!track_) return;
  if (on) {
    if (!slipRoll_ && !censor_) savedSlip_ = slip_;
    slip_ = true;
    censor_ = true;
    reverse_ = true;
  } else if (censor_) {
    censor_ = false;
    reverse_ = false;
    if (!slipRoll_) restoreSlip_ = true;
  }
}

void Deck::setSlip(bool on) {
  slip_ = on;
  slipPos_ = pos_;
}

void Deck::setSync(bool on) {
  sync_ = on;
  pendingPhaseSnap_ = on;
}

void Deck::jog(bool touched, double rate) {
  if (touched) {
    touched_ = true;
    jogRate_ = clampv(rate, -8.0, 8.0);
    nudge_ = 0.0;
  } else {
    touched_ = false;
    nudge_ = clampv(rate, -0.5, 0.5);
  }
}

void Deck::setGrid(double bpm, double firstBeatSec) {
  if (!track_) return;
  track_->bpm = bpm > 0 ? bpm : 0.0;
  track_->firstBeatFrame = firstBeatSec * sampleRate_;
  if (!hasGrid()) sync_ = false;
}

void Deck::setLoopActive(bool on) {
  looping_ = on && loopEnd_ > loopStart_;
  stretcher_.setLoop(looping_, loopStart_, loopEnd_);
}

double Deck::snapToBeat(double p) const {
  const double fpb = track_->framesPerBeat();
  const double fb = track_->firstBeatFrame;
  return fb + std::round((p - fb) / fpb) * fpb;
}

double Deck::phasePreservingTarget(double target) const {
  const double fpb = track_->framesPerBeat();
  const double fb = track_->firstBeatFrame;
  const double beatsNow = (pos_ - fb) / fpb;
  const double frac = beatsNow - std::floor(beatsNow);
  return fb + (std::round((target - fb) / fpb) + frac) * fpb;
}

double Deck::beatPhase() const {
  if (!hasGrid()) return -1.0;
  const double b = (pos_ - track_->firstBeatFrame) / track_->framesPerBeat();
  return b - std::floor(b);
}

void Deck::jumpTo(double newPos) {
  if (!track_) return;
  newPos = clampv(newPos, 0.0, double(track_->frames));
  if (looping_ && (newPos < loopStart_ || newPos >= loopEnd_)) setLoopActive(false);
  const double oldPos = stretching_ ? stretcher_.position() : pos_;
  if (playGain_ > 0.0f) {
    xfadePos_ = oldPos;
    xfadeRemaining_ = kXfadeLen;
  }
  pos_ = newPos;
  if (stretching_) stretcher_.reset(*track_, pos_, lastRate_ > 0 ? lastRate_ : tempoRate_);
}

inline float Deck::readCubic(const float* ch, double p) const {
  const double lo = -double(track_->pad) + 2.0;
  const double hi = double(track_->frames + track_->pad) - 3.0;
  p = clampv(p, lo, hi);
  const int64_t i = int64_t(std::floor(p));
  const float t = float(p - double(i));
  const float xm1 = ch[i - 1], x0 = ch[i], x1 = ch[i + 1], x2 = ch[i + 2];
  // Catmull-Rom spline
  const float a = -0.5f * xm1 + 1.5f * x0 - 1.5f * x1 + 0.5f * x2;
  const float b = xm1 - 2.5f * x0 + 2.0f * x1 - 0.5f * x2;
  const float c = -0.5f * xm1 + 0.5f * x1;
  return ((a * t + b) * t + c) * t + x0;
}

inline float Deck::readMix(int ch, double p, const float* g) const {
  if (!g) return readCubic(ch == 0 ? track_->l() : track_->r(), p);
  const double lo = -double(track_->pad) + 2.0;
  const double hi = double(track_->frames + track_->pad) - 3.0;
  p = clampv(p, lo, hi);
  const int64_t i = int64_t(std::floor(p));
  const float t = float(p - double(i));
  const float xm1 = stemMixAt(*track_, ch, i - 1, g), x0 = stemMixAt(*track_, ch, i, g);
  const float x1 = stemMixAt(*track_, ch, i + 1, g), x2 = stemMixAt(*track_, ch, i + 2, g);
  const float a = -0.5f * xm1 + 1.5f * x0 - 1.5f * x1 + 0.5f * x2;
  const float b = xm1 - 2.5f * x0 + 2.0f * x1 - 0.5f * x2;
  const float c = -0.5f * xm1 + 0.5f * x1;
  return ((a * t + b) * t + c) * t + x0;
}

void Deck::render(float* outL, float* outR, int n, const SyncRef& ref, bool isMaster) {
  std::fill(outL, outL + n, 0.0f);
  std::fill(outR, outR + n, 0.0f);
  if (!track_) return;

  const bool active = playing_ || touched_;
  if (!active && playGain_ == 0.0f && xfadeRemaining_ == 0) {
    // Paused: keep the tempo readout current so a paused master still drives sync.
    if (!sync_ || isMaster || !ref.valid || !hasGrid()) tempoRate_ = 1.0 + pitch_;
    lastRate_ = 0.0;
    stretching_ = false;
    if (!inExcursion()) slipPos_ = pos_;
    if (restoreSlip_) {  // released while paused: nothing to return to
      slip_ = savedSlip_;
      restoreSlip_ = false;
    }
    return;
  }

  // Slip: when a loop / reverse / scratch ends, continue where the track would be.
  const bool excursion = inExcursion();
  if (slip_ && wasExcursion_ && !excursion) jumpTo(slipPos_);
  wasExcursion_ = excursion;
  if (restoreSlip_) {
    slip_ = savedSlip_;
    restoreSlip_ = false;
  }

  // ---- tempo
  const double fpb = track_->framesPerBeat();
  bool phaseLockable = false;
  if (sync_ && !isMaster && ref.valid && hasGrid()) {
    const double r0 = ref.bpm / track_->bpm;
    // Follow half or double time when that is closer to the track's own tempo.
    double best = r0;
    for (double m : {0.5, 2.0}) {
      if (std::fabs(std::log(r0 * m)) < std::fabs(std::log(best))) best = r0 * m;
    }
    tempoRate_ = best;
    phaseLockable = best == r0;
  } else {
    tempoRate_ = 1.0 + pitch_;
  }

  double rate = tempoRate_ + nudge_;
  if (phaseLockable && ref.playing && playing_ && !touched_) {
    double e = beatPhase() - ref.phase;
    if (e > 0.5) e -= 1.0;
    if (e <= -0.5) e += 1.0;
    if (pendingPhaseSnap_) {
      if (std::fabs(e) > 0.02) jumpTo(pos_ - e * fpb);
      pendingPhaseSnap_ = false;
    } else {
      // Phase-locked loop: remove the remaining error over ~250 ms.
      const double correction = -e / 0.25 * 60.0 / track_->bpm;
      rate += clampv(correction, -0.03, 0.03);
    }
  }
  if (reverse_) rate = -rate;
  if (touched_) rate = jogRate_;
  if (!active) rate = lastRate_;  // keep moving while the pause ramp finishes
  const double rateStart = stretching_ || lastRate_ == 0.0 ? rate : lastRate_;

  // ---- engine choice: key-lock stretcher or varispeed
  const bool wantStretch = keyLock_ && !touched_ && rate >= Stretcher::kMinRate && rate <= Stretcher::kMaxRate;
  if (wantStretch != stretching_) {
    if (stretching_) pos_ = stretcher_.position();
    if (playGain_ > 0.0f) {
      xfadePos_ = pos_;
      xfadeRemaining_ = kXfadeLen;
    }
    if (wantStretch) stretcher_.reset(*track_, pos_, rate);
    stretching_ = wantStretch;
  }

  const double frames = double(track_->frames);
  // Stems: gains glide from last block's values to the targets over this block.
  bool stemsActive = false;
  if (track_->stems) {
    for (size_t k = 0; k < 4; ++k) stemsActive = stemsActive || stemGain_[k] != 1.0f || stemTarget_[k] != 1.0f;
  }
  const std::array<float, 4> g0 = stemGain_;
  float gs[4] = {1.0f, 1.0f, 1.0f, 1.0f};
  const float* gp = stemsActive ? gs : nullptr;
  auto gainsAt = [&](int i) {
    if (!stemsActive) return;
    const float f = float(i + 1) / float(n);
    for (size_t k = 0; k < 4; ++k) gs[k] = g0[k] + (stemTarget_[k] - g0[k]) * f;
  };
  stemBlock_ = stemTarget_;
  stretcher_.setStemGains(stemsActive ? stemBlock_.data() : nullptr);
  stemGain_ = stemTarget_;
  const float gainStep = 1.0f / (0.004f * float(sampleRate_));  // 4 ms play/pause ramp
  const float gainTarget = active ? 1.0f : 0.0f;
  bool reachedEnd = false;
  // After a cue-stop only the old stream's fade-out is rendered.
  const bool renderMain = active || playGain_ > 0.0f;
  const double dr = (rate - rateStart) / n;

  // Blends the old stream (after a jump, loop wrap or mode switch) into sample i.
  auto blendOld = [&](int i, double r) {
    if (xfadeRemaining_ <= 0) return;
    const float g = float(xfadeRemaining_) / float(kXfadeLen);
    const float g2 = g * g;  // steeper fade-out for the old stream
    gainsAt(i);
    outL[i] = outL[i] * (1.0f - g2) + readMix(0, xfadePos_, gp) * g2;
    outR[i] = outR[i] * (1.0f - g2) + readMix(1, xfadePos_, gp) * g2;
    xfadePos_ += r;
    --xfadeRemaining_;
  };

  if (!renderMain) {
    double r = rateStart;
    for (int i = 0; i < n && xfadeRemaining_ > 0; ++i) blendOld(i, r += dr);
  } else {
    if (stretching_) {
      stretcher_.setLoop(looping_, loopStart_, loopEnd_);
      stretcher_.process(*track_, rate, outL, outR, n);
      pos_ = stretcher_.position();
      if (looping_ && pos_ >= loopEnd_) pos_ -= (loopEnd_ - loopStart_);
      if (pos_ >= frames) reachedEnd = true;
      double r = rateStart;
      for (int i = 0; i < n && xfadeRemaining_ > 0; ++i) blendOld(i, r += dr);
    } else {
      double r = rateStart;
      for (int i = 0; i < n; ++i) {
        r += dr;
        gainsAt(i);
        outL[i] = readMix(0, pos_, gp);
        outR[i] = readMix(1, pos_, gp);
        blendOld(i, r);
        pos_ += r;
        if (looping_) {
          const double len = loopEnd_ - loopStart_;
          if (r > 0 && pos_ >= loopEnd_) {
            xfadePos_ = pos_;  // the audio past the loop end fades out
            xfadeRemaining_ = kXfadeLen;
            pos_ -= len;
          } else if (r < 0 && pos_ < loopStart_) {
            xfadePos_ = pos_;
            xfadeRemaining_ = kXfadeLen;
            pos_ += len;
          }
        }
        if (pos_ >= frames && r > 0) {
          pos_ = frames;
          reachedEnd = true;
        } else if (pos_ < 0.0 && r < 0) {
          pos_ = 0.0;
        }
      }
    }

    // Play/pause de-click ramp.
    for (int i = 0; i < n; ++i) {
      if (playGain_ != gainTarget) {
        playGain_ = gainTarget > playGain_ ? std::min(gainTarget, playGain_ + gainStep)
                                           : std::max(gainTarget, playGain_ - gainStep);
      }
      outL[i] *= playGain_;
      outR[i] *= playGain_;
    }
  }

  // ---- slip shadow position
  if (slip_ && excursion) {
    if (playing_) slipPos_ = std::min(frames, slipPos_ + tempoRate_ * n);
  } else {
    slipPos_ = pos_;
  }

  if (reachedEnd) {
    playing_ = false;
    pos_ = frames;
  }
  lastRate_ = active ? rate : 0.0;
  if (!active && playGain_ == 0.0f) stretching_ = false;
}

void Deck::publish(DeckTelemetry& t) const {
  const double sr = double(sampleRate_);
  t.loaded.store(track_ ? 1 : 0, std::memory_order_relaxed);
  t.playing.store(playing_ ? 1 : 0, std::memory_order_relaxed);
  t.keyLock.store(keyLock_ ? 1 : 0, std::memory_order_relaxed);
  t.sync.store(sync_ ? 1 : 0, std::memory_order_relaxed);
  t.slip.store(slip_ ? 1 : 0, std::memory_order_relaxed);
  t.reverse.store(reverse_ ? 1 : 0, std::memory_order_relaxed);
  t.looping.store(looping_ ? 1 : 0, std::memory_order_relaxed);
  t.slipRoll.store(slipRoll_ ? 1 : 0, std::memory_order_relaxed);
  uint32_t mask = 0;
  for (size_t k = 0; k < hotCueSet_.size(); ++k) {
    if (track_ && hotCueSet_[k]) mask |= 1u << k;
  }
  t.hotCueMask.store(mask, std::memory_order_relaxed);
  t.censor.store(censor_ ? 1 : 0, std::memory_order_relaxed);
  t.trackId.store(track_ ? track_->serial : 0, std::memory_order_relaxed);
  t.stemsLoaded.store(track_ && track_->stems ? 1 : 0, std::memory_order_relaxed);
  for (size_t k = 0; k < 4; ++k) t.stemGain[k].store(stemTarget_[k], std::memory_order_relaxed);
  t.position.store(pos_ / sr, std::memory_order_relaxed);
  t.duration.store(track_ ? double(track_->frames) / sr : 0.0, std::memory_order_relaxed);
  t.slipPosition.store(slipPos_ / sr, std::memory_order_relaxed);
  t.trackBpm.store(trackBpm(), std::memory_order_relaxed);
  t.effectiveBpm.store(trackBpm() * tempoRate_, std::memory_order_relaxed);
  t.rate.store(lastRate_, std::memory_order_relaxed);
  t.beatPhase.store(beatPhase(), std::memory_order_relaxed);
  int64_t beatIndex = 0;
  if (hasGrid()) beatIndex = int64_t(std::floor((pos_ - track_->firstBeatFrame) / track_->framesPerBeat()));
  t.beatIndex.store(beatIndex, std::memory_order_relaxed);
  t.loopStart.store(loopStart_ / sr, std::memory_order_relaxed);
  t.loopEnd.store(loopEnd_ / sr, std::memory_order_relaxed);
  t.cue.store(cuePoint_ / sr, std::memory_order_relaxed);
}

}  // namespace djn
