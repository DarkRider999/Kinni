# DJ Nexus Pro audio engine

The real-time audio core of DJ Nexus Pro: decks, key lock, mixer, master bus and recorder, in portable C++17 behind a plain C API. The same code runs on **Windows, macOS, Linux, Android and iOS**. Flutter calls it through `dart:ffi` (see [SPEC §10](../../docs/dj-nexus-pro/SPEC.md#10-technical-architecture)).

```
 control thread (UI)                          audio thread (device callback)
 ───────────────────                          ──────────────────────────────
 djn_deck_play() ──► lock-free command queue ──► Deck × 4 ──► ChannelStrip × 4 ──► crossfader ──► master gain ──► limiter ──► device
 djn_mixer_set_*() ─► atomic parameters ───────┘  (varispeed    (trim, EQ,          │                                      ├─► recorder ring ─► WAV writer thread
 djn_engine_get_state() ◄── atomic telemetry ◄──   or key-lock    filter, fader)     └─► headphone cue bus (pre-fader)     │
 djn_engine_collect_garbage() ◄── released tracks  stretcher)                                                               └─► channels 3/4 on 4-ch interfaces
```

## What's in this milestone

| Area | Features |
|---|---|
| Decks (up to 4) | Play/pause with de-click ramp, CDJ-style cue, 16 hot cues, seek, end-of-track stop |
| Tempo | Pitch ±50%, **key lock** (built-in WSOLA time-stretcher), nudge, vinyl scratch via jog, reverse |
| Sync | Tempo + beat-phase sync to a master deck (auto or manual), phase-locked loop with half/double-time matching, quantized hot cues |
| Loops | Loop in/out, beat loops 1/32–64 beats snapped to the grid, halve/double, **slip mode** |
| Seamless jumps | Every jump, loop wrap and engine switch is crossfaded over ~5 ms, so no clicks |
| Mixer | Trim, 3-band EQ (classic −26/+6 dB or isolator with full kill), bipolar LPF/HPF filter with resonance, channel faders, crossfader (smooth / sharp curves), A/B/THRU assign |
| Master | Master gain, look-ahead peak limiter, peak meters, headphone cue mix on 4-channel interfaces |
| Beat FX | 2 FX units, each on any channel (post-fader) or the master: Echo, Delay, Ping-Pong, Reverb, Flanger, Phaser, Roll, Stutter, Trans, Pitch, Distortion, Crush. Timed from the sync master's beat grid (divisions 1/16–16 beats); echoes and reverb ring out after switching off; rolls start on the last beat line |
| Sampler | 64 slots, 16 voices; one-shot, gate, loop and toggle pads; choke groups; per-pad pitch and level; quantized triggers; loops follow the master tempo with key lock; routing to master or through a channel; **capture the last N beats from any deck** into a pad |
| Recording | WAV 16-bit (TPDF dither) / 24-bit / 32-bit float, written off the audio thread |
| Loading | Any PCM from the app (`djn_deck_load_pcm`), grid updates after load (`djn_deck_set_grid`) or WAV/FLAC/MP3 files (`djn_deck_load_file`); tracks are resampled to the device rate with a band-limited sinc resampler |
| Hosts | Desktop: miniaudio (WASAPI, CoreAudio, PulseAudio/ALSA/JACK). Android: Oboe (AAudio/OpenSL ES). iOS: RemoteIO + AVAudioSession |

Real-time rules on the audio thread: no allocation, no locks, no file I/O, no logging. Denormals are flushed to zero on x86, ARM64 and ARMv7.

## Verified

| Check | Result |
|---|---|
| 47 unit/integration tests (x86-64 Linux) | pass |
| Same tests under ASan + UBSan | pass, no reports |
| Multi-thread stress test (audio + UI + background loader + recorder) under TSan | pass, no data races |
| Same tests on **ARM64** and **ARMv7** (cross-compiled, run under QEMU) | pass |
| Same tests on **Windows** (MinGW cross-build, run under Wine), incl. Unicode file paths | pass |
| Desktop host in real time (miniaudio null device) with two synced decks | 0.4% DSP load, beat phases locked |
| Android host against Oboe 1.9.3 headers | type-checks clean |
| iOS host | **not compiled here** (needs Xcode); the CI workflow builds it on macOS |

The GitHub Actions workflow [`.github/workflows/dj-nexus-engine.yml`](../../.github/workflows/dj-nexus-engine.yml) builds and tests on Linux, Windows (MSVC) and macOS, runs the sanitizers, builds Android `.so` files for arm64-v8a / armeabi-v7a / x86_64 with the NDK, and builds the iOS static library with Xcode.

**Benchmark** (`djnexus_bench`, one x86-64 cloud core, 60 s of audio per case):

| Case | × real time |
|---|---|
| 2 decks, varispeed, classic EQ | ~200 |
| 2 decks, key lock | ~178 |
| 4 decks, key lock, isolator EQ, filters (256-frame blocks) | ~70 |
| 4 decks, key lock, isolator EQ, filters (64-frame blocks) | ~60 |
| Same + reverb and echo running + 8 sampler voices (4 key-locked loops) | ~47 |

70× real time means a 4-deck key-locked mix uses about 1.4% of one core. Expect phones to be roughly 3–6× slower; run `djnexus_bench` on the reference devices from SPEC §16.1 to get real figures.

## Building

Requires CMake ≥ 3.18 and a C++17 compiler.

### Windows, macOS, Linux

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
ctest --test-dir build -C Release          # run the tests
build/djnexus_bench                        # CPU benchmark
```

For Flutter desktop, build the shared library with `-DDJN_SHARED=ON` (produces `djnexus.dll`, `libdjnexus.dylib` or `libdjnexus.so`).

Try it with real music:

```bash
# Real-time: two decks on your sound card, typed commands ('a play', 'b sync', 'b play', 'x 0.5', 'info', 'q')
build/djnexus_play trackA.mp3 124 trackB.mp3 128

# Offline: beat-synced 16-bar bass-swap transition rendered to a WAV (no sound card needed)
build/djnexus_render trackA.mp3 124 0.05 trackB.mp3 128 0.12 mix.wav 60
```

Set `DJN_AUDIO_BACKEND` to force a backend: `wasapi`, `dsound`, `coreaudio`, `pulseaudio`, `alsa`, `jack` or `null`.

### Android

Use the engine as the app's native library. In the app module's `build.gradle.kts`:

```kotlin
android {
    defaultConfig {
        minSdk = 28
        externalNativeBuild { cmake { arguments += listOf("-DDJN_SHARED=ON", "-DANDROID_STL=c++_shared") } }
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    }
    externalNativeBuild { cmake { path = file("../../dj-nexus-pro/engine/CMakeLists.txt") } }
    buildFeatures { prefab = true }
}
dependencies { implementation("com.google.oboe:oboe:1.9.3") }
```

This produces `libdjnexus.so`; Flutter loads it with `DynamicLibrary.open('libdjnexus.so')`. Without Gradle, pass `-DDJN_OBOE_SOURCE_DIR=/path/to/oboe` to build Oboe from source (this is what CI does). The library is linked with 16 KB page alignment for Android 15+ devices.

### iOS

```bash
cmake -S . -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0 -DCMAKE_OSX_ARCHITECTURES=arm64
cmake --build build-ios --config Release -- -sdk iphoneos
```

Link `libdjnexus.a` into the Flutter iOS runner (plus the AVFoundation, AudioToolbox and CoreAudio frameworks) and look symbols up with `DynamicLibrary.process()`. Add `audio` to `UIBackgroundModes` in `Info.plist` so sets keep playing with the screen locked.

### Build options

| Option | Default | Meaning |
|---|---|---|
| `DJN_HOST` | `auto` | `desktop`, `android`, `ios` or `none` (headless: you call `djn_engine_process` yourself) |
| `DJN_WITH_DECODER` | `ON` | Built-in WAV/FLAC/MP3 decoding. Turn off if the app decodes with MediaCodec / AVAudioFile and calls `djn_deck_load_pcm` |
| `DJN_SHARED` | `OFF` | Shared library for FFI (only the `djn_*` C API is exported) |
| `DJN_OBOE_SOURCE_DIR` | empty | Android: build Oboe from a source checkout instead of the Gradle prefab |

## Using the API

```c
#include "djnexus/djnexus.h"

djn_engine_config cfg = { djn_host_preferred_sample_rate(), 1024, 2 };
djn_engine* e = djn_engine_create(&cfg);
djn_host* host = djn_host_start(e, &(djn_host_config){ .output_channels = 2 });

// Off the UI thread (decoding + resampling take a moment):
djn_deck_load_file(e, 0, "/music/solar_drift.mp3", 126.0, 0.052);  // BPM + first downbeat from analysis
djn_deck_load_file(e, 1, "/music/hollow_signal.flac", 128.0, 0.110);

djn_mixer_set_xfader_assign(e, 0, DJN_XF_A);
djn_mixer_set_xfader_assign(e, 1, DJN_XF_B);
djn_deck_play(e, 0);
djn_deck_set_key_lock(e, 1, 1);
djn_deck_set_sync(e, 1, 1);          // B follows A's tempo and beat phase
djn_deck_play(e, 1);
djn_mixer_set_eq_db(e, 1, 0, -26);   // bass out on B ...
djn_mixer_set_crossfader(e, 0.5f);   // ... and blend

// Beat FX: 1/2-beat echo on the master, ringing out when switched off
djn_fx_set_type(e, 0, DJN_FX_ECHO);
djn_fx_set_beats(e, 0, 0.5);
djn_fx_set_target(e, 0, DJN_FX_TARGET_MASTER);
djn_fx_set_on(e, 0, 1);

// Sampler: an air horn on slot 0, and the last 4 beats of deck A as a synced loop on slot 1
djn_sampler_load_file(e, 0, "/samples/airhorn.wav", 0);
djn_sampler_trigger(e, 0, 1.0f);
djn_sampler_capture(e, 1, 0, 4.0);
djn_sampler_set_mode(e, 1, DJN_PAD_TOGGLE);
djn_sampler_set_quantize(e, 1.0);    // pads start on the next beat

// Once per UI frame:
djn_engine_state s;
djn_engine_get_state(e, &s);         // positions, BPM, beat phase, loop, meters, DSP load
djn_engine_collect_garbage(e);       // frees tracks the audio thread released
```

BPM and first-beat values come from the Smart DJ Bot's analysis models (AI blueprint A1/A3). Without them (`bpm = 0`), everything except sync, quantize and beat loops still works.

## Browser preview

[`web/`](web/) builds the same engine to WebAssembly and wraps it in a two-deck console ("Deck Lab") so the engine can be heard without installing anything. See [web/README.md](web/README.md).

## Not in this milestone yet

- **Colour FX** variants beyond the filter (noise, dub echo, crush on the channel knob) and the build tools (riser / build-up / drop macros).
- **Slip roll** as a deck feature: today a slip + beat loop gives the same result; the app can map its Slip Roll button to that.
- **Stems playback** (4-stem decks fed by the AI Stem Splitter).
- **Commercial time-stretcher.** The built-in WSOLA stretcher passes the pitch and level-stability tests and is fine for development. SPEC §10.1 plans a Rubber Band / Superpowered bake-off before launch; `Stretcher` is isolated behind a small interface for that swap.
- **AAC/M4A/ALAC decoding.** Use the platform decoders (MediaCodec, AVAudioFile) and `djn_deck_load_pcm`.
- **MIDI controllers**, a waveform/peaks API for the UI, and the Dart FFI bindings (generate them from `djnexus.h` with `ffigen`).
- **Very long recordings.** WAV files stop at 4 GB (about 6 h of 16-bit stereo at 48 kHz); RF64 is a follow-up.
- **Latency on real devices** (target ≤ 20 ms from SPEC §2.3) still has to be measured on the device lab.

## Layout

```
include/djnexus/djnexus.h   public C API (the only header apps need)
src/core/                   engine, deck, stretcher, channel strip, DSP, recorder, resampler
src/hosts/                  host_desktop.cpp · host_android.cpp · host_ios.mm · host_none.cpp
src/decode/                 file decoding (miniaudio)
tests/                      tests (no external framework) + benchmark
tools/                      djnexus_play (real time) · djnexus_render (offline mix)
third_party/miniaudio/      miniaudio 0.11.22 (public domain / MIT-0)
```
