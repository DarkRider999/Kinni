/*
 * DJ Nexus Pro audio engine: public C API.
 *
 * One header for every platform (Windows, macOS, Linux, Android, iOS) and for
 * Flutter via dart:ffi. All functions are plain C so any FFI can call them.
 *
 * Threading contract
 *   - djn_engine_process() is called ONLY from the audio thread (the host does
 *     this for you when you use djn_host_*). It never allocates, locks or does I/O.
 *   - Every other djn_engine_* / djn_deck_* / djn_mixer_* function is a control
 *     call. Control calls may come from any non-audio thread (e.g. the UI thread
 *     plus a background loader); they are serialised internally without ever
 *     blocking the audio thread. Actions apply at the start of the next block.
 *   - djn_record_start/stop and djn_host_* should come from one thread at a time.
 *   - Call djn_engine_collect_garbage() from a control thread now and then
 *     (e.g. once per UI frame). It frees tracks the audio thread released.
 */
#ifndef DJNEXUS_H
#define DJNEXUS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(_WIN32) && defined(DJN_BUILD_SHARED)
#  define DJN_API __declspec(dllexport)
#elif defined(__GNUC__) || defined(__clang__)
#  define DJN_API __attribute__((visibility("default")))
#else
#  define DJN_API
#endif

#define DJN_VERSION_MAJOR 0
#define DJN_VERSION_MINOR 1
#define DJN_VERSION_PATCH 0

#define DJN_MAX_DECKS          4
#define DJN_MAX_HOT_CUES       16
#define DJN_MAX_FX_UNITS       2
#define DJN_MAX_SAMPLER_SLOTS  64

typedef enum djn_result {
  DJN_OK = 0,
  DJN_ERR_INVALID_ARG = -1,
  DJN_ERR_QUEUE_FULL = -2,   /* control queue full; retry next frame */
  DJN_ERR_NO_MEMORY = -3,
  DJN_ERR_IO = -4,
  DJN_ERR_UNSUPPORTED = -5,
  DJN_ERR_DEVICE = -6,
  DJN_ERR_STATE = -7
} djn_result;

typedef struct djn_engine djn_engine;

/* ---------------------------------------------------------------- engine */

typedef struct djn_engine_config {
  int32_t sample_rate;     /* device rate, e.g. 48000 */
  int32_t max_block_frames;/* largest block process() will be asked for, e.g. 4096 */
  int32_t num_decks;       /* 2..4 */
} djn_engine_config;

DJN_API djn_engine* djn_engine_create(const djn_engine_config* config);
DJN_API void        djn_engine_destroy(djn_engine* engine);
DJN_API const char* djn_version_string(void);

/*
 * Audio thread. Renders `frames` frames of interleaved float audio.
 * `out_channels` = 2: stereo master.
 * `out_channels` = 4: master on 0/1, headphone cue mix on 2/3.
 * Returns DJN_OK or DJN_ERR_INVALID_ARG (frames > max_block_frames).
 */
DJN_API int djn_engine_process(djn_engine* engine, float* out, int32_t frames, int32_t out_channels);

DJN_API int32_t djn_engine_sample_rate(const djn_engine* engine);
DJN_API int32_t djn_engine_max_block_frames(const djn_engine* engine);
DJN_API void    djn_engine_collect_garbage(djn_engine* engine);

/* ---------------------------------------------------------------- decks */

/*
 * Load decoded PCM onto a deck. The engine copies (and resamples to the device
 * rate if needed) on the calling thread, so this can take a few hundred ms for
 * a long track: call it off the UI thread. `interleaved` has `channels` (1 or 2)
 * channels. `bpm` <= 0 means unknown (sync and beat loops are then disabled).
 * `first_beat_sec` is the position of the first downbeat.
 */
DJN_API int djn_deck_load_pcm(djn_engine* engine, int32_t deck,
                              const float* interleaved, int64_t frames,
                              int32_t channels, int32_t sample_rate,
                              double bpm, double first_beat_sec);

/* Decode a file (WAV, FLAC, MP3) and load it. Returns DJN_ERR_UNSUPPORTED on
   builds without the built-in decoder. Blocking: call off the UI thread. */
DJN_API int djn_deck_load_file(djn_engine* engine, int32_t deck, const char* utf8_path,
                               double bpm, double first_beat_sec);

DJN_API int djn_deck_unload(djn_engine* engine, int32_t deck);

/* Replace the beat grid of the loaded track, e.g. after the user corrects the
   BPM or re-analysis finishes. bpm <= 0 removes the grid. */
DJN_API int djn_deck_set_grid(djn_engine* engine, int32_t deck, double bpm, double first_beat_sec);

DJN_API int djn_deck_play(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_pause(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_toggle_play(djn_engine* engine, int32_t deck);

/* CDJ-style cue: when paused, sets the cue point here (snapped to the beat when
   quantize is on). When playing, jumps back to the cue point and pauses. */
DJN_API int djn_deck_cue(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_seek(djn_engine* engine, int32_t deck, double seconds);

/* Hot cues: slot 0..15. set stores the current position (quantized if on). */
DJN_API int djn_deck_hot_cue_set(djn_engine* engine, int32_t deck, int32_t slot);
DJN_API int djn_deck_hot_cue_set_at(djn_engine* engine, int32_t deck, int32_t slot, double seconds);
DJN_API int djn_deck_hot_cue_trigger(djn_engine* engine, int32_t deck, int32_t slot);
DJN_API int djn_deck_hot_cue_clear(djn_engine* engine, int32_t deck, int32_t slot);

/* Loops */
DJN_API int djn_deck_loop_in(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_loop_out(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_loop_beats(djn_engine* engine, int32_t deck, double beats); /* auto loop, 1/32..64 */
DJN_API int djn_deck_loop_exit(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_loop_halve(djn_engine* engine, int32_t deck);
DJN_API int djn_deck_loop_double(djn_engine* engine, int32_t deck);

/* Tempo: `pitch` is a fraction, e.g. +0.06 = +6%. Range clamps to +-0.5. */
DJN_API int djn_deck_set_pitch(djn_engine* engine, int32_t deck, double pitch);
DJN_API int djn_deck_set_key_lock(djn_engine* engine, int32_t deck, int32_t enabled);
DJN_API int djn_deck_set_quantize(djn_engine* engine, int32_t deck, int32_t enabled);
DJN_API int djn_deck_set_slip(djn_engine* engine, int32_t deck, int32_t enabled);
DJN_API int djn_deck_set_reverse(djn_engine* engine, int32_t deck, int32_t enabled);

/* Sync: match tempo and beat phase to the master deck (see djn_engine_set_master_deck). */
DJN_API int djn_deck_set_sync(djn_engine* engine, int32_t deck, int32_t enabled);
DJN_API int djn_engine_set_master_deck(djn_engine* engine, int32_t deck); /* -1 = auto */

/* Jog wheel. Touch = platter held (vinyl mode). While touched, `rate` is the
   platter speed relative to normal playback (1 = normal, 0 = stopped, negative =
   backwards). When not touched, `rate` is a temporary pitch bend offset (nudge),
   e.g. +0.04 for a small push. */
DJN_API int djn_deck_jog(djn_engine* engine, int32_t deck, int32_t touched, double rate);

/* ---------------------------------------------------------------- mixer */

typedef enum djn_eq_mode {
  DJN_EQ_CLASSIC = 0,   /* shelves + bell, -26..+6 dB */
  DJN_EQ_ISOLATOR = 1   /* 3-band crossover, each band 0 (kill) .. +6 dB */
} djn_eq_mode;

typedef enum djn_xfader_assign { DJN_XF_THRU = 0, DJN_XF_A = 1, DJN_XF_B = 2 } djn_xfader_assign;

typedef enum djn_xfader_curve {
  DJN_XF_CURVE_SMOOTH = 0, /* constant power blend */
  DJN_XF_CURVE_SHARP = 1   /* scratch cut: full level until the last few % */
} djn_xfader_curve;

/* Channel strip values (all smoothed internally, so they can be set at UI rate). */
DJN_API int djn_mixer_set_trim_db(djn_engine* engine, int32_t channel, float db);    /* -24..+12 */
DJN_API int djn_mixer_set_eq_db(djn_engine* engine, int32_t channel, int32_t band, float db); /* band 0=low 1=mid 2=high */
DJN_API int djn_mixer_set_eq_mode(djn_engine* engine, djn_eq_mode mode);
DJN_API int djn_mixer_set_filter(djn_engine* engine, int32_t channel, float value);  /* colour knob: -1 .. 0 off .. +1 */
DJN_API int djn_mixer_set_filter_resonance(djn_engine* engine, float resonance);      /* 0..1 (same as the colour parameter) */

/*
 * Colour FX, as on a club mixer: one type for the whole mixer, played on each
 * channel by that channel's colour knob (djn_mixer_set_filter). Left and right
 * of centre give two flavours; the colour parameter shapes the sound.
 */
typedef enum djn_color_fx {
  DJN_COLOR_FILTER = 0,    /* left low-pass, right high-pass. param = resonance */
  DJN_COLOR_NOISE = 1,     /* filtered white noise: left rumble, right hiss. param = level */
  DJN_COLOR_DUB_ECHO = 2,  /* 3/4-beat echo send with filtered repeats; rings out. param = feedback */
  DJN_COLOR_PITCH = 3,     /* left pitches down, right up, up to an octave */
  DJN_COLOR_CRUSH = 4,     /* bit crusher with low-/high-pass */
  DJN_COLOR_SPACE = 5      /* reverb send with filtered return; rings out. param = decay */
} djn_color_fx;

DJN_API int djn_mixer_set_color_fx(djn_engine* engine, djn_color_fx type);
DJN_API int djn_mixer_set_color_param(djn_engine* engine, float value);               /* 0..1 */
DJN_API int djn_mixer_set_fader(djn_engine* engine, int32_t channel, float value);   /* 0..1 */
DJN_API int djn_mixer_set_xfader_assign(djn_engine* engine, int32_t channel, djn_xfader_assign assign);
DJN_API int djn_mixer_set_cue(djn_engine* engine, int32_t channel, int32_t enabled); /* headphone PFL */
DJN_API int djn_mixer_set_crossfader(djn_engine* engine, float position);            /* 0 = A .. 1 = B */
DJN_API int djn_mixer_set_crossfader_curve(djn_engine* engine, djn_xfader_curve curve);
DJN_API int djn_mixer_set_master_db(djn_engine* engine, float db);                  /* -inf..+6, clamps at -80 */
DJN_API int djn_mixer_set_limiter(djn_engine* engine, int32_t enabled, float ceiling_db);
DJN_API int djn_mixer_set_cue_mix(djn_engine* engine, float cue_to_master);         /* 0 = cue only .. 1 = master only */
DJN_API int djn_mixer_set_headphone_db(djn_engine* engine, float db);

/* ---------------------------------------------------------------- beat FX */

/*
 * Two FX units. Each hosts one effect and is inserted on one channel (post
 * fader) or on the master bus. Timing follows the sync master deck's tempo and
 * beat position (or djn_fx_set_bpm). Echo, delay, ping-pong and reverb keep
 * ringing out after the unit is switched off.
 */
typedef enum djn_fx_type {
  DJN_FX_ECHO = 0,       /* feedback echo, darkened repeats. depth = feedback */
  DJN_FX_DELAY = 1,      /* clean digital delay. depth = feedback */
  DJN_FX_PING_PONG = 2,  /* stereo bouncing echo. depth = feedback */
  DJN_FX_REVERB = 3,     /* room to hall. depth = decay time (0.5..10 s); beats unused */
  DJN_FX_FLANGER = 4,    /* beats = sweep period. depth = feedback */
  DJN_FX_PHASER = 5,     /* beats = sweep period. depth = feedback */
  DJN_FX_ROLL = 6,       /* repeats the last beats-long slice, starting on the beat */
  DJN_FX_STUTTER = 7,    /* gated roll */
  DJN_FX_TRANS = 8,      /* rhythmic volume cuts. depth = cut depth */
  DJN_FX_PITCH = 9,      /* pitch shift. depth 0..1 = -12..+12 semitones (0.5 = none) */
  DJN_FX_DISTORTION = 10,/* depth = drive */
  DJN_FX_CRUSH = 11      /* bit / sample-rate reduction. depth = amount */
} djn_fx_type;

#define DJN_FX_TARGET_MASTER (-1)

DJN_API int djn_fx_set_type(djn_engine* engine, int32_t unit, djn_fx_type type);
DJN_API int djn_fx_set_beats(djn_engine* engine, int32_t unit, double beats);   /* 1/16 .. 16 */
DJN_API int djn_fx_set_depth(djn_engine* engine, int32_t unit, float depth);    /* 0..1 */
DJN_API int djn_fx_set_wet(djn_engine* engine, int32_t unit, float wet);        /* 0..1 dry/wet */
DJN_API int djn_fx_set_target(djn_engine* engine, int32_t unit, int32_t target);/* channel 0..3 or DJN_FX_TARGET_MASTER */
DJN_API int djn_fx_set_on(djn_engine* engine, int32_t unit, int32_t on);
/* Tempo for FX and sampler timing. 0 (default) follows the sync master deck. */
DJN_API int djn_fx_set_bpm(djn_engine* engine, double bpm);

/* ---------------------------------------------------------------- sampler */

/*
 * 64 sample slots, 16 voices. The app maps slots to pads and banks.
 */
typedef enum djn_pad_mode {
  DJN_PAD_ONE_SHOT = 0,  /* plays to the end; pressing again restarts */
  DJN_PAD_GATE = 1,      /* plays while held */
  DJN_PAD_LOOP = 2,      /* loops while held */
  DJN_PAD_TOGGLE = 3     /* press to start looping, press again to stop */
} djn_pad_mode;

#define DJN_SAMPLER_TO_MASTER (-1)

/* Load a sample (copied and resampled to the engine rate on the calling
   thread). bpm > 0 lets loops follow the master tempo. */
DJN_API int djn_sampler_load_pcm(djn_engine* engine, int32_t slot, const float* interleaved, int64_t frames,
                                 int32_t channels, int32_t sample_rate, double bpm);
DJN_API int djn_sampler_load_file(djn_engine* engine, int32_t slot, const char* utf8_path, double bpm);
DJN_API int djn_sampler_unload(djn_engine* engine, int32_t slot);
/* Capture the last `beats` beats a deck played (pre-fader) into a slot, e.g.
   for instant loops and vocal chops. Uses the deck's current tempo. */
DJN_API int djn_sampler_capture(djn_engine* engine, int32_t slot, int32_t deck, double beats);

DJN_API int djn_sampler_set_mode(djn_engine* engine, int32_t slot, djn_pad_mode mode);
DJN_API int djn_sampler_set_choke(djn_engine* engine, int32_t slot, int32_t group);   /* 0 = none, 1..8 */
DJN_API int djn_sampler_set_gain_db(djn_engine* engine, int32_t slot, float db);      /* -60..+12 */
DJN_API int djn_sampler_set_pitch(djn_engine* engine, int32_t slot, float semitones); /* -24..+24 */
DJN_API int djn_sampler_set_sync(djn_engine* engine, int32_t slot, int32_t enabled);  /* loops follow tempo (default on) */

DJN_API int djn_sampler_trigger(djn_engine* engine, int32_t slot, float velocity);    /* pad pressed, velocity 0..1 */
DJN_API int djn_sampler_release(djn_engine* engine, int32_t slot);                    /* pad released */
DJN_API int djn_sampler_stop_all(djn_engine* engine);

DJN_API int djn_sampler_set_quantize(djn_engine* engine, double beats);  /* start on the next 1/4, 1, ... beat; 0 = off */
DJN_API int djn_sampler_set_volume_db(djn_engine* engine, float db);
/* Where the sampler plays: DJN_SAMPLER_TO_MASTER (default), or a channel
   0..3 so it goes through that channel's EQ, filter, fader and FX. */
DJN_API int djn_sampler_set_output(djn_engine* engine, int32_t target);

/* ---------------------------------------------------------------- macros */

/*
 * Performance macros. Each one lands on a bar line (bars counted in 4 beats
 * from the grid's first beat) using the FX/sampler beat clock.
 */
typedef enum djn_macro {
  DJN_MACRO_RISER = 0,     /* noise sweep and rising tone over `bars` bars */
  DJN_MACRO_BUILD_UP = 1,  /* high-pass sweep + reverb wash + riser, accelerating roll in the last bar */
  DJN_MACRO_DROP = 2       /* cut the audio until the next bar line, then back in */
} djn_macro;

/* Start a macro (replacing any running one). `target` is a channel 0..3 or
   DJN_FX_TARGET_MASTER. `impact` = 1 adds a sub boom on the drop (build-up and drop). */
DJN_API int djn_macro_start(djn_engine* engine, djn_macro macro, int32_t bars, int32_t target, int32_t impact);
DJN_API int djn_macro_cancel(djn_engine* engine);

/* ---------------------------------------------------------------- state */

typedef struct djn_deck_state {
  int32_t loaded;
  int32_t playing;
  int32_t key_lock;
  int32_t sync;
  int32_t slip;
  int32_t reverse;
  int32_t looping;
  int32_t is_master;
  double  position_sec;    /* playhead */
  double  duration_sec;
  double  slip_position_sec;
  double  track_bpm;       /* grid BPM of the file */
  double  effective_bpm;   /* track_bpm * current rate */
  double  rate;            /* current playback rate */
  double  beat_phase;      /* 0..1 within the current beat, -1 when no grid */
  int64_t beat_index;      /* beats since first_beat, may be negative */
  double  loop_start_sec;
  double  loop_end_sec;
  double  cue_sec;
  float   peak_l, peak_r;  /* post-fader channel peak since last read (linear) */
} djn_deck_state;

typedef struct djn_fx_state {
  int32_t on;
  int32_t type;         /* djn_fx_type */
  int32_t target;       /* channel, or DJN_FX_TARGET_MASTER */
  int32_t tail_active;  /* switched off but still ringing out */
  double  beats;
  float   depth;
  float   wet;
} djn_fx_state;

typedef struct djn_engine_state {
  int32_t sample_rate;
  int32_t num_decks;
  int32_t master_deck;         /* -1 when no deck qualifies */
  float   master_peak_l, master_peak_r;
  float   limiter_gain_reduction_db;
  int32_t recording;
  double  recorded_sec;
  uint64_t xruns;              /* blocks where the recorder ring overflowed */
  uint64_t blocks_processed;
  double  dsp_load;            /* last block processing time / block duration, 0..1+ */
  djn_deck_state decks[DJN_MAX_DECKS];
  djn_fx_state fx[DJN_MAX_FX_UNITS];
  double   clock_bpm;        /* tempo driving FX and the sampler */
  double   clock_beat;       /* beat position of that clock */
  uint64_t sampler_loaded;   /* bit n = slot n has a sample */
  uint64_t sampler_playing;  /* bit n = slot n is sounding */
  int32_t  color_fx;         /* djn_color_fx */
  float    color_param;
  int32_t  macro;            /* running djn_macro, or -1 */
  int32_t  macro_target;
  double   macro_progress;   /* 0..1 */
  double   macro_beats_left;
} djn_engine_state;

/* Snapshot of the engine; peaks reset on read. Call at UI rate. */
DJN_API int djn_engine_get_state(djn_engine* engine, djn_engine_state* out);

/* ---------------------------------------------------------------- recording */

typedef enum djn_rec_format {
  DJN_REC_WAV16 = 0,
  DJN_REC_WAV24 = 1,
  DJN_REC_WAV_FLOAT = 2
} djn_rec_format;

/* Records the master output (post-limiter) to a WAV file on a background thread. */
DJN_API int djn_record_start(djn_engine* engine, const char* utf8_path, djn_rec_format format);
DJN_API int djn_record_stop(djn_engine* engine);

/* ---------------------------------------------------------------- host */

typedef struct djn_host djn_host;

typedef struct djn_host_config {
  int32_t sample_rate;        /* ignored: the engine's rate is used */
  int32_t buffer_frames;      /* 0 = low-latency default */
  int32_t output_channels;    /* 2 or 4 (4 = master + headphone cue) */
  const char* device_name;    /* NULL = default device (desktop only) */
} djn_host_config;

typedef struct djn_host_info {
  int32_t sample_rate;
  int32_t buffer_frames;
  int32_t output_channels;
  double  output_latency_ms;  /* best estimate from the platform */
  char    backend[32];        /* e.g. "wasapi", "coreaudio", "alsa", "aaudio", "remoteio" */
} djn_host_info;

/*
 * Opens the platform audio device and starts calling djn_engine_process().
 * Desktop: miniaudio (WASAPI / CoreAudio / ALSA / PulseAudio / JACK).
 * Android: Oboe (AAudio, falling back to OpenSL ES).
 * iOS: RemoteIO audio unit with an AVAudioSession configured for playback.
 * The device runs at the engine's sample rate (the platform resamples if it
 * must). Create the engine with djn_host_preferred_sample_rate() to avoid that.
 * config->sample_rate is ignored; it is taken from the engine.
 */
DJN_API djn_host* djn_host_start(djn_engine* engine, const djn_host_config* config);
DJN_API void      djn_host_stop(djn_host* host);
DJN_API int       djn_host_get_info(const djn_host* host, djn_host_info* out);

/* Convenience: query the device's preferred sample rate before creating the engine. */
DJN_API int32_t   djn_host_preferred_sample_rate(void);

#ifdef __cplusplus
}
#endif

#endif /* DJNEXUS_H */
