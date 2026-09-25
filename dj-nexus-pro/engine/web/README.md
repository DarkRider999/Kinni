# Deck Lab (browser preview)

A two-deck DJ console with colour FX, beat FX, build/drop macros, a 16-pad sampler and MIDI controller support, running the real DJ Nexus engine
compiled to WebAssembly. It exists so anyone can hear and test the engine
without installing the app.

```bash
./build.sh                      # rebuilds djnexus.wasm + djnexus-asm.js into this folder
python3 -m http.server 8000     # then open http://localhost:8000
```

| File | What it is |
|---|---|
| `index.html` | The console UI: decks, mixer, beat FX, sampler, MIDI panel, waveforms, BPM detection, demo tracks and pad sounds |
| `djnexus-runtime.js` | JS wrapper around the engine; works in an AudioWorklet or on the main thread |
| `djnexus-worklet.js` | AudioWorklet processor that renders the engine on the audio thread |
| `djnexus-analyzer.js` | Web Worker running the engine's track analysis (BPM, downbeat, key) off the main thread |
| `djnexus.wasm` | The engine (`src/`) built for `wasm32-wasi` with `-DDJN_NO_THREADS` (generated) |
| `djnexus-asm.js` | The same build converted to plain JS by `wasm2js`, used only if WebAssembly is blocked (generated) |

Start-up picks the best path that works: AudioWorklet + WebAssembly, then
AudioWorklet + JS, then the main thread (ScriptProcessorNode) with either.

Browser build differences: no recording (it needs a disk-writer thread), no
headphone cue (browsers expose stereo output), and loading a track briefly
pauses audio because loading runs on the audio thread.

MIDI: the page asks for Web MIDI (Chrome and Edge; not Safari) and passes
controller bytes to the engine's `djn_midi_feed`; LED bytes come back from the
engine every ~5 ms and go to the chosen output. The panel also has a monitor,
MIDI Learn, a mapping editor and a hex test-message box, so mappings can be
tried without hardware. Embedded previews (iframes) usually can't get MIDI
permission; open the page directly for hardware.
