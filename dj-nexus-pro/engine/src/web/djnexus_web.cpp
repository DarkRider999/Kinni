// WebAssembly glue for the browser demo: memory helpers, a render buffer and
// flat state getters, so JavaScript never has to know struct layouts.
#include <cstdlib>

#include "djnexus/djnexus.h"

#define WEB_EXPORT(name) __attribute__((export_name(#name)))

namespace {
float g_out[4096 * 2];
djn_engine_state g_state;
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
// 12 rate, 13 beat phase, 14 loop start, 15 loop end, 16 cue, 17 peak L, 18 peak R.
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
  }
  return 0;
}

// Engine fields: 0 master peak L, 1 master peak R, 2 limiter GR dB, 3 dsp load, 4 master deck.
WEB_EXPORT(djnw_engine) double djnw_engine(int field) {
  switch (field) {
    case 0: return g_state.master_peak_l;
    case 1: return g_state.master_peak_r;
    case 2: return g_state.limiter_gain_reduction_db;
    case 3: return g_state.dsp_load;
    case 4: return g_state.master_deck;
  }
  return 0;
}

}  // extern "C"

// The WASI libc++ runtime references exception machinery that this
// no-exceptions build never uses except on allocation failure; abort there.
extern "C" {
void* __cxa_allocate_exception(size_t) { __builtin_trap(); }
void __cxa_throw(void*, void*, void (*)(void*)) { __builtin_trap(); }
}
