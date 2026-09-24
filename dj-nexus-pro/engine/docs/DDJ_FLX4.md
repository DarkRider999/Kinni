# Pioneer DJ DDJ-FLX4

Built-in mapping id: `pioneer-ddj-flx4` (source: [`mappings/pioneer-ddj-flx4.txt`](../mappings/pioneer-ddj-flx4.txt)). The engine picks it for any MIDI port whose name contains `DDJ-FLX4`, and Deck Lab does the same when you press Connect.

**Status: not yet tested on a real DDJ-FLX4.** The MIDI numbers come from the Mixxx community mapping for this controller. The DJ Nexus tests play those exact messages through the mapping and check the engine and the LED output. The first hardware session should check the items under "To verify on hardware" below.

## Layout

| Control | DJ Nexus |
|---|---|
| PLAY/PAUSE · CUE | Play/pause · CDJ cue |
| SHIFT + PLAY/PAUSE | Censor (reverse while held, lands where the track would be) |
| BEAT SYNC | Sync toggle |
| Jog platter | Scratch while touched (vinyl). SHIFT + platter: fast pitch bend |
| Jog side | Pitch bend |
| TEMPO | Tempo ±10%, 14-bit |
| LOOP IN · LOOP OUT · RELOOP/EXIT | Loop in · out · exit |
| SHIFT + LOOP IN | 4-beat loop |
| CUE/LOOP CALL ◀ ▶ | Halve · double the loop |
| TRIM · HI · MID · LOW · channel fader | 14-bit, EQ kills at the bottom |
| CFX knob | Channel colour FX (the Color FX picked in the app, filter by default) |
| Headphone CUE | PFL toggle (SHIFT + CUE: quantize on/off) |
| Crossfader · headphone MIXING | 14-bit crossfader · cue/master mix |
| Pads, HOT CUE mode | Hot cues 1–8; SHIFT + pad deletes |
| Pads, BEAT LOOP mode | Loops of 1/4, 1/2, 1, 2, 4, 8, 16, 32 beats; SHIFT + pad: slip roll of that length |
| Pads, SAMPLER mode | Sampler pads 1–8 (left deck) and 9–16 (right deck); SHIFT + pad stops all |
| BEAT FX SELECT (SHIFT: back) | Next (previous) beat FX |
| BEAT ◀ ▶ | Halve · double the FX beat length |
| CH SELECT + FX ON/OFF | FX on/off, sent to the channel the switch selects |
| LEVEL/DEPTH | FX wet and depth together |

LEDs: play, cue, sync, headphone cue, reloop (while looping), hot cue pads (with and without SHIFT), sampler pads (while sounding), beat FX on, the channel level meters, and the platter "track loaded" animation. While the mapping is loaded the engine sends Pioneer's keep-alive message every 200 ms and lights the loop buttons, as rekordbox does.

## Not mapped yet

- BEAT JUMP, KEYBOARD, KEY SHIFT, PAD FX 1/2 pad modes (the engine has no beat jump or key shift actions yet).
- LOAD buttons and the BROWSE knob: the track library lives in the app, so the app should handle these messages (`LOAD` = notes `0x46`/`0x47` on channel 7, `BROWSE` = CC `0x40` on channel 7) before or alongside `djn_midi_feed`.
- SMART CFX and SMART FADER.
- Beat loop pad LEDs, and the pad mode button LEDs.

## To verify on hardware

1. **Tempo direction.** The mapping treats the fader's 0 end as "+". If moving towards "+" slows the track down, delete `invert` from both `pitch` lines.
2. **Keep-alive.** Without the keep-alive the FLX4 is said to fall back to its stand-alone light show. Check that the lights stay steady with the mapping loaded.
3. **Jog feel.** The mapping assumes 720 ticks per revolution. If scratching runs too fast or slow, change `ticks=720` on the `0x22` lines.
4. **FX with CH SELECT on MASTER.** The master position may send FX ON/OFF on another channel. Watch the MIDI monitor and add the binding.
5. **VU meters.** The meter LEDs get 0–127 on CC `0x02`. Check that the scale looks right.
