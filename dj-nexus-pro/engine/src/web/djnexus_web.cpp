// WebAssembly glue for the browser demo: memory helpers, a render buffer and
// flat state getters, so JavaScript never has to know struct layouts.
#include <cstdint>
#include <cstdlib>

#include "djnexus/djnexus.h"

#define WEB_EXPORT(name) __attribute__((export_name(#name)))

namespace {
float g_out[4096 * 2];
djn_engine_state g_state;
djn_analysis g_analysis;
}  // namespace

extern "C" {

WEB_EXPORT(djnw_malloc) void* djnw_malloc(int bytes) { return std::malloc(size_t(bytes)); }
WEB_EXPORT(djnw_free) void djnw_free(void* p) { std::free(p); }

WEB_EXPORT(djnw_create) djn_engine* djnw_create(int sampleRate, int decks) {
  djn_engine_config cfg{sampleRate, 4096, decks};
  return djn_engine_create(&cfg);
}

// djn_deck_load_pcm takes an int64 frame count, which JavaScript would have to
// pass as a BigInt (and wasm2js splits in two); this takes int32 instead.
WEB_EXPORT(djnw_load) int djnw_load(djn_engine* e, int deck, const float* interleaved, int frames, int channels,
                                    int sampleRate, double bpm, double firstBeat) {
  return djn_deck_load_pcm(e, deck, interleaved, frames, channels, sampleRate, bpm, firstBeat);
}

WEB_EXPORT(djnw_sampler_load) int djnw_sampler_load(djn_engine* e, int slot, const float* interleaved, int frames,
                                                    int channels, int sampleRate, double bpm) {
  return djn_sampler_load_pcm(e, slot, interleaved, frames, channels, sampleRate, bpm);
}

// Renders `frames` interleaved stereo frames into the shared output buffer.
WEB_EXPORT(djnw_render) float* djnw_render(djn_engine* e, int frames) {
  if (frames > 4096) frames = 4096;
  if (djn_engine_process(e, g_out, frames, 2) != DJN_OK) {
    for (int i = 0; i < frames * 2; ++i) g_out[i] = 0.0f;
  }
  return g_out;
}

WEB_EXPORT(djnw_poll) void djnw_poll(djn_engine* e) {
  djn_engine_get_state(e, &g_state);
  djn_engine_collect_garbage(e);
}

// Deck fields: 0 loaded, 1 playing, 2 key lock, 3 sync, 4 slip, 5 reverse,
// 6 looping, 7 master, 8 position, 9 duration, 10 track bpm, 11 effective bpm,
// 12 rate, 13 beat phase, 14 loop start, 15 loop end, 16 cue, 17 peak L, 18 peak R,
// 19 slip roll held, 20 censor held, 21 track id, 22 stems loaded,
// 23-26 stem levels (drums, bass, vocals, other).
WEB_EXPORT(djnw_deck) double djnw_deck(int d, int field) {
  if (d < 0 || d >= DJN_MAX_DECKS) return 0;
  const djn_deck_state& s = g_state.decks[d];
  switch (field) {
    case 0: return s.loaded;
    case 1: return s.playing;
    case 2: return s.key_lock;
    case 3: return s.sync;
    case 4: return s.slip;
    case 5: return s.reverse;
    case 6: return s.looping;
    case 7: return s.is_master;
    case 8: return s.position_sec;
    case 9: return s.duration_sec;
    case 10: return s.track_bpm;
    case 11: return s.effective_bpm;
    case 12: return s.rate;
    case 13: return s.beat_phase;
    case 14: return s.loop_start_sec;
    case 15: return s.loop_end_sec;
    case 16: return s.cue_sec;
    case 17: return s.peak_l;
    case 18: return s.peak_r;
    case 19: return s.slip_roll;
    case 20: return s.censor;
    case 21: return s.track_id;
    case 22: return s.stems_loaded;
    case 23: case 24: case 25: case 26: return s.stem_gain[field - 23];
  }
  return 0;
}

// Engine fields: 0 master peak L, 1 master peak R, 2 limiter GR dB, 3 dsp load, 4 master deck,
// 5 clock bpm, 6/7 sampler loaded mask (low/high 32 bits), 8/9 sampler playing mask,
// 10 colour FX type, 11 colour parameter, 12 macro (-1 none), 13 macro target,
// 14 macro progress, 15 macro beats left.
WEB_EXPORT(djnw_engine) double djnw_engine(int field) {
  switch (field) {
    case 0: return g_state.master_peak_l;
    case 1: return g_state.master_peak_r;
    case 2: return g_state.limiter_gain_reduction_db;
    case 3: return g_state.dsp_load;
    case 4: return g_state.master_deck;
    case 5: return g_state.clock_bpm;
    case 6: return double(uint32_t(g_state.sampler_loaded));
    case 7: return double(uint32_t(g_state.sampler_loaded >> 32));
    case 8: return double(uint32_t(g_state.sampler_playing));
    case 9: return double(uint32_t(g_state.sampler_playing >> 32));
    case 10: return g_state.color_fx;
    case 11: return g_state.color_param;
    case 12: return g_state.macro;
    case 13: return g_state.macro_target;
    case 14: return g_state.macro_progress;
    case 15: return g_state.macro_beats_left;
  }
  return 0;
}

// FX unit fields: 0 on, 1 type, 2 target, 3 tail active, 4 beats, 5 depth, 6 wet.
WEB_EXPORT(djnw_fx) double djnw_fx(int unit, int field) {
  if (unit < 0 || unit >= DJN_MAX_FX_UNITS) return 0;
  const djn_fx_state& f = g_state.fx[unit];
  switch (field) {
    case 0: return f.on;
    case 1: return f.type;
    case 2: return f.target;
    case 3: return f.tail_active;
    case 4: return f.beats;
    case 5: return f.depth;
    case 6: return f.wet;
  }
  return 0;
}

// Track analysis: run djnw_analyze, then read the fields.
WEB_EXPORT(djnw_analyze) int djnw_analyze(const float* interleaved, int frames, int channels, int rate, double minBpm,
                                          double maxBpm) {
  djn_analysis_options o;
  djn_analysis_default_options(&o);
  if (minBpm > 0) o.min_bpm = minBpm;
  if (maxBpm > 0) o.max_bpm = maxBpm;
  return djn_analyze_pcm(interleaved, frames, channels, rate, &o, &g_analysis);
}

// 0 bpm, 1 first beat, 2 bpm confidence, 3 downbeat confidence, 4 tempo stable,
// 5 key, 6 key confidence, 7 tuning cents.
WEB_EXPORT(djnw_analysis_num) double djnw_analysis_num(int field) {
  const djn_analysis& a = g_analysis;
  switch (field) {
    case 0: return a.bpm;
    case 1: return a.first_beat_sec;
    case 2: return a.bpm_confidence;
    case 3: return a.downbeat_confidence;
    case 4: return a.tempo_stable;
    case 5: return a.key;
    case 6: return a.key_confidence;
    case 7: return a.tuning_cents;
  }
  return 0;
}

// Stem separation. Progress goes to the page through an imported function
// (env.djnw_on_progress), which can return 1 to cancel.
__attribute__((import_module("env"), import_name("djnw_on_progress"))) int djnw_on_progress(float progress);

static int progressToJs(void*, float p) { return djnw_on_progress(p); }

WEB_EXPORT(djnw_separate) int djnw_separate(const float* interleaved, int frames, int channels, int rate, float* drums,
                                            float* bass, float* vocals) {
  return djn_separate_stems(interleaved, frames, channels, rate, drums, bass, vocals, progressToJs, nullptr);
}

// djn_deck_load_stems with a 32-bit frame count (JS numbers, not BigInt).
WEB_EXPORT(djnw_load_stems) int djnw_load_stems(djn_engine* e, int deck, unsigned trackId, const float* drums,
                                                const float* bass, const float* vocals, int frames, int channels,
                                                int rate) {
  return djn_deck_load_stems(e, deck, trackId, drums, bass, vocals, frames, channels, rate);
}

// 0 key name, 1 Camelot, 2 Open Key.
WEB_EXPORT(djnw_analysis_str) const char* djnw_analysis_str(int field) {
  return field == 0 ? g_analysis.key_name : field == 1 ? g_analysis.camelot : g_analysis.open_key;
}

}  // extern "C"

// The WASI libc++ runtime references exception machinery that this
// no-exceptions build never uses except on allocation failure; abort there.
extern "C" {
void* __cxa_allocate_exception(size_t) { __builtin_trap(); }
void __cxa_throw(void*, void*, void (*)(void*)) { __builtin_trap(); }
}
