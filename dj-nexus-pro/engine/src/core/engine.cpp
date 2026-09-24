#include "engine.h"

#include <chrono>
#include <cmath>

#include "djnexus/djnexus.h"
#include "denormals.h"

namespace djn {

Engine::Engine(int sampleRate, int maxBlock, int numDecks)
    : sampleRate_(sampleRate), maxBlock_(maxBlock), numDecks_(numDecks) {
  for (int d = 0; d < 4; ++d) {
    decks_[size_t(d)].setup(sampleRate, maxBlock);
    strips_[size_t(d)].setup(sampleRate);
  }
  limiter_.setup(sampleRate);
  limiter_.setCeilingDb(-0.3f);
  const size_t n = size_t(maxBlock);
  deckL_.assign(n, 0.0f);
  deckR_.assign(n, 0.0f);
  mixL_.assign(n, 0.0f);
  mixR_.assign(n, 0.0f);
  cueL_.assign(n, 0.0f);
  cueR_.assign(n, 0.0f);
  interleaved_.assign(n * 2, 0.0f);
  sampL_.assign(n, 0.0f);
  sampR_.assign(n, 0.0f);
  for (auto& u : fxUnits_) u.setup(sampleRate, maxBlock);
  sampler_.setup(sampleRate, maxBlock);
  macro_.setup(sampleRate);
  size_t hist = 1;
  while (hist < size_t(historySeconds() * sampleRate) + size_t(maxBlock)) hist <<= 1;
  histMask_ = hist - 1;
  for (int d = 0; d < numDecks; ++d) {
    histL_[size_t(d)].assign(hist, 0.0f);
    histR_[size_t(d)].assign(hist, 0.0f);
  }
}

Engine::~Engine() {
  recorder.stop();
  // Free tracks still queued for loading, held by decks, or awaiting collection.
  Command c;
  while (commands_.pop(c)) delete c.track;  // pending loads / captures
  for (auto& d : decks_) delete d.unload();
  for (int s = 0; s < Sampler::kSlots; ++s) delete sampler_.load(s, nullptr);
  collectGarbage();
}

void Engine::collectGarbage() {
  LockGuard<Mutex> lock(garbageMutex_);
  Track* t = nullptr;
  while (garbage_.pop(t)) delete t;
}

void Engine::capture(int deck, Track* into) {
  // Copy the most recent `frames` samples of the deck's history.
  const int64_t frames = into->frames;
  const int64_t end = histCount_[size_t(deck)];
  float* l = into->l();
  float* r = into->r();
  for (int64_t i = 0; i < frames; ++i) {
    const int64_t src = end - frames + i;
    if (src < 0) continue;  // not enough history yet: leading silence
    l[i] = histL_[size_t(deck)][size_t(src) & histMask_];
    r[i] = histR_[size_t(deck)][size_t(src) & histMask_];
  }
}

void Engine::dispatchGlobal(const Command& c) {
  Track* old = nullptr;
  switch (c.type) {
    case Cmd::SamplerLoad: old = sampler_.load(c.slot, c.track); break;
    case Cmd::SamplerCapture:
      if (c.deck >= 0 && c.deck < numDecks_) {
        capture(c.deck, c.track);
        old = sampler_.load(c.slot, c.track);
      } else {
        old = c.track;
      }
      break;
    case Cmd::SamplerTrigger: {
      // The FX/sampler clock projected to the start of this block.
      BeatClock clk;
      clk.bpm = lastClockBpm_;
      clk.beat = internalBeat_;
      clk.beatsPerSample = clk.bpm / 60.0 / sampleRate_;
      sampler_.trigger(c.slot, float(c.value), clk, samplerQuantize.load(std::memory_order_relaxed));
      break;
    }
    case Cmd::SamplerRelease: sampler_.release(c.slot); break;
    case Cmd::SamplerStopAll: sampler_.stopAll(); break;
    case Cmd::SamplerMode: sampler_.setMode(c.slot, int(c.value)); break;
    case Cmd::SamplerChoke: sampler_.setChoke(c.slot, int(c.value)); break;
    case Cmd::SamplerGain: sampler_.setGainDb(c.slot, float(c.value)); break;
    case Cmd::SamplerPitch: sampler_.setPitch(c.slot, float(c.value)); break;
    case Cmd::SamplerSync: sampler_.setSync(c.slot, c.value != 0.0); break;
    case Cmd::MacroStart: {
      BeatClock clk;  // the beat clock projected to this block's start
      clk.bpm = lastClockBpm_;
      clk.beat = internalBeat_;
      clk.beatsPerSample = clk.bpm / 60.0 / sampleRate_;
      macroTarget_ = (c.deck >= 0 && c.deck < numDecks_) ? c.deck : -1;
      macro_.start(c.slot, int(c.value), c.value2 != 0.0, clk);
      break;
    }
    case Cmd::MacroCancel: macro_.cancel(); break;
    default: break;
  }
  if (old && !garbage_.push(old)) {
    // Queue full: leak rather than free on the audio thread.
  }
}

void Engine::dispatch(const Command& c) {
  if (c.type >= Cmd::SamplerLoad) {
    dispatchGlobal(c);
    return;
  }
  if (c.deck < 0 || c.deck >= numDecks_) {
    if (c.type == Cmd::Load) delete c.track;  // unreachable via the C API
    return;
  }
  Deck& d = decks_[size_t(c.deck)];
  Track* old = nullptr;
  switch (c.type) {
    case Cmd::Load: old = d.load(c.track); break;
    case Cmd::Unload: old = d.unload(); break;
    case Cmd::Play: d.play(); break;
    case Cmd::Pause: d.pause(); break;
    case Cmd::TogglePlay: d.togglePlay(); break;
    case Cmd::Cue: d.cue(); break;
    case Cmd::Seek: d.seekSeconds(c.value); break;
    case Cmd::HotCueSet: d.hotCueSet(c.slot); break;
    case Cmd::HotCueSetAt: d.hotCueSetAt(c.slot, c.value); break;
    case Cmd::HotCueTrigger: d.hotCueTrigger(c.slot); break;
    case Cmd::HotCueClear: d.hotCueClear(c.slot); break;
    case Cmd::LoopIn: d.loopIn(); break;
    case Cmd::LoopOut: d.loopOut(); break;
    case Cmd::LoopBeats: d.loopBeats(c.value); break;
    case Cmd::LoopExit: d.loopExit(); break;
    case Cmd::LoopHalve: d.loopHalve(); break;
    case Cmd::LoopDouble: d.loopDouble(); break;
    case Cmd::Pitch: d.setPitch(c.value); break;
    case Cmd::KeyLock: d.setKeyLock(c.slot != 0); break;
    case Cmd::Quantize: d.setQuantize(c.slot != 0); break;
    case Cmd::Slip: d.setSlip(c.slot != 0); break;
    case Cmd::Reverse: d.setReverse(c.slot != 0); break;
    case Cmd::Sync: d.setSync(c.slot != 0); break;
    case Cmd::Jog: d.jog(c.slot != 0, c.value); break;
    case Cmd::SetGrid: d.setGrid(c.value, c.value2); break;
    case Cmd::SlipRoll: d.slipRoll(c.slot != 0, c.value); break;
    case Cmd::Censor: d.censor(c.slot != 0); break;
    default: break;  // sampler commands are handled in dispatchGlobal()
  }
  if (old && !garbage_.push(old)) {
    // Garbage queue full (control thread never collects): leak rather than
    // free on the audio thread. 64 pending tracks means something is wrong.
  }
}

int Engine::chooseMasterDeck() const {
  const int req = masterDeckRequest.load(std::memory_order_relaxed);
  if (req >= 0 && req < numDecks_ && decks_[size_t(req)].hasGrid()) return req;
  // Auto: the first playing deck with a grid that isn't itself following.
  for (int d = 0; d < numDecks_; ++d) {
    const Deck& k = decks_[size_t(d)];
    if (k.playing() && k.hasGrid() && !k.synced()) return d;
  }
  for (int d = 0; d < numDecks_; ++d) {
    const Deck& k = decks_[size_t(d)];
    if (k.playing() && k.hasGrid()) return d;
  }
  return -1;
}

BeatClock Engine::makeClock(int master, const SyncRef& ref, int frames) {
  BeatClock clk;
  const double manual = fxBpm.load(std::memory_order_relaxed);
  const Deck* m = master >= 0 ? &decks_[size_t(master)] : nullptr;
  if (manual > 0) {
    clk.bpm = manual;
    clk.beat = internalBeat_;
  } else if (m && m->playing() && ref.bpm > 0) {
    // Follow the master deck's own beat grid, so FX land on its beats.
    clk.bpm = ref.bpm;
    clk.beat = m->beatPosition();
  } else {
    clk.bpm = lastClockBpm_;
    clk.beat = internalBeat_;
  }
  clk.beatsPerSample = clk.bpm / 60.0 / sampleRate_;
  internalBeat_ = clk.beat + clk.beatsPerSample * frames;
  lastClockBpm_ = clk.bpm;
  return clk;
}

int Engine::process(float* out, int frames, int outChannels) {
  if (!out || frames < 0 || frames > maxBlock_ || (outChannels != 2 && outChannels != 4)) {
    return DJN_ERR_INVALID_ARG;
  }
  if (frames == 0) return DJN_OK;
  ScopedFlushDenormals noDenormals;
  const auto t0 = std::chrono::steady_clock::now();

  Command c;
  while (commands_.pop(c)) dispatch(c);

  // ---- snapshot parameters
  const int mode = eqMode.load(std::memory_order_relaxed);
  const int colorType = colorFx.load(std::memory_order_relaxed);
  const float res = resonance.load(std::memory_order_relaxed);
  float xa, xb;
  crossfaderGains(crossfader.load(std::memory_order_relaxed), crossfaderCurve.load(std::memory_order_relaxed), xa, xb);
  limiter_.setEnabled(limiterOn.load(std::memory_order_relaxed) != 0);
  limiter_.setCeilingDb(limiterCeilingDb.load(std::memory_order_relaxed));
  const float targetMaster = dbToGain(clampv(masterDb.load(std::memory_order_relaxed), -80.0f, 6.0f));

  // ---- sync reference, sampled before any deck moves this block
  const int master = chooseMasterDeck();
  masterDeck_.store(master, std::memory_order_relaxed);
  SyncRef ref;
  if (master >= 0) {
    const Deck& m = decks_[size_t(master)];
    ref.valid = true;
    ref.playing = m.playing();
    ref.bpm = m.trackBpm() * m.tempoRate();
    ref.phase = m.beatPhase();
  }

  const BeatClock clock = makeClock(master, ref, frames);
  clockBpm_.store(clock.bpm, std::memory_order_relaxed);
  clockBeat_.store(clock.beat, std::memory_order_relaxed);

  FxParams fxp[2];
  int fxTarget[2];
  for (int u = 0; u < 2; ++u) {
    fxp[u].type = fx[size_t(u)].type.load(std::memory_order_relaxed);
    fxp[u].on = fx[size_t(u)].on.load(std::memory_order_relaxed) != 0;
    fxp[u].beats = fx[size_t(u)].beats.load(std::memory_order_relaxed);
    fxp[u].depth = fx[size_t(u)].depth.load(std::memory_order_relaxed);
    fxp[u].wet = fx[size_t(u)].wet.load(std::memory_order_relaxed);
    fxTarget[u] = fx[size_t(u)].target.load(std::memory_order_relaxed);
  }

  // Sampler first: it may be routed into a channel.
  std::fill(sampL_.begin(), sampL_.begin() + frames, 0.0f);
  std::fill(sampR_.begin(), sampR_.begin() + frames, 0.0f);
  sampler_.render(sampL_.data(), sampR_.data(), frames, clock);
  const float samplerGain = dbToGain(clampv(samplerVolumeDb.load(std::memory_order_relaxed), -80.0f, 12.0f));
  const int samplerOut = samplerOutput.load(std::memory_order_relaxed);

  std::fill(mixL_.begin(), mixL_.begin() + frames, 0.0f);
  std::fill(mixR_.begin(), mixR_.begin() + frames, 0.0f);
  std::fill(cueL_.begin(), cueL_.begin() + frames, 0.0f);
  std::fill(cueR_.begin(), cueR_.begin() + frames, 0.0f);

  const float dxa = (xa - xfGainA_) / float(frames);
  const float dxb = (xb - xfGainB_) / float(frames);

  for (int d = 0; d < numDecks_; ++d) {
    Deck& deck = decks_[size_t(d)];
    deck.render(deckL_.data(), deckR_.data(), frames, ref, d == master);

    // History for sampler capture (what the deck played, before the mixer).
    {
      auto& hl = histL_[size_t(d)];
      auto& hr = histR_[size_t(d)];
      int64_t w = histCount_[size_t(d)];
      for (int i = 0; i < frames; ++i, ++w) {
        hl[size_t(w) & histMask_] = deckL_[size_t(i)];
        hr[size_t(w) & histMask_] = deckR_[size_t(i)];
      }
      histCount_[size_t(d)] = w;
    }
    if (samplerOut == d) {
      for (int i = 0; i < frames; ++i) {
        deckL_[size_t(i)] += sampL_[size_t(i)] * samplerGain;
        deckR_[size_t(i)] += sampR_[size_t(i)] * samplerGain;
      }
    }

    ChannelAtomics& ca = channels[size_t(d)];
    ChannelParams p;
    p.trimDb = ca.trimDb.load(std::memory_order_relaxed);
    for (int b = 0; b < 3; ++b) p.eqDb[b] = ca.eqDb[b].load(std::memory_order_relaxed);
    p.filter = ca.filter.load(std::memory_order_relaxed);
    p.fader = ca.fader.load(std::memory_order_relaxed);
    p.eqMode = mode;
    p.resonance = res;
    p.colorType = colorType;
    p.bpm = clock.bpm;
    const bool cueOn = ca.cue.load(std::memory_order_relaxed) != 0;
    strips_[size_t(d)].process(deckL_.data(), deckR_.data(), frames, p,
                               cueOn ? cueL_.data() : nullptr, cueOn ? cueR_.data() : nullptr);

    // Meters (single writer; the reader resets them).
    // Beat FX inserted on this channel (post-fader).
    for (int u = 0; u < 2; ++u) {
      if (fxTarget[u] == d) fxUnits_[size_t(u)].process(deckL_.data(), deckR_.data(), frames, fxp[u], clock);
    }
    if (macroTarget_ == d) macro_.process(deckL_.data(), deckR_.data(), frames, clock);

    const float pl = strips_[size_t(d)].blockPeakL(), pr = strips_[size_t(d)].blockPeakR();
    if (pl > ca.peakL.load(std::memory_order_relaxed)) ca.peakL.store(pl, std::memory_order_relaxed);
    if (pr > ca.peakR.load(std::memory_order_relaxed)) ca.peakR.store(pr, std::memory_order_relaxed);

    const int assign = ca.assign.load(std::memory_order_relaxed);
    float g0 = 1.0f, dg = 0.0f;
    if (assign == 1) { g0 = xfGainA_; dg = dxa; }
    if (assign == 2) { g0 = xfGainB_; dg = dxb; }
    float g = g0;
    for (int i = 0; i < frames; ++i) {
      g += dg;
      mixL_[size_t(i)] += deckL_[size_t(i)] * g;
      mixR_[size_t(i)] += deckR_[size_t(i)] * g;
    }
  }
  xfGainA_ = xa;
  xfGainB_ = xb;

  if (samplerOut < 0 || samplerOut >= numDecks_) {
    for (int i = 0; i < frames; ++i) {
      mixL_[size_t(i)] += sampL_[size_t(i)] * samplerGain;
      mixR_[size_t(i)] += sampR_[size_t(i)] * samplerGain;
    }
  }
  // Beat FX on the master bus, then any unit pointed at a channel that doesn't
  // exist still gets processed (on master) so its state keeps moving.
  for (int u = 0; u < 2; ++u) {
    if (fxTarget[u] < 0 || fxTarget[u] >= numDecks_) {
      fxUnits_[size_t(u)].process(mixL_.data(), mixR_.data(), frames, fxp[u], clock);
    }
    fx[size_t(u)].tail.store(fxUnits_[size_t(u)].tailActive() ? 1 : 0, std::memory_order_relaxed);
  }
  if (macroTarget_ < 0 || macroTarget_ >= numDecks_) macro_.process(mixL_.data(), mixR_.data(), frames, clock);
  macroType_.store(macro_.type(), std::memory_order_relaxed);
  macroTargetT_.store(macroTarget_, std::memory_order_relaxed);
  macroProgress_.store(macro_.progress(), std::memory_order_relaxed);
  macroBeatsLeft_.store(macro_.beatsLeft(), std::memory_order_relaxed);
  samplerLoaded_.store(sampler_.loadedMask(), std::memory_order_relaxed);
  samplerPlaying_.store(sampler_.playingMask(), std::memory_order_relaxed);

  // ---- master bus: gain ramp -> limiter
  const float dm = (targetMaster - masterGain_) / float(frames);
  float mg = masterGain_;
  for (int i = 0; i < frames; ++i) {
    mg += dm;
    mixL_[size_t(i)] *= mg;
    mixR_[size_t(i)] *= mg;
  }
  masterGain_ = targetMaster;
  limiter_.process(mixL_.data(), mixR_.data(), frames);
  limiterGr_.store(std::max(0.0f, -gainToDb(limiter_.lastGain())), std::memory_order_relaxed);

  float peakL = 0.0f, peakR = 0.0f;
  for (int i = 0; i < frames; ++i) {
    peakL = std::max(peakL, std::fabs(mixL_[size_t(i)]));
    peakR = std::max(peakR, std::fabs(mixR_[size_t(i)]));
    interleaved_[size_t(2 * i)] = mixL_[size_t(i)];
    interleaved_[size_t(2 * i + 1)] = mixR_[size_t(i)];
  }
  if (peakL > masterPeakL_.load(std::memory_order_relaxed)) masterPeakL_.store(peakL, std::memory_order_relaxed);
  if (peakR > masterPeakR_.load(std::memory_order_relaxed)) masterPeakR_.store(peakR, std::memory_order_relaxed);

  recorder.write(interleaved_.data(), frames);

  // ---- output
  if (outChannels == 2) {
    std::copy(interleaved_.begin(), interleaved_.begin() + 2 * frames, out);
  } else {
    // Headphones: blend of the cue bus and the master, then headphone level.
    const float mix = clampv(cueMix.load(std::memory_order_relaxed), 0.0f, 1.0f);
    const float hp = dbToGain(clampv(headphoneDb.load(std::memory_order_relaxed), -80.0f, 12.0f));
    for (int i = 0; i < frames; ++i) {
      out[4 * i + 0] = mixL_[size_t(i)];
      out[4 * i + 1] = mixR_[size_t(i)];
      const float hl = (cueL_[size_t(i)] * (1.0f - mix) + mixL_[size_t(i)] * mix) * hp;
      const float hr = (cueR_[size_t(i)] * (1.0f - mix) + mixR_[size_t(i)] * mix) * hp;
      out[4 * i + 2] = clampv(hl, -1.0f, 1.0f);
      out[4 * i + 3] = clampv(hr, -1.0f, 1.0f);
    }
  }

  for (int d = 0; d < numDecks_; ++d) decks_[size_t(d)].publish(telemetry_[size_t(d)]);
  blocks_.fetch_add(1, std::memory_order_relaxed);
  const double elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
  dspLoad_.store(elapsed / (double(frames) / sampleRate_), std::memory_order_relaxed);
  return DJN_OK;
}

void Engine::fillState(djn_engine_state* s, bool consumePeaks) {
  *s = djn_engine_state{};
  s->sample_rate = sampleRate_;
  s->num_decks = numDecks_;
  s->master_deck = masterDeck_.load(std::memory_order_relaxed);
  s->master_peak_l = consumePeaks ? masterPeakL_.exchange(0.0f, std::memory_order_relaxed) : masterPeakL_.load(std::memory_order_relaxed);
  s->master_peak_r = consumePeaks ? masterPeakR_.exchange(0.0f, std::memory_order_relaxed) : masterPeakR_.load(std::memory_order_relaxed);
  s->limiter_gain_reduction_db = limiterGr_.load(std::memory_order_relaxed);
  s->recording = recorder.recording() ? 1 : 0;
  s->recorded_sec = double(recorder.framesWritten()) / sampleRate_;
  s->xruns = recorder.overflows();
  s->blocks_processed = blocks_.load(std::memory_order_relaxed);
  s->dsp_load = dspLoad_.load(std::memory_order_relaxed);
  s->clock_bpm = clockBpm_.load(std::memory_order_relaxed);
  s->clock_beat = clockBeat_.load(std::memory_order_relaxed);
  s->sampler_loaded = samplerLoaded_.load(std::memory_order_relaxed);
  s->sampler_playing = samplerPlaying_.load(std::memory_order_relaxed);
  s->color_fx = colorFx.load(std::memory_order_relaxed);
  s->color_param = resonance.load(std::memory_order_relaxed);
  s->macro = macroType_.load(std::memory_order_relaxed);
  s->macro_target = macroTargetT_.load(std::memory_order_relaxed);
  s->macro_progress = macroProgress_.load(std::memory_order_relaxed);
  s->macro_beats_left = macroBeatsLeft_.load(std::memory_order_relaxed);
  for (int u = 0; u < 2; ++u) {
    djn_fx_state& f = s->fx[u];
    f.on = fx[size_t(u)].on.load(std::memory_order_relaxed);
    f.type = fx[size_t(u)].type.load(std::memory_order_relaxed);
    f.target = fx[size_t(u)].target.load(std::memory_order_relaxed);
    f.tail_active = fx[size_t(u)].tail.load(std::memory_order_relaxed);
    f.beats = fx[size_t(u)].beats.load(std::memory_order_relaxed);
    f.depth = fx[size_t(u)].depth.load(std::memory_order_relaxed);
    f.wet = fx[size_t(u)].wet.load(std::memory_order_relaxed);
  }
  for (int d = 0; d < numDecks_; ++d) {
    const DeckTelemetry& t = telemetry_[size_t(d)];
    djn_deck_state& o = s->decks[d];
    o.loaded = t.loaded.load(std::memory_order_relaxed);
    o.playing = t.playing.load(std::memory_order_relaxed);
    o.key_lock = t.keyLock.load(std::memory_order_relaxed);
    o.sync = t.sync.load(std::memory_order_relaxed);
    o.slip = t.slip.load(std::memory_order_relaxed);
    o.reverse = t.reverse.load(std::memory_order_relaxed);
    o.looping = t.looping.load(std::memory_order_relaxed);
    o.slip_roll = t.slipRoll.load(std::memory_order_relaxed);
    o.censor = t.censor.load(std::memory_order_relaxed);
    o.is_master = s->master_deck == d ? 1 : 0;
    o.position_sec = t.position.load(std::memory_order_relaxed);
    o.duration_sec = t.duration.load(std::memory_order_relaxed);
    o.slip_position_sec = t.slipPosition.load(std::memory_order_relaxed);
    o.track_bpm = t.trackBpm.load(std::memory_order_relaxed);
    o.effective_bpm = t.effectiveBpm.load(std::memory_order_relaxed);
    o.rate = t.rate.load(std::memory_order_relaxed);
    o.beat_phase = t.beatPhase.load(std::memory_order_relaxed);
    o.beat_index = t.beatIndex.load(std::memory_order_relaxed);
    o.loop_start_sec = t.loopStart.load(std::memory_order_relaxed);
    o.loop_end_sec = t.loopEnd.load(std::memory_order_relaxed);
    o.cue_sec = t.cue.load(std::memory_order_relaxed);
    o.peak_l = consumePeaks ? channels[size_t(d)].peakL.exchange(0.0f, std::memory_order_relaxed)
                            : channels[size_t(d)].peakL.load(std::memory_order_relaxed);
    o.peak_r = consumePeaks ? channels[size_t(d)].peakR.exchange(0.0f, std::memory_order_relaxed)
                            : channels[size_t(d)].peakR.load(std::memory_order_relaxed);
    o.hot_cue_mask = t.hotCueMask.load(std::memory_order_relaxed);
  }
}

}  // namespace djn
