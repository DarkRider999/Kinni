// C API: thin wrappers over djn::Engine.
#include <algorithm>
#include <cmath>
#include <memory>
#include <new>

#include "core/engine.h"
#include "core/platform.h"
#include "decode/decoder.h"
#include "djnexus/djnexus.h"

struct djn_engine {
  djn::Engine impl;
  djn_engine(int sr, int block, int decks) : impl(sr, block, decks) {}
};

namespace {

using djn::Cmd;
using djn::Command;

bool validDeck(const djn_engine* e, int32_t deck) { return e && deck >= 0 && deck < e->impl.numDecks(); }

int send(djn_engine* e, int32_t deck, Cmd type, int32_t slot = 0, double value = 0.0) {
  if (!validDeck(e, deck)) return DJN_ERR_INVALID_ARG;
  Command c{type, int8_t(deck), slot, value, 0.0, nullptr};
  return e->impl.send(c) ? DJN_OK : DJN_ERR_QUEUE_FULL;
}

djn::Engine::ChannelAtomics* channel(djn_engine* e, int32_t ch) {
  return validDeck(e, ch) ? &e->impl.channels[size_t(ch)] : nullptr;
}

}  // namespace

extern "C" {

DJN_API djn_engine* djn_engine_create(const djn_engine_config* config) {
  if (!config || config->sample_rate < 8000 || config->sample_rate > 384000 || config->max_block_frames < 16 ||
      config->max_block_frames > 16384 || config->num_decks < 1 || config->num_decks > DJN_MAX_DECKS) {
    return nullptr;
  }
  return new (std::nothrow) djn_engine(config->sample_rate, config->max_block_frames, config->num_decks);
}

DJN_API void djn_engine_destroy(djn_engine* engine) { delete engine; }

DJN_API const char* djn_version_string(void) { return "0.1.0"; }

DJN_API int djn_engine_process(djn_engine* engine, float* out, int32_t frames, int32_t out_channels) {
  if (!engine) return DJN_ERR_INVALID_ARG;
  return engine->impl.process(out, frames, out_channels);
}

DJN_API int32_t djn_engine_sample_rate(const djn_engine* engine) { return engine ? engine->impl.sampleRate() : 0; }

DJN_API int32_t djn_engine_max_block_frames(const djn_engine* engine) { return engine ? engine->impl.maxBlock() : 0; }

DJN_API void djn_engine_collect_garbage(djn_engine* engine) {
  if (engine) engine->impl.collectGarbage();
}

// ---------------------------------------------------------------- decks

DJN_API int djn_deck_load_pcm(djn_engine* engine, int32_t deck, const float* interleaved, int64_t frames,
                              int32_t channels, int32_t sample_rate, double bpm, double first_beat_sec) {
  if (!validDeck(engine, deck) || !interleaved || frames <= 0) return DJN_ERR_INVALID_ARG;
  std::unique_ptr<djn::Track> track;
  DJN_TRY {
    track = djn::makeTrack(interleaved, frames, channels, sample_rate, engine->impl.sampleRate(), bpm, first_beat_sec);
  }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  if (!track) return DJN_ERR_INVALID_ARG;
  Command c{Cmd::Load, int8_t(deck), 0, 0.0, 0.0, track.get()};
  if (!engine->impl.send(c)) return DJN_ERR_QUEUE_FULL;
  track.release();  // now owned by the engine
  engine->impl.collectGarbage();
  return DJN_OK;
}

DJN_API int djn_deck_load_file(djn_engine* engine, int32_t deck, const char* utf8_path, double bpm,
                               double first_beat_sec) {
  if (!validDeck(engine, deck) || !utf8_path) return DJN_ERR_INVALID_ARG;
  djn::DecodedAudio audio;
  int r;
  DJN_TRY {
    r = djn::decodeFile(utf8_path, audio);
  }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  if (r != DJN_OK) return r;
  return djn_deck_load_pcm(engine, deck, audio.samples.data(), audio.frames, audio.channels, audio.sampleRate, bpm,
                           first_beat_sec);
}

DJN_API int djn_deck_unload(djn_engine* e, int32_t d) { return send(e, d, Cmd::Unload); }

DJN_API int djn_deck_set_grid(djn_engine* e, int32_t d, double bpm, double first_beat_sec) {
  if (!validDeck(e, d) || !std::isfinite(bpm) || !std::isfinite(first_beat_sec) || bpm > 400) return DJN_ERR_INVALID_ARG;
  Command c{Cmd::SetGrid, int8_t(d), 0, bpm, first_beat_sec, nullptr};
  return e->impl.send(c) ? DJN_OK : DJN_ERR_QUEUE_FULL;
}
DJN_API int djn_deck_play(djn_engine* e, int32_t d) { return send(e, d, Cmd::Play); }
DJN_API int djn_deck_pause(djn_engine* e, int32_t d) { return send(e, d, Cmd::Pause); }
DJN_API int djn_deck_toggle_play(djn_engine* e, int32_t d) { return send(e, d, Cmd::TogglePlay); }
DJN_API int djn_deck_cue(djn_engine* e, int32_t d) { return send(e, d, Cmd::Cue); }
DJN_API int djn_deck_seek(djn_engine* e, int32_t d, double s) { return send(e, d, Cmd::Seek, 0, s); }

DJN_API int djn_deck_hot_cue_set(djn_engine* e, int32_t d, int32_t slot) {
  if (slot < 0 || slot >= DJN_MAX_HOT_CUES) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::HotCueSet, slot);
}
DJN_API int djn_deck_hot_cue_set_at(djn_engine* e, int32_t d, int32_t slot, double s) {
  if (slot < 0 || slot >= DJN_MAX_HOT_CUES) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::HotCueSetAt, slot, s);
}
DJN_API int djn_deck_hot_cue_trigger(djn_engine* e, int32_t d, int32_t slot) {
  if (slot < 0 || slot >= DJN_MAX_HOT_CUES) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::HotCueTrigger, slot);
}
DJN_API int djn_deck_hot_cue_clear(djn_engine* e, int32_t d, int32_t slot) {
  if (slot < 0 || slot >= DJN_MAX_HOT_CUES) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::HotCueClear, slot);
}

DJN_API int djn_deck_loop_in(djn_engine* e, int32_t d) { return send(e, d, Cmd::LoopIn); }
DJN_API int djn_deck_loop_out(djn_engine* e, int32_t d) { return send(e, d, Cmd::LoopOut); }
DJN_API int djn_deck_loop_beats(djn_engine* e, int32_t d, double beats) {
  if (!(beats > 0)) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::LoopBeats, 0, beats);
}
DJN_API int djn_deck_loop_exit(djn_engine* e, int32_t d) { return send(e, d, Cmd::LoopExit); }
DJN_API int djn_deck_loop_halve(djn_engine* e, int32_t d) { return send(e, d, Cmd::LoopHalve); }
DJN_API int djn_deck_loop_double(djn_engine* e, int32_t d) { return send(e, d, Cmd::LoopDouble); }

DJN_API int djn_deck_set_pitch(djn_engine* e, int32_t d, double p) {
  if (!std::isfinite(p)) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::Pitch, 0, p);
}
DJN_API int djn_deck_set_key_lock(djn_engine* e, int32_t d, int32_t on) { return send(e, d, Cmd::KeyLock, on != 0); }
DJN_API int djn_deck_set_quantize(djn_engine* e, int32_t d, int32_t on) { return send(e, d, Cmd::Quantize, on != 0); }
DJN_API int djn_deck_set_slip(djn_engine* e, int32_t d, int32_t on) { return send(e, d, Cmd::Slip, on != 0); }
DJN_API int djn_deck_set_reverse(djn_engine* e, int32_t d, int32_t on) { return send(e, d, Cmd::Reverse, on != 0); }
DJN_API int djn_deck_set_sync(djn_engine* e, int32_t d, int32_t on) { return send(e, d, Cmd::Sync, on != 0); }
DJN_API int djn_deck_jog(djn_engine* e, int32_t d, int32_t touched, double rate) {
  if (!std::isfinite(rate)) return DJN_ERR_INVALID_ARG;
  return send(e, d, Cmd::Jog, touched != 0, rate);
}

DJN_API int djn_engine_set_master_deck(djn_engine* e, int32_t deck) {
  if (!e || deck < -1 || deck >= e->impl.numDecks()) return DJN_ERR_INVALID_ARG;
  e->impl.masterDeckRequest.store(deck);
  return DJN_OK;
}

// ---------------------------------------------------------------- mixer

#define DJN_CHANNEL_OR_FAIL(e, ch)            \
  auto* c = channel(e, ch);                   \
  if (!c) return DJN_ERR_INVALID_ARG

DJN_API int djn_mixer_set_trim_db(djn_engine* e, int32_t ch, float db) {
  DJN_CHANNEL_OR_FAIL(e, ch);
  c->trimDb.store(db);
  return DJN_OK;
}
DJN_API int djn_mixer_set_eq_db(djn_engine* e, int32_t ch, int32_t band, float db) {
  DJN_CHANNEL_OR_FAIL(e, ch);
  if (band < 0 || band > 2) return DJN_ERR_INVALID_ARG;
  c->eqDb[band].store(db);
  return DJN_OK;
}
DJN_API int djn_mixer_set_eq_mode(djn_engine* e, djn_eq_mode mode) {
  if (!e || (mode != DJN_EQ_CLASSIC && mode != DJN_EQ_ISOLATOR)) return DJN_ERR_INVALID_ARG;
  e->impl.eqMode.store(int(mode));
  return DJN_OK;
}
DJN_API int djn_mixer_set_filter(djn_engine* e, int32_t ch, float v) {
  DJN_CHANNEL_OR_FAIL(e, ch);
  c->filter.store(v);
  return DJN_OK;
}
DJN_API int djn_mixer_set_filter_resonance(djn_engine* e, float r) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.resonance.store(r);
  return DJN_OK;
}
DJN_API int djn_mixer_set_fader(djn_engine* e, int32_t ch, float v) {
  DJN_CHANNEL_OR_FAIL(e, ch);
  c->fader.store(v);
  return DJN_OK;
}
DJN_API int djn_mixer_set_xfader_assign(djn_engine* e, int32_t ch, djn_xfader_assign a) {
  DJN_CHANNEL_OR_FAIL(e, ch);
  if (a != DJN_XF_THRU && a != DJN_XF_A && a != DJN_XF_B) return DJN_ERR_INVALID_ARG;
  c->assign.store(int(a));
  return DJN_OK;
}
DJN_API int djn_mixer_set_cue(djn_engine* e, int32_t ch, int32_t on) {
  DJN_CHANNEL_OR_FAIL(e, ch);
  c->cue.store(on != 0);
  return DJN_OK;
}
DJN_API int djn_mixer_set_crossfader(djn_engine* e, float pos) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.crossfader.store(pos);
  return DJN_OK;
}
DJN_API int djn_mixer_set_crossfader_curve(djn_engine* e, djn_xfader_curve curve) {
  if (!e || (curve != DJN_XF_CURVE_SMOOTH && curve != DJN_XF_CURVE_SHARP)) return DJN_ERR_INVALID_ARG;
  e->impl.crossfaderCurve.store(int(curve));
  return DJN_OK;
}
DJN_API int djn_mixer_set_master_db(djn_engine* e, float db) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.masterDb.store(db);
  return DJN_OK;
}
DJN_API int djn_mixer_set_limiter(djn_engine* e, int32_t on, float ceiling_db) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.limiterOn.store(on != 0);
  e->impl.limiterCeilingDb.store(ceiling_db);
  return DJN_OK;
}
DJN_API int djn_mixer_set_cue_mix(djn_engine* e, float v) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.cueMix.store(v);
  return DJN_OK;
}
DJN_API int djn_mixer_set_headphone_db(djn_engine* e, float db) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.headphoneDb.store(db);
  return DJN_OK;
}

// ---------------------------------------------------------------- beat FX

namespace {
djn::Engine::FxAtomics* fxUnit(djn_engine* e, int32_t unit) {
  return (e && unit >= 0 && unit < DJN_MAX_FX_UNITS) ? &e->impl.fx[size_t(unit)] : nullptr;
}
}  // namespace

DJN_API int djn_fx_set_type(djn_engine* e, int32_t unit, djn_fx_type type) {
  auto* f = fxUnit(e, unit);
  if (!f || type < DJN_FX_ECHO || type > DJN_FX_CRUSH) return DJN_ERR_INVALID_ARG;
  f->type.store(int(type));
  return DJN_OK;
}
DJN_API int djn_fx_set_beats(djn_engine* e, int32_t unit, double beats) {
  auto* f = fxUnit(e, unit);
  if (!f || !(beats > 0) || !std::isfinite(beats)) return DJN_ERR_INVALID_ARG;
  f->beats.store(djn::clampv(beats, 1.0 / 16.0, 16.0));
  return DJN_OK;
}
DJN_API int djn_fx_set_depth(djn_engine* e, int32_t unit, float depth) {
  auto* f = fxUnit(e, unit);
  if (!f || !std::isfinite(depth)) return DJN_ERR_INVALID_ARG;
  f->depth.store(djn::clampv(depth, 0.0f, 1.0f));
  return DJN_OK;
}
DJN_API int djn_fx_set_wet(djn_engine* e, int32_t unit, float wet) {
  auto* f = fxUnit(e, unit);
  if (!f || !std::isfinite(wet)) return DJN_ERR_INVALID_ARG;
  f->wet.store(djn::clampv(wet, 0.0f, 1.0f));
  return DJN_OK;
}
DJN_API int djn_fx_set_target(djn_engine* e, int32_t unit, int32_t target) {
  auto* f = fxUnit(e, unit);
  if (!f || target < DJN_FX_TARGET_MASTER || target >= e->impl.numDecks()) return DJN_ERR_INVALID_ARG;
  f->target.store(target);
  return DJN_OK;
}
DJN_API int djn_fx_set_on(djn_engine* e, int32_t unit, int32_t on) {
  auto* f = fxUnit(e, unit);
  if (!f) return DJN_ERR_INVALID_ARG;
  f->on.store(on != 0);
  return DJN_OK;
}
DJN_API int djn_fx_set_bpm(djn_engine* e, double bpm) {
  if (!e || !std::isfinite(bpm) || bpm < 0 || bpm > 400) return DJN_ERR_INVALID_ARG;
  e->impl.fxBpm.store(bpm);
  return DJN_OK;
}

// ---------------------------------------------------------------- sampler

namespace {
bool validSlot(const djn_engine* e, int32_t slot) { return e && slot >= 0 && slot < DJN_MAX_SAMPLER_SLOTS; }

int sendSampler(djn_engine* e, int32_t slot, Cmd type, double value = 0.0) {
  if (!validSlot(e, slot)) return DJN_ERR_INVALID_ARG;
  Command c{type, -1, slot, value, 0.0, nullptr};
  return e->impl.send(c) ? DJN_OK : DJN_ERR_QUEUE_FULL;
}
}  // namespace

DJN_API int djn_sampler_load_pcm(djn_engine* e, int32_t slot, const float* interleaved, int64_t frames,
                                 int32_t channels, int32_t sample_rate, double bpm) {
  if (!validSlot(e, slot) || !interleaved || frames <= 0 || frames > int64_t(sample_rate) * 600) {
    return DJN_ERR_INVALID_ARG;
  }
  std::unique_ptr<djn::Track> track;
  const int rate = e->impl.sampleRate();
  DJN_TRY {
    track = djn::makeTrack(interleaved, frames, channels, sample_rate, rate, bpm, 0.0, djn::Track::padForRate(rate));
  }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  if (!track) return DJN_ERR_INVALID_ARG;
  Command c{Cmd::SamplerLoad, -1, slot, 0.0, 0.0, track.get()};
  if (!e->impl.send(c)) return DJN_ERR_QUEUE_FULL;
  track.release();
  e->impl.collectGarbage();
  return DJN_OK;
}

DJN_API int djn_sampler_load_file(djn_engine* e, int32_t slot, const char* utf8_path, double bpm) {
  if (!validSlot(e, slot) || !utf8_path) return DJN_ERR_INVALID_ARG;
  djn::DecodedAudio audio;
  int r;
  DJN_TRY { r = djn::decodeFile(utf8_path, audio); }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  if (r != DJN_OK) return r;
  return djn_sampler_load_pcm(e, slot, audio.samples.data(), audio.frames, audio.channels, audio.sampleRate, bpm);
}

DJN_API int djn_sampler_unload(djn_engine* e, int32_t slot) {
  if (!validSlot(e, slot)) return DJN_ERR_INVALID_ARG;
  Command c{Cmd::SamplerLoad, -1, slot, 0.0, 0.0, nullptr};
  return e->impl.send(c) ? DJN_OK : DJN_ERR_QUEUE_FULL;
}

DJN_API int djn_sampler_capture(djn_engine* e, int32_t slot, int32_t deck, double beats) {
  if (!validSlot(e, slot) || !validDeck(e, deck) || !(beats > 0) || !std::isfinite(beats)) return DJN_ERR_INVALID_ARG;
  double bpm = e->impl.deckEffectiveBpm(deck);
  if (!(bpm > 0)) bpm = e->impl.clockBpm();
  const int rate = e->impl.sampleRate();
  const double seconds = std::min(beats * 60.0 / bpm, e->impl.historySeconds());
  std::unique_ptr<djn::Track> track;
  DJN_TRY { track = djn::makeSilentTrack(int64_t(seconds * rate), rate, djn::Track::padForRate(rate)); }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  if (!track) return DJN_ERR_INVALID_ARG;
  track->bpm = bpm;  // captured at the deck's playing tempo
  Command c{Cmd::SamplerCapture, int8_t(deck), slot, bpm, 0.0, track.get()};
  if (!e->impl.send(c)) return DJN_ERR_QUEUE_FULL;
  track.release();
  e->impl.collectGarbage();
  return DJN_OK;
}

DJN_API int djn_sampler_set_mode(djn_engine* e, int32_t slot, djn_pad_mode mode) {
  if (mode < DJN_PAD_ONE_SHOT || mode > DJN_PAD_TOGGLE) return DJN_ERR_INVALID_ARG;
  return sendSampler(e, slot, Cmd::SamplerMode, double(mode));
}
DJN_API int djn_sampler_set_choke(djn_engine* e, int32_t slot, int32_t group) {
  if (group < 0 || group > 8) return DJN_ERR_INVALID_ARG;
  return sendSampler(e, slot, Cmd::SamplerChoke, double(group));
}
DJN_API int djn_sampler_set_gain_db(djn_engine* e, int32_t slot, float db) {
  if (!std::isfinite(db)) return DJN_ERR_INVALID_ARG;
  return sendSampler(e, slot, Cmd::SamplerGain, db);
}
DJN_API int djn_sampler_set_pitch(djn_engine* e, int32_t slot, float semitones) {
  if (!std::isfinite(semitones)) return DJN_ERR_INVALID_ARG;
  return sendSampler(e, slot, Cmd::SamplerPitch, semitones);
}
DJN_API int djn_sampler_set_sync(djn_engine* e, int32_t slot, int32_t on) {
  return sendSampler(e, slot, Cmd::SamplerSync, on != 0 ? 1.0 : 0.0);
}
DJN_API int djn_sampler_trigger(djn_engine* e, int32_t slot, float velocity) {
  if (!std::isfinite(velocity)) return DJN_ERR_INVALID_ARG;
  return sendSampler(e, slot, Cmd::SamplerTrigger, djn::clampv(velocity, 0.0f, 1.0f));
}
DJN_API int djn_sampler_release(djn_engine* e, int32_t slot) { return sendSampler(e, slot, Cmd::SamplerRelease); }
DJN_API int djn_sampler_stop_all(djn_engine* e) { return sendSampler(e, 0, Cmd::SamplerStopAll); }

DJN_API int djn_sampler_set_quantize(djn_engine* e, double beats) {
  if (!e || !std::isfinite(beats) || beats < 0 || beats > 16) return DJN_ERR_INVALID_ARG;
  e->impl.samplerQuantize.store(beats);
  return DJN_OK;
}
DJN_API int djn_sampler_set_volume_db(djn_engine* e, float db) {
  if (!e || !std::isfinite(db)) return DJN_ERR_INVALID_ARG;
  e->impl.samplerVolumeDb.store(db);
  return DJN_OK;
}
DJN_API int djn_sampler_set_output(djn_engine* e, int32_t target) {
  if (!e || target < DJN_SAMPLER_TO_MASTER || target >= e->impl.numDecks()) return DJN_ERR_INVALID_ARG;
  e->impl.samplerOutput.store(target);
  return DJN_OK;
}

// ---------------------------------------------------------------- state / recording

DJN_API int djn_engine_get_state(djn_engine* e, djn_engine_state* out) {
  if (!e || !out) return DJN_ERR_INVALID_ARG;
  e->impl.fillState(out);
  return DJN_OK;
}

DJN_API int djn_record_start(djn_engine* e, const char* path, djn_rec_format format) {
  if (!e || !path || format < DJN_REC_WAV16 || format > DJN_REC_WAV_FLOAT) return DJN_ERR_INVALID_ARG;
  if (e->impl.recorder.recording()) return DJN_ERR_STATE;
  return e->impl.recorder.start(path, djn::Recorder::Format(format), e->impl.sampleRate()) ? DJN_OK : DJN_ERR_IO;
}

DJN_API int djn_record_stop(djn_engine* e) {
  if (!e) return DJN_ERR_INVALID_ARG;
  e->impl.recorder.stop();
  return DJN_OK;
}

}  // extern "C"
