// MIDI mapping model and its text format.
//
//   # comment
//   name: My Controller
//   [shift] <control> -> <action> [options]
//   led <control> <- <state> [on=127] [off=0]
//
//   control: note <ch> <n> | cc <ch> <n> | cc14 <ch> <msb> <lsb> | pb <ch>
//            channels 1..16; numbers decimal or 0x hex
//
// See docs/MIDI_MAPPING.md for every action, state and option.
#pragma once

#include <string>
#include <vector>

namespace djn {
namespace midi {

enum class Kind { Note, CC, CC14, PitchBend };

struct Control {
  Kind kind = Kind::Note;
  int channel = 0;  // 0..15
  int number = 0;   // note / CC / MSB
  int lsb = -1;     // CC14 only
  bool operator==(const Control& o) const {
    return kind == o.kind && channel == o.channel && number == o.number && lsb == o.lsb;
  }
};

enum class Encoding { Absolute, Rel2c, Rel64, RelSign };

enum class Act {
  // deck
  Play, Cue, Sync, KeyLock, Slip, Reverse, Quantize, Censor, HotCue, HotCueClear, Loop, LoopIn, LoopOut,
  LoopExit, LoopHalve, LoopDouble, Roll, Pitch, Jog, JogTouch, NudgeUp, NudgeDown,
  // channel
  Volume, Trim, EqLow, EqMid, EqHigh, Color, Pfl,
  // mixer
  Crossfader, Master, ColorParam, ColorFxNext, ColorFxPrev, ColorFxSet,
  // fx units
  FxOn, FxHold, FxWet, FxDepth, FxBeats, FxBeatsUp, FxBeatsDown, FxTypeNext, FxTypePrev, FxTarget,
  // sampler / macros / modifiers
  Pad, SamplerStopAll, Riser, BuildUp, Drop, MacroCancel, Shift,
};

struct Binding {
  bool shift = false;
  Control control;
  std::string actionText;  // e.g. "deck1.loop beats=4" (as written, for saving)
  Act act = Act::Play;
  int index = 0;           // deck / channel / fx unit (0-based), pad or hot cue number (0-based)
  int arg = 0;             // secondary index (hot cue for deck actions)
  Encoding encoding = Encoding::Absolute;
  bool invert = false;
  bool momentary = false;
  bool vinyl = true;       // jog: scratch while touched
  double range = 0.08;     // pitch fader range
  double ticks = 128.0;    // jog ticks per revolution
  double beats = 1.0;      // loop / roll length
  int bars = 4;            // macro length
  int target = -1;         // macro target channel (-1 master)
  bool impact = true;      // macro impact
  double value = 0.0;      // fixed value for "set" actions
  bool hasValue = false;
};

enum class LedState {
  Playing, Paused, Sync, KeyLock, Slip, Reverse, Looping, Master, Beat, HotCue, SlipRoll, Censor, Vu,
  FxOn, FxTail, PadPlaying, PadLoaded, MacroRunning, Shift,
};

struct Led {
  Control control;         // note or cc
  std::string stateText;
  LedState state = LedState::Playing;
  int index = 0;
  int arg = 0;
  int on = 127, off = 0;
};

struct Mapping {
  std::string name;
  std::vector<Binding> bindings;
  std::vector<Led> leds;
};

// Parses a whole mapping. On failure `error` is "line N: reason".
bool parseMapping(const std::string& text, Mapping& out, std::string& error);
// Parses "<action> [options]" (the right-hand side of a binding).
bool parseAction(const std::string& text, Binding& b, std::string& error);
// Writes a mapping back as text (learned bindings included).
std::string serializeMapping(const Mapping& m);
std::string controlText(const Control& c);

}  // namespace midi
}  // namespace djn
