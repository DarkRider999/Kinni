# MIDI mapping format

A mapping is a plain-text file that says what each control on a MIDI controller does, and which LEDs show which engine state. Each controller model is one file, so adding a controller means writing (or learning) a mapping, not changing code.

Load one with `djn_midi_load_mapping()`. Read the current one back with `djn_midi_get_mapping()`, which includes bindings added with MIDI Learn. The engine starts with a generic template (`defaultMappingText()` in `src/midi/midi_controller.cpp`). Deck Lab shows it in its MIDI panel.

## Built-in mappings

Files in [`mappings/`](../mappings/) are compiled into the engine, so apps don't need to ship them:

| Id | Controller | Guide |
|---|---|---|
| `generic` | Template for any controller (use with MIDI Learn) | this page |
| `pioneer-ddj-flx4` | Pioneer DJ DDJ-FLX4 | [DDJ_FLX4.md](DDJ_FLX4.md) |

```c
const char* id = djn_midi_builtin_for_device(port_name);   /* "pioneer-ddj-flx4" for "DDJ-FLX4 MIDI 1" */
if (id) djn_midi_load_mapping(midi, djn_midi_builtin_text(id), NULL, 0);
```

`djn_midi_builtin_count()`, `djn_midi_builtin_id(i)` and `djn_midi_builtin_name(i)` list them for a picker. To add a controller, add a `.txt` file to `mappings/` with a `device:` line, and a test in `tests/test_midi.cpp` that plays its messages.

```
# comment
name: My Controller
device: DDJ-FLX4                     # port names containing this pick this mapping
send every=200 F0 00 40 05 00 00 04 05 00 50 02 F7   # keep-alive
send 90 10 7F                        # sent once when the mapping loads

note 1 0x0B -> deck1.play            # a button
cc 1 0x13 -> deck1.volume            # a fader
cc14 1 0x00 0x20 -> deck1.pitch invert range=0.08   # a 14-bit fader
cc 1 0x21 -> deck1.jog rel64 ticks=256              # a jog wheel
shift note 1 0x00 -> deck1.clearhotcue1             # SHIFT layer

led note 1 0x0B <- deck1.playing                    # LED feedback
led note 1 0x00 <- deck1.hotcue1 on=42 off=1
```

## Controls

| Syntax | Meaning |
|---|---|
| `note <ch> <n>` | Note on/off. A note on with velocity > 0 is a press; a note off, or a note on with velocity 0, is a release. |
| `cc <ch> <n>` | Control change: 0–127 for knobs and faders. As a button, ≥ 64 is a press and < 64 a release. |
| `cc14 <ch> <msb> <lsb>` | 14-bit control from two CCs (usually n and n+32). |
| `pb <ch>` | Pitch bend (14-bit). Some controllers send their tempo faders this way. |

Channels are 1–16. Numbers can be decimal (`11`) or hex (`0x0B`). Put `shift` first to bind in the SHIFT layer. While SHIFT is held, shift bindings win. Controls with no shift binding keep doing their normal job.

## Actions

`deckN` is 1–4. Channel actions also accept `channelN`.

### Deck

| Action | Control | Does |
|---|---|---|
| `play` | button | Play/pause toggle |
| `cue` | button | CDJ-style cue |
| `sync` · `keylock` · `quantize` | button | Toggle |
| `slip` · `reverse` | button | Toggle, or hold with `momentary` |
| `censor` | button | Held: censor (reverse with slip) |
| `hotcue1`…`hotcue16` | button | Set, or jump to, a hot cue |
| `clearhotcue1`…`16` | button | Delete a hot cue |
| `loop beats=4` | button | Beat loop (`beats` 1/32 to 64, fractions allowed: `beats=1/4`) |
| `loopin` · `loopout` · `loopexit` · `loophalve` · `loopdouble` | button | Manual loops |
| `roll beats=1/4` | button | Held: slip roll |
| `pitch range=0.08` | fader | Tempo, ± range (0.08 = ±8%). Add `invert` if up should be faster, as on CDJs |
| `jog ticks=N` | encoder | Jog wheel. `ticks` is the number of ticks per revolution. With the platter touched it scratches (vinyl mode); otherwise it bends the pitch |
| `jogtouch` | button | Jog wheel touch sensor. `novinyl` makes touch bend instead of scratch |
| `nudge+` · `nudge-` | button | Held: pitch bend |

### Channel

| Action | Control | Does |
|---|---|---|
| `volume` | fader | Channel fader |
| `trim` | knob | Gain −12 to +12 dB |
| `low` · `mid` · `high` | knob | EQ. Centre is 0 dB, top is +6 dB, and fully down is a kill |
| `color` (or `filter`) | knob | Colour knob (filter or the selected colour FX). Centre is off, with a small dead zone |
| `pfl` | button | Headphone cue toggle |

### Mixer

| Action | Control | Does |
|---|---|---|
| `mixer.crossfader` | fader | Crossfader |
| `mixer.master` | knob | Master level. Three quarters of the way up is 0 dB; the top is +6 dB |
| `mixer.cuemix` | knob | Headphone mix: cue only (left) to master only (right) |
| `mixer.colorparam` | knob | Colour FX parameter |
| `mixer.colorfx+` · `mixer.colorfx-` | button | Next or previous colour FX |
| `mixer.colorfx value=N` | button | Select a colour FX: 0 Filter, 1 Noise, 2 Dub Echo, 3 Pitch, 4 Crush, 5 Space |

### Beat FX (`fx1`, `fx2`)

| Action | Control | Does |
|---|---|---|
| `on` | button | Toggle, or hold with `momentary` |
| `hold` | button | On while held |
| `wet` · `depth` | knob | Wet/dry and depth |
| `beats` | knob or encoder | Absolute knob: steps through 1/16 to 16 beats. Relative encoder: each click halves or doubles |
| `beats+` · `beats-` | button | Double or halve |
| `type+` · `type-` | button | Next or previous effect |
| `target value=N` | button | Route to 0 = master, or 1–4 = a channel |

### Sampler, macros, modifiers

| Action | Does |
|---|---|
| `sampler.pad1`…`pad64` | Trigger the pad on press (note velocity is used) and release it on release (gate, loop and toggle modes) |
| `sampler.stopall` | Stop every pad |
| `macro.riser` · `macro.buildup` · `macro.drop` | Start a macro. Options: `bars=1..16`, `target=master` or `a`–`d`, `impact=0/1` |
| `macro.cancel` | Stop the running macro |
| `shift` | SHIFT modifier (held) |

### Options

| Option | For |
|---|---|
| `rel2c` · `rel64` · `relsign` | Relative encoders. `rel2c` is two's complement (1 = +1, 127 = −1), `rel64` is offset (65 = +1, 63 = −1) and `relsign` is sign bit (1 = +1, 65 = −1). Jog wheels default to `rel64` |
| `invert` | Flip a fader or knob, or reverse a jog wheel |
| `momentary` | Hold instead of toggle (`slip`, `reverse`, `fxN.on`) |
| `novinyl` | Jog wheel only bends the pitch, never scratches |
| `range=` · `ticks=` · `beats=` · `bars=` · `target=` · `impact=` · `value=` | As described in the tables above |

## LEDs

```
led <note|cc> <ch> <n> <- <state> [on=127] [off=0]
```

LEDs are sent when their state changes, and all of them again when a new output port opens or a mapping loads. Many controllers use velocity for colour or brightness, so `on` and `off` set the values sent.

| State | Lit when |
|---|---|
| `deckN.playing` · `paused` · `loaded` | Playing; loaded and paused; a track is loaded |
| `deckN.pfl` | Headphone cue is on (as switched from the controller) |
| `deckN.sync` · `keylock` · `slip` · `reverse` · `looping` · `master` | On |
| `deckN.hotcue1`…`16` | The hot cue is set |
| `deckN.sliproll` · `censor` | Held |
| `deckN.beat` | The first 20% of every beat while playing, for a beat flash |
| `deckN.vu` | Channel level, scaled from `off` to `on` (for meter LEDs) |
| `fxN.on` · `fxN.tail` | The effect is on, or still ringing out |
| `sampler.padN` · `sampler.loadedN` | The pad is sounding, or has a sample loaded |
| `macro.running` | A macro is running |
| `shift` | SHIFT is held |

## Header lines and raw messages

| Line | Meaning |
|---|---|
| `name: <text>` | Display name |
| `device: <text>` | Port names containing this text (case-insensitive) use this mapping; see `djn_midi_builtin_for_device`. Several lines are allowed |
| `send <hex bytes>` | Sent once when the mapping loads and whenever a new output port opens: for example lighting buttons that stay lit |
| `send every=<ms> <hex bytes>` | Repeated every 10–60000 ms, for controllers that need a keep-alive from the host. SysEx must run from `F0` to `F7` |

In the browser, SysEx needs the Web MIDI SysEx permission. Without it, the page still sends everything else.

## MIDI Learn

`djn_midi_learn(midi, "deck1.jog rel2c ticks=720")` binds the next control that moves to that action, including its options. Buttons are learned on press. Holding SHIFT while learning puts the binding in the shift layer. A new binding replaces any existing binding for the same control and layer. `djn_midi_learn(midi, NULL)` cancels.

## Platforms

| Platform | Ports |
|---|---|
| Windows | WinMM through RtMidi (`djn_midi_open_input` / `djn_midi_open_output`) |
| macOS, iOS | CoreMIDI through RtMidi (USB, Bluetooth LE MIDI once paired in the system, and network sessions) |
| Linux | ALSA sequencer through RtMidi (build with `libasound2-dev` installed; without it, ports are disabled but `djn_midi_feed` still works) |
| Android | `android/com/djnexus/engine/DjnMidi.kt` opens devices with `android.media.midi` and passes the bytes to the engine through JNI |
| Browser | Web MIDI in the page; bytes go to `djn_midi_feed` (see Deck Lab) |

Jog timing and LEDs run on a 200 Hz service thread. Pass `DJN_MIDI_MANUAL_SERVICE` to `djn_midi_create` to drive them yourself with `djn_midi_service()`, as the browser build does.
