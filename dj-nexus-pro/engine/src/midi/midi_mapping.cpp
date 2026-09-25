#include "midi_mapping.h"

#include <cctype>
#include <cstdio>
#include <cstdlib>

namespace djn {
namespace midi {

namespace {

std::vector<std::string> split(const std::string& s) {
  std::vector<std::string> out;
  size_t i = 0;
  while (i < s.size()) {
    while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) ++i;
    const size_t start = i;
    while (i < s.size() && !std::isspace(static_cast<unsigned char>(s[i]))) ++i;
    if (i > start) out.push_back(s.substr(start, i - start));
  }
  return out;
}

std::string lower(std::string s) {
  for (auto& c : s) c = char(std::tolower(static_cast<unsigned char>(c)));
  return s;
}

bool parseInt(const std::string& s, int& out) {
  if (s.empty()) return false;
  char* end = nullptr;
  const bool hex = s.size() > 2 && s[0] == '0' && (s[1] == 'x' || s[1] == 'X');
  const long v = std::strtol(hex ? s.c_str() + 2 : s.c_str(), &end, hex ? 16 : 10);
  if (!end || *end != '\0') return false;
  out = int(v);
  return true;
}

bool parseNumber(const std::string& s, double& out) {
  const size_t slash = s.find('/');
  char* end = nullptr;
  if (slash != std::string::npos) {  // fractions such as 1/4
    const std::string num = s.substr(0, slash), den = s.substr(slash + 1);
    const double a = std::strtod(num.c_str(), &end);
    if (num.empty() || !end || *end) return false;
    const double b = std::strtod(den.c_str(), &end);
    if (den.empty() || !end || *end || b == 0) return false;
    out = a / b;
    return true;
  }
  out = std::strtod(s.c_str(), &end);
  return end && *end == '\0' && !s.empty();
}

// "deck12" -> ("deck", 12); "mixer" -> ("mixer", -1)
void splitIndex(const std::string& s, std::string& word, int& index) {
  size_t i = s.size();
  while (i > 0 && std::isdigit(static_cast<unsigned char>(s[i - 1]))) --i;
  word = s.substr(0, i);
  index = i < s.size() ? std::atoi(s.c_str() + i) : -1;
}

// Parses control tokens starting at tokens[pos]; advances pos.
bool parseControl(const std::vector<std::string>& t, size_t& pos, Control& c, std::string& err) {
  if (pos >= t.size()) {
    err = "missing control (note / cc / cc14 / pb)";
    return false;
  }
  const std::string kind = lower(t[pos++]);
  auto need = [&](int& v, int lo, int hi, const char* what) {
    if (pos >= t.size() || !parseInt(t[pos], v) || v < lo || v > hi) {
      err = std::string("bad ") + what;
      return false;
    }
    ++pos;
    return true;
  };
  int ch = 0;
  if (kind == "note" || kind == "cc") {
    c.kind = kind == "note" ? Kind::Note : Kind::CC;
    if (!need(ch, 1, 16, "channel (1-16)") || !need(c.number, 0, 127, "number (0-127)")) return false;
  } else if (kind == "cc14") {
    c.kind = Kind::CC14;
    if (!need(ch, 1, 16, "channel (1-16)") || !need(c.number, 0, 127, "MSB number") || !need(c.lsb, 0, 127, "LSB number")) {
      return false;
    }
  } else if (kind == "pb") {
    c.kind = Kind::PitchBend;
    if (!need(ch, 1, 16, "channel (1-16)")) return false;
  } else {
    err = "unknown control '" + kind + "' (use note, cc, cc14 or pb)";
    return false;
  }
  c.channel = ch - 1;
  return true;
}

bool parseLedState(const std::string& text, Led& led, std::string& err) {
  const std::string name = lower(text);
  const size_t dot = name.find('.');
  if (name == "shift") {
    led.state = LedState::Shift;
    return true;
  }
  if (dot == std::string::npos) {
    err = "unknown LED state '" + text + "'";
    return false;
  }
  std::string group, what;
  int gi = -1, wi = -1;
  splitIndex(name.substr(0, dot), group, gi);
  splitIndex(name.substr(dot + 1), what, wi);
  if (group == "deck") {
    if (gi < 1 || gi > 4) { err = "deck must be 1-4"; return false; }
    led.index = gi - 1;
    static const struct { const char* n; LedState s; } deckStates[] = {
        {"playing", LedState::Playing}, {"paused", LedState::Paused}, {"loaded", LedState::Loaded}, {"pfl", LedState::Pfl}, {"sync", LedState::Sync},
        {"keylock", LedState::KeyLock}, {"slip", LedState::Slip}, {"reverse", LedState::Reverse},
        {"looping", LedState::Looping}, {"master", LedState::Master}, {"beat", LedState::Beat},
        {"sliproll", LedState::SlipRoll}, {"censor", LedState::Censor}, {"vu", LedState::Vu}};
    static const char* const stemNames[4] = {"drums", "bass", "vocals", "inst"};
    for (int k = 0; k < 4; ++k) {
      if (what == stemNames[k] || (k == 3 && what == "other")) {
        led.state = LedState::Stem;
        led.arg = k;
        return true;
      }
    }
    if (what == "hotcue") {
      if (wi < 1 || wi > 16) { err = "hot cue must be 1-16"; return false; }
      led.state = LedState::HotCue;
      led.arg = wi - 1;
      return true;
    }
    for (const auto& d : deckStates) {
      if (what == d.n && wi < 0) { led.state = d.s; return true; }
    }
  } else if (group == "fx") {
    if (gi < 1 || gi > 2) { err = "fx unit must be 1-2"; return false; }
    led.index = gi - 1;
    if (what == "on") { led.state = LedState::FxOn; return true; }
    if (what == "tail") { led.state = LedState::FxTail; return true; }
  } else if (group == "sampler") {
    if (wi < 1 || wi > 64) { err = "pad must be 1-64"; return false; }
    led.index = wi - 1;
    if (what == "pad") { led.state = LedState::PadPlaying; return true; }
    if (what == "loaded") { led.state = LedState::PadLoaded; return true; }
  } else if (group == "macro" && what == "running") {
    led.state = LedState::MacroRunning;
    return true;
  }
  err = "unknown LED state '" + text + "'";
  return false;
}

}  // namespace

std::string controlText(const Control& c) {
  char buf[48];
  switch (c.kind) {
    case Kind::Note: std::snprintf(buf, sizeof(buf), "note %d 0x%02X", c.channel + 1, c.number); break;
    case Kind::CC: std::snprintf(buf, sizeof(buf), "cc %d 0x%02X", c.channel + 1, c.number); break;
    case Kind::CC14: std::snprintf(buf, sizeof(buf), "cc14 %d 0x%02X 0x%02X", c.channel + 1, c.number, c.lsb); break;
    case Kind::PitchBend: std::snprintf(buf, sizeof(buf), "pb %d", c.channel + 1); break;
  }
  return buf;
}

bool parseAction(const std::string& text, Binding& b, std::string& err) {
  const auto t = split(text);
  if (t.empty()) {
    err = "missing action";
    return false;
  }
  b.actionText = text.substr(text.find_first_not_of(" \t"));
  while (!b.actionText.empty() && std::isspace(static_cast<unsigned char>(b.actionText.back()))) b.actionText.pop_back();

  // Options first, so actions can read them.
  for (size_t i = 1; i < t.size(); ++i) {
    const std::string o = lower(t[i]);
    const size_t eq = o.find('=');
    const std::string key = o.substr(0, eq), val = eq == std::string::npos ? "" : o.substr(eq + 1);
    double num = 0;
    if (o == "rel2c") b.encoding = Encoding::Rel2c;
    else if (o == "rel64") b.encoding = Encoding::Rel64;
    else if (o == "relsign") b.encoding = Encoding::RelSign;
    else if (o == "invert") b.invert = true;
    else if (o == "momentary") b.momentary = true;
    else if (o == "novinyl") b.vinyl = false;
    else if (key == "range" && parseNumber(val, num) && num > 0 && num <= 1) b.range = num;
    else if (key == "ticks" && parseNumber(val, num) && num >= 1) b.ticks = num;
    else if (key == "beats" && parseNumber(val, num) && num > 0 && num <= 64) b.beats = num;
    else if (key == "bars" && parseNumber(val, num) && num >= 1 && num <= 16) b.bars = int(num);
    else if (key == "impact" && (val == "0" || val == "1")) b.impact = val == "1";
    else if (key == "target") {
      if (val == "master") b.target = -1;
      else if (val.size() == 1 && val[0] >= 'a' && val[0] <= 'd') b.target = val[0] - 'a';
      else if (parseNumber(val, num) && num >= 1 && num <= 4) b.target = int(num) - 1;
      else { err = "bad target '" + val + "' (master, a-d or 1-4)"; return false; }
    } else if (key == "value" && parseNumber(val, num)) {
      b.value = num;
      b.hasValue = true;
    } else {
      err = "unknown option '" + t[i] + "'";
      return false;
    }
  }

  const std::string name = lower(t[0]);
  if (name == "shift") {
    b.act = Act::Shift;
    return true;
  }
  const size_t dot = name.find('.');
  if (dot == std::string::npos) {
    err = "unknown action '" + t[0] + "'";
    return false;
  }
  std::string group, what;
  int gi = -1, wi = -1;
  splitIndex(name.substr(0, dot), group, gi);
  const std::string suffix = name.substr(dot + 1);
  splitIndex(suffix, what, wi);

  if (group == "deck" || group == "channel") {
    if (gi < 1 || gi > 4) { err = group + " must be 1-4"; return false; }
    b.index = gi - 1;
    static const struct { const char* n; Act a; bool deckOnly; } acts[] = {
        {"play", Act::Play, true}, {"cue", Act::Cue, true}, {"sync", Act::Sync, true},
        {"keylock", Act::KeyLock, true}, {"slip", Act::Slip, true}, {"reverse", Act::Reverse, true},
        {"quantize", Act::Quantize, true}, {"censor", Act::Censor, true}, {"loop", Act::Loop, true},
        {"loopin", Act::LoopIn, true}, {"loopout", Act::LoopOut, true}, {"loopexit", Act::LoopExit, true},
        {"loophalve", Act::LoopHalve, true}, {"loopdouble", Act::LoopDouble, true}, {"roll", Act::Roll, true},
        {"pitch", Act::Pitch, true}, {"jog", Act::Jog, true}, {"jogtouch", Act::JogTouch, true},
        {"nudge+", Act::NudgeUp, true}, {"nudge-", Act::NudgeDown, true},
        {"volume", Act::Volume, false}, {"trim", Act::Trim, false}, {"low", Act::EqLow, false},
        {"mid", Act::EqMid, false}, {"high", Act::EqHigh, false}, {"color", Act::Color, false},
        {"filter", Act::Color, false}, {"pfl", Act::Pfl, false}};
    // Stems: drums, bass, vocals, inst (other).
    static const char* const stemNames[4] = {"drums", "bass", "vocals", "inst"};
    for (int k = 0; k < 4; ++k) {
      if (suffix == stemNames[k] || (k == 3 && suffix == "other")) {
        if (group != "deck") break;
        b.act = Act::Stem;
        b.arg = k;
        return true;
      }
    }
    if (what == "hotcue" || what == "clearhotcue") {
      if (group != "deck" || wi < 1 || wi > 16) { err = "hot cues are deckN.hotcue1..16"; return false; }
      b.act = what == "hotcue" ? Act::HotCue : Act::HotCueClear;
      b.arg = wi - 1;
      return true;
    }
    for (const auto& a : acts) {
      if (suffix == a.n) {
        if (a.deckOnly && group != "deck") break;
        b.act = a.a;
        return true;
      }
    }
  } else if (group == "mixer") {
    static const struct { const char* n; Act a; } acts[] = {
        {"crossfader", Act::Crossfader}, {"master", Act::Master}, {"cuemix", Act::CueMix}, {"colorparam", Act::ColorParam},
        {"colorfx+", Act::ColorFxNext}, {"colorfx-", Act::ColorFxPrev}, {"colorfx", Act::ColorFxSet}};
    for (const auto& a : acts) {
      if (suffix == a.n) {
        b.act = a.a;
        if (b.act == Act::ColorFxSet && !b.hasValue) { err = "mixer.colorfx needs value=0..5"; return false; }
        return true;
      }
    }
  } else if (group == "fx") {
    if (gi < 1 || gi > 2) { err = "fx unit must be 1-2"; return false; }
    b.index = gi - 1;
    static const struct { const char* n; Act a; } acts[] = {
        {"on", Act::FxOn}, {"hold", Act::FxHold}, {"wet", Act::FxWet}, {"depth", Act::FxDepth},
        {"beats", Act::FxBeats}, {"beats+", Act::FxBeatsUp}, {"beats-", Act::FxBeatsDown},
        {"type+", Act::FxTypeNext}, {"type-", Act::FxTypePrev}, {"target", Act::FxTarget}};
    for (const auto& a : acts) {
      if (suffix == a.n) {
        b.act = a.a;
        if (b.act == Act::FxTarget && !b.hasValue) { err = "fxN.target needs value=0 (master) or 1-4"; return false; }
        return true;
      }
    }
  } else if (group == "sampler") {
    if (what == "pad") {
      if (wi < 1 || wi > 64) { err = "pad must be 1-64"; return false; }
      b.act = Act::Pad;
      b.index = wi - 1;
      return true;
    }
    if (suffix == "stopall") { b.act = Act::SamplerStopAll; return true; }
  } else if (group == "macro") {
    if (suffix == "riser") { b.act = Act::Riser; return true; }
    if (suffix == "buildup") { b.act = Act::BuildUp; return true; }
    if (suffix == "drop") { b.act = Act::Drop; return true; }
    if (suffix == "cancel") { b.act = Act::MacroCancel; return true; }
  }
  err = "unknown action '" + t[0] + "'";
  return false;
}

bool parseMapping(const std::string& text, Mapping& out, std::string& error) {
  Mapping m;
  int lineNo = 0;
  for (size_t linePos = 0; linePos < text.size();) {
    size_t end = text.find('\n', linePos);
    if (end == std::string::npos) end = text.size();
    std::string line = text.substr(linePos, end - linePos);
    linePos = end + 1;
    ++lineNo;
    const size_t hash = line.find('#');
    if (hash != std::string::npos) line = line.substr(0, hash);
    const auto t = split(line);
    if (t.empty()) continue;
    std::string err;
    if (lower(t[0]) == "name:") {
      const size_t colon = line.find(':');
      m.name = line.substr(colon + 1);
      m.name.erase(0, m.name.find_first_not_of(" \t"));
      while (!m.name.empty() && std::isspace(static_cast<unsigned char>(m.name.back()))) m.name.pop_back();
      continue;
    }
    if (lower(t[0]) == "device:") {
      std::string d = line.substr(line.find(':') + 1);
      d.erase(0, d.find_first_not_of(" \t"));
      while (!d.empty() && std::isspace(static_cast<unsigned char>(d.back()))) d.pop_back();
      m.devices.push_back(d);
      continue;
    }
    if (lower(t[0]) == "send") {
      Send snd;
      for (size_t i = 1; i < t.size(); ++i) {
        const std::string o = lower(t[i]);
        int v = 0;
        if (o.rfind("every=", 0) == 0) {
          if (!parseInt(o.substr(6), v) || v < 10 || v > 60000) {
            error = "line " + std::to_string(lineNo) + ": every= must be 10-60000 ms";
            return false;
          }
          snd.everyMs = v;
          continue;
        }
        const std::string h = o.rfind("0x", 0) == 0 ? o.substr(2) : o;
        char* end = nullptr;
        const long b = std::strtol(h.c_str(), &end, 16);
        if (h.empty() || h.size() > 2 || *end || b < 0 || b > 255) {
          error = "line " + std::to_string(lineNo) + ": bad byte '" + t[i] + "' (hex, e.g. F0)";
          return false;
        }
        snd.bytes.push_back(uint8_t(b));
      }
      if (snd.bytes.empty() || snd.bytes[0] < 0x80 || (snd.bytes[0] == 0xF0) != (snd.bytes.back() == 0xF7)) {
        error = "line " + std::to_string(lineNo) + ": send needs a whole MIDI message (SysEx F0 ... F7)";
        return false;
      }
      m.sends.push_back(snd);
      continue;
    }
    size_t pos = 0;
    if (lower(t[0]) == "led") {
      Led led;
      pos = 1;
      if (!parseControl(t, pos, led.control, err)) {
        error = "line " + std::to_string(lineNo) + ": " + err;
        return false;
      }
      if (led.control.kind == Kind::CC14 || led.control.kind == Kind::PitchBend) {
        error = "line " + std::to_string(lineNo) + ": LEDs use note or cc";
        return false;
      }
      if (pos >= t.size() || t[pos] != "<-" || pos + 1 >= t.size()) {
        error = "line " + std::to_string(lineNo) + ": expected '<- state'";
        return false;
      }
      led.stateText = t[pos + 1];
      if (!parseLedState(led.stateText, led, err)) {
        error = "line " + std::to_string(lineNo) + ": " + err;
        return false;
      }
      for (size_t i = pos + 2; i < t.size(); ++i) {
        const std::string o = lower(t[i]);
        int v = 0;
        if (o.rfind("on=", 0) == 0 && parseInt(o.substr(3), v) && v >= 0 && v <= 127) led.on = v;
        else if (o.rfind("off=", 0) == 0 && parseInt(o.substr(4), v) && v >= 0 && v <= 127) led.off = v;
        else {
          error = "line " + std::to_string(lineNo) + ": unknown LED option '" + t[i] + "'";
          return false;
        }
      }
      m.leds.push_back(led);
      continue;
    }
    Binding b;
    if (lower(t[0]) == "shift" && t.size() > 1 && t[1] != "->") {
      b.shift = true;
      pos = 1;
    }
    if (!parseControl(t, pos, b.control, err)) {
      error = "line " + std::to_string(lineNo) + ": " + err;
      return false;
    }
    if (pos >= t.size() || t[pos] != "->") {
      error = "line " + std::to_string(lineNo) + ": expected '-> action'";
      return false;
    }
    const size_t arrow = line.find("->");
    if (!parseAction(line.substr(arrow + 2), b, err)) {
      error = "line " + std::to_string(lineNo) + ": " + err;
      return false;
    }
    m.bindings.push_back(b);
  }
  out = m;
  return true;
}

std::string serializeMapping(const Mapping& m) {
  std::string s = "# DJ Nexus MIDI mapping\n";
  if (!m.name.empty()) s += "name: " + m.name + "\n";
  for (const auto& d : m.devices) s += "device: " + d + "\n";
  for (const auto& snd : m.sends) {
    s += "send";
    if (snd.everyMs) s += " every=" + std::to_string(snd.everyMs);
    char b[4];
    for (uint8_t x : snd.bytes) {
      std::snprintf(b, sizeof(b), " %02X", x);
      s += b;
    }
    s += "\n";
  }
  for (const auto& b : m.bindings) s += (b.shift ? "shift " : "") + controlText(b.control) + " -> " + b.actionText + "\n";
  for (const auto& l : m.leds) {
    s += "led " + controlText(l.control) + " <- " + l.stateText;
    if (l.on != 127) s += " on=" + std::to_string(l.on);
    if (l.off != 0) s += " off=" + std::to_string(l.off);
    s += "\n";
  }
  return s;
}

}  // namespace midi
}  // namespace djn
