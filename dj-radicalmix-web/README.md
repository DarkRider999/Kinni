# DJ RadicalMix -- SplitFire Production (web)

A real, working browser DJ console: two decks (with waveform displays and hot cue markers), mixer, beat FX,
colour FX, performance macros and a sampler, all running the actual **DJ Nexus Pro C++ audio engine**
(`../dj-nexus-pro/engine`) compiled to WebAssembly -- not a simulation. On top of that: a local track library
with automatic BPM/key detection, smart + manual crates, and the **RadicalAI** next-track advisor (surfaced
both in the library and as a live radar on the Decks screen), all JS ports of (or built on) that engine's
native, unit-tested analyzer and scoring formula. Loading a track also auto-detects its intro/drop/outro from
its energy envelope and sets hot cues 1-3 to them -- no manual tagging needed. An **Auto-Mix** mode will pick,
load and crossfade into the AI's top suggestion as the playing deck nears its end, optionally washing a Smart
Reverb over the outgoing track during the transition. One-tap **Smart Flanger**/**Smart Reverb** presets sit
on the FX Rack. Any class-compliant MIDI mixer/controller can drive transport, cue and fader controls via
**MIDI Learn** (Web MIDI). Recording a set also produces an auto-built tracklist alongside the audio. Keyboard
shortcuts cover transport and hot cues.

See [`docs/dj-radicalmix/SPEC.md`](../docs/dj-radicalmix/SPEC.md) for the full product blueprint and what of
it this build does and doesn't implement (short version: the real-time engine, BPM/key detection and the
next-track advisor are real; the 10,000+ sampler/plugin library, stem separation, cloud sync/master-access and
billing are not -- they need licensed content, a trained ML model, a deployed backend and store accounts this
environment doesn't have).

## Running it

```bash
npm install
npm run dev       # dev server with hot reload
# or
npm run build && npm run preview   # production build, served statically
```

Open the printed URL and click **Enter the Booth** (browsers require a user gesture before audio can start).
Everything runs locally in the tab -- the library is stored in this browser's IndexedDB and nothing is
uploaded anywhere.

## Architecture

- `public/engine/` -- the compiled engine artifacts (`djnexus.wasm`, `djnexus-runtime.js`,
  `djnexus-worklet.js`, `djnexus-asm.js` as a plain-JS fallback), copied from
  `../dj-nexus-pro/engine/web/`. To pick up engine changes, rebuild there (`./build.sh`, needs
  clang+wasm32-wasi+binaryen -- not available in every environment) and re-copy.
- `src/engine/engineBridge.ts` -- runs the engine on an `AudioWorklet` (falling back to a
  `ScriptProcessorNode` on the main thread, then to the plain-JS build). Ported from the proven bootstrap in
  `../dj-nexus-pro/engine/web/index.html` ("Deck Lab") rather than re-derived, since that wiring is easy to
  get subtly wrong. `engine.call(fn, ...args)` invokes any exported `djn_*` function by name.
- `src/engine/analysis.ts`, `src/engine/advisor.ts` -- JS ports of the native engine's
  `src/core/analysis.cpp` (BPM/beat-grid/key detection) and `src/core/advisor.cpp` (next-track scoring).
  They're ports rather than FFI calls because the compiled `djnexus.wasm` here predates those native
  modules being added; rebuilding the wasm (see above) and switching to `djn_analyze_pcm`/`djn_advisor_score`
  calls would remove the duplication. **Keep both sides in sync** -- `analysis.test.ts`/`advisor.test.ts`
  mirror the C++ test suite's exact fixtures and assertions so a divergence shows up as a test failure on
  one side or the other.
- `src/lib/library.ts` -- local-only track library (IndexedDB): metadata plus the original file blob,
  re-decoded on demand when loaded to a deck. Also holds **crates**: manual (a track list) or smart
  (a BPM/energy/genre/mode rule, matched live -- RadicalSort from docs/dj-radicalmix Sec 2 Issue 3).
- `src/lib/waveform.ts` + `src/components/Waveform.tsx` -- per-track min/max peaks computed once at
  decode time, rendered to a canvas with a live playhead and hot cue markers (RadicalWave, Issue 10). Hot cue
  marker positions are recorded client-side when set (`useDecks.setHotCueAt`) rather than read back from the
  engine, since the engine's state doesn't expose hot cue positions -- accurate enough for a marker, but will
  be a beat-grid-snapped position off by a hair if quantize moved it.
- `src/lib/suggestions.ts` -- the next-track scoring/ranking shared by the Library screen's full RadicalAI
  panel and the Decks screen's compact **Next-Track Radar** rail, so the two never disagree.
- **Auto cue points** -- `analyzeTrack()` (`src/engine/analysis.ts`, mirrored in the native
  `analysis.cpp`/`detectStructure`) also computes a 1-second RMS energy envelope and picks an intro-end, drop
  and outro-start from it (robust-peak thresholds, not the single loudest moment, so one brief loud hit can't
  skew them). `useDecks.applyAutoCues` sets hot cues 1-3 to those positions the moment a track is loaded --
  before the DJ has touched anything -- via `djn_deck_hot_cue_set_at` (an exact-position set, distinct from
  the manual "Set mode" cue, which captures the current playhead instead).
- `src/lib/smartFx.ts` -- one-tap **Smart Flanger**/**Smart Reverb** presets (type/beat-length/depth/wet) for
  the FX Rack's two units, so a usable effect is one click away instead of five control tweaks.
- `src/state/useAutoMix.ts` -- **Auto-Mix** (Issue 24): when the playing deck is within 20s of ending and the
  other deck is idle, loads RadicalAI's top pick onto it, plays it (sync on), and crossfades over 8s. Never
  touches a deck the DJ has already loaded manually. Optionally (**Smart Outro FX**, on by default) washes
  the Smart Reverb preset over the outgoing deck for the duration of the crossfade, borrowing FX unit 2 since
  the engine only has two.
- `src/lib/midi.ts` + `src/state/useMidi.ts` -- **MIDI controller support** via the Web MIDI API
  (`navigator.requestMIDIAccess`). No per-device layouts: **MIDI Learn** binds any of a fixed action set
  (deck A/B play-pause/cue, crossfader, channel faders) to whatever note/CC the DJ moves next, persisted to
  `localStorage`. Falls back to a plain "not available" message in browsers without Web MIDI (Safari, Firefox).
  Lives at the top of `App.tsx` rather than inside `DecksView` so a controller keeps working across tabs.
- `src/state/useSessionLog.ts` -- an in-memory "what got loaded to a deck, and when" log for this session,
  exported as a .txt tracklist alongside a recording (Issue 13) -- no server needed.
- `src/lib/starterSounds.ts` -- 8 procedurally synthesized sampler one-shots (kick/clap/hats/riser/impact/
  tag). Not the blueprint's licensed 10,000+ pack library -- placeholders so the sampler screen is real and
  playable without any content this environment can't source.
- `src/views/*` -- the screens (Home, Decks & Mixer, Library & RadicalAI, Sampler, FX Rack, Settings).

## Testing

```bash
npm run test   # vitest: analysis.ts + advisor.ts against the same fixtures as the C++ engine's test suite
npm run lint   # oxlint
npm run e2e    # builds, serves, and drives the built app in a real headless browser (Playwright):
               # imports synthetic fixtures, checks real BPM/key detection and the AI advisor, creates a
               # smart crate and a manual crate, loads a deck, plays it, checks the waveform drew pixels
               # and a hot cue marker, checks a keyboard shortcut toggles playback, checks the Next-Track
               # Radar, runs a full Auto-Mix transition end to end (checks the second deck ends up loaded,
               # playing and crossfaded in), checks the one-tap Smart Flanger/Smart Reverb presets actually
               # reach the engine (not just the dropdown), checks the Settings MIDI panel renders (learn
               # table or the graceful "unsupported" message, whichever this browser hits), records a few
               # seconds, and checks the exported tracklist's contents. Screenshots land in
               # scripts/.e2e-out/ (gitignored).
```

`npm run build` type-checks (`tsc -b`) before bundling, so a broken type is a build failure, not a runtime
surprise.

## Keyboard shortcuts (Decks screen)

`Space`/`Enter` play-pause deck A/B &middot; `C`/`V` cue A/B &middot; `1`-`4` hot cues A &middot; `7`-`0` hot
cues B. Disabled while focus is in a text input/select.

## Known limitations

- **BPM/key detection** is DSP-based (onset spectral flux + autocorrelation; FFT-chroma + Krumhansl-Schmuckler
  key), not ML -- it's been tested against synthetic fixtures including a kick mixed with a sustained chord,
  but a real, complex mix may still fool it. Confidence scores are available on `AnalysisResult` for a UI to
  surface low-confidence results; this build doesn't yet show that in the library table.
- **Recording** produces WebM/Opus (what `MediaRecorder` can do), not WAV/FLAC -- that needs a native build.
- **Auto cue points** are a heuristic off the energy envelope, not beat-aware structure analysis -- a track
  with an unconventional arrangement (no clear intro/drop/outro shape) will get three cues in plausible but
  not necessarily musically "correct" places. They're a starting point, not a replacement for manual review.
- **MIDI controller support** needs a browser with Web MIDI (Chrome, Edge, Opera over HTTPS or localhost) --
  Safari and Firefox don't implement it, so those show a fallback message instead of the mapping table.
- **No cross-device sync, no accounts** -- this is a single-tab, local-only build.
