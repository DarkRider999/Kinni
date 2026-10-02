# DJ RadicalMix -- SplitFire Production (web)

A real, working browser DJ console: two decks, mixer, beat FX, colour FX, performance macros and a sampler,
all running the actual **DJ Nexus Pro C++ audio engine** (`../dj-nexus-pro/engine`) compiled to WebAssembly --
not a simulation. On top of that: a local track library with automatic BPM/key detection and the **RadicalAI**
next-track advisor, both JS ports of that engine's native, unit-tested analyzer and scoring formula.

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
  re-decoded on demand when loaded to a deck.
- `src/lib/starterSounds.ts` -- 8 procedurally synthesized sampler one-shots (kick/clap/hats/riser/impact/
  tag). Not the blueprint's licensed 10,000+ pack library -- placeholders so the sampler screen is real and
  playable without any content this environment can't source.
- `src/views/*` -- the screens (Home, Decks & Mixer, Library & RadicalAI, Sampler, FX Rack, Settings).

## Testing

```bash
npm run test   # vitest: analysis.ts + advisor.ts against the same fixtures as the C++ engine's test suite
npm run lint   # oxlint
npm run e2e    # builds, serves, and drives the built app in a real headless browser (Playwright):
               # imports synthetic fixtures, checks real BPM/key detection and the AI advisor, loads a
               # deck, plays it, and exercises the sampler/FX/settings screens. Screenshots land in
               # scripts/.e2e-out/ (gitignored).
```

`npm run build` type-checks (`tsc -b`) before bundling, so a broken type is a build failure, not a runtime
surprise.

## Known limitations

- **BPM/key detection** is DSP-based (onset spectral flux + autocorrelation; FFT-chroma + Krumhansl-Schmuckler
  key), not ML -- it's been tested against synthetic fixtures including a kick mixed with a sustained chord,
  but a real, complex mix may still fool it. Confidence scores are available on `AnalysisResult` for a UI to
  surface low-confidence results; this build doesn't yet show that in the library table.
- **Recording** produces WebM/Opus (what `MediaRecorder` can do), not WAV/FLAC -- that needs a native build.
- **No cross-device sync, no accounts** -- this is a single-tab, local-only build.
