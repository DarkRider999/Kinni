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
}

Engine::~Engine() {
  recorder.stop();
  // Free tracks still queued for loading, held by decks, or awaiting collection.
  Command c;
  while (commands_.pop(c)) {
    if (c.type == Cmd::Load) delete c.track;
  }
  for (auto& d : decks_) delete d.unload();
  collectGarbage();
}

void Engine::collectGarbage() {
  std::lock_guard<std::mutex> lock(garbageMutex_);
  Track* t = nullptr;
  while (garbage_.pop(t)) delete t;
}

void Engine::dispatch(const Command& c) {
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

  std::fill(mixL_.begin(), mixL_.begin() + frames, 0.0f);
  std::fill(mixR_.begin(), mixR_.begin() + frames, 0.0f);
  std::fill(cueL_.begin(), cueL_.begin() + frames, 0.0f);
  std::fill(cueR_.begin(), cueR_.begin() + frames, 0.0f);

  const float dxa = (xa - xfGainA_) / float(frames);
  const float dxb = (xb - xfGainB_) / float(frames);

  for (int d = 0; d < numDecks_; ++d) {
    Deck& deck = decks_[size_t(d)];
    deck.render(deckL_.data(), deckR_.data(), frames, ref, d == master);

    ChannelAtomics& ca = channels[size_t(d)];
    ChannelParams p;
    p.trimDb = ca.trimDb.load(std::memory_order_relaxed);
    for (int b = 0; b < 3; ++b) p.eqDb[b] = ca.eqDb[b].load(std::memory_order_relaxed);
    p.filter = ca.filter.load(std::memory_order_relaxed);
    p.fader = ca.fader.load(std::memory_order_relaxed);
    p.eqMode = mode;
    p.resonance = res;
    const bool cueOn = ca.cue.load(std::memory_order_relaxed) != 0;
    strips_[size_t(d)].process(deckL_.data(), deckR_.data(), frames, p,
                               cueOn ? cueL_.data() : nullptr, cueOn ? cueR_.data() : nullptr);

    // Meters (single writer; the reader resets them).
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

void Engine::fillState(djn_engine_state* s) {
  *s = djn_engine_state{};
  s->sample_rate = sampleRate_;
  s->num_decks = numDecks_;
  s->master_deck = masterDeck_.load(std::memory_order_relaxed);
  s->master_peak_l = masterPeakL_.exchange(0.0f, std::memory_order_relaxed);
  s->master_peak_r = masterPeakR_.exchange(0.0f, std::memory_order_relaxed);
  s->limiter_gain_reduction_db = limiterGr_.load(std::memory_order_relaxed);
  s->recording = recorder.recording() ? 1 : 0;
  s->recorded_sec = double(recorder.framesWritten()) / sampleRate_;
  s->xruns = recorder.overflows();
  s->blocks_processed = blocks_.load(std::memory_order_relaxed);
  s->dsp_load = dspLoad_.load(std::memory_order_relaxed);
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
    o.peak_l = channels[size_t(d)].peakL.exchange(0.0f, std::memory_order_relaxed);
    o.peak_r = channels[size_t(d)].peakR.exchange(0.0f, std::memory_order_relaxed);
  }
}

}  // namespace djn
