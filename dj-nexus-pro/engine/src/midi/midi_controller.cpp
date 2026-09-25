#include "midi_controller.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace djn {
namespace midi {

namespace {

constexpr double kPlatterRevPerSec = 100.0 / 3.0 / 60.0;  // 33 1/3 rpm = normal speed
const double kDivisions[] = {1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 3.0 / 4, 1, 2, 4, 8, 16};

double clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

float eqDbFor(double v) {
  if (v >= 0.5) return float((v - 0.5) * 2.0 * 6.0);
  if (v <= 0.005) return -80.0f;  // full kill (isolator); classic EQ clamps to -26 dB
  return float((v / 0.5 - 1.0) * 26.0);
}

std::string hex(int v) {
  char b[8];
  std::snprintf(b, sizeof(b), "0x%02X", v);
  return b;
}

}  // namespace

std::string defaultMappingText() {
  std::string s =
      "# DJ Nexus generic MIDI mapping (a template: adjust the numbers to your controller,\n"
      "# or use MIDI Learn). Decks 1-4 use MIDI channels 1-4 with the same numbers;\n"
      "# FX units use channels 5-6, the mixer channel 7, and sampler pads notes 36-51\n"
      "# on channel 10, the usual drum-pad layout, so pad controllers work as-is.\n"
      "name: DJ Nexus generic\n";
  for (int d = 1; d <= 4; ++d) {
    const std::string ch = std::to_string(d), deck = "deck" + ch;
    auto line = [&](const std::string& ctl, const std::string& act) { s += ctl + " -> " + act + "\n"; };
    s += "\n# Deck " + ch + "\n";
    line("note " + ch + " 0x0B", deck + ".play");
    line("note " + ch + " 0x0C", deck + ".cue");
    line("note " + ch + " 0x58", deck + ".sync");
    line("note " + ch + " 0x3F", "shift");
    line("note " + ch + " 0x36", deck + ".jogtouch");
    line("cc " + ch + " 0x21", deck + ".jog rel64 ticks=256");
    line("cc14 " + ch + " 0x00 0x20", deck + ".pitch invert range=0.08");
    line("note " + ch + " 0x10", deck + ".loop beats=4");
    line("note " + ch + " 0x11", deck + ".loopexit");
    line("note " + ch + " 0x12", deck + ".loophalve");
    line("note " + ch + " 0x13", deck + ".loopdouble");
    line("note " + ch + " 0x14", deck + ".roll beats=1/4");
    line("note " + ch + " 0x15", deck + ".roll beats=1/8");
    line("note " + ch + " 0x16", deck + ".censor");
    line("note " + ch + " 0x1A", deck + ".keylock");
    line("note " + ch + " 0x1B", deck + ".slip");
    for (int k = 0; k < 8; ++k) {
      line("note " + ch + " " + hex(k), deck + ".hotcue" + std::to_string(k + 1));
      line("shift note " + ch + " " + hex(k), deck + ".clearhotcue" + std::to_string(k + 1));
    }
    line("cc " + ch + " 0x13", deck + ".volume");
    line("cc " + ch + " 0x04", deck + ".trim");
    line("cc " + ch + " 0x07", deck + ".high");
    line("cc " + ch + " 0x0B", deck + ".mid");
    line("cc " + ch + " 0x0F", deck + ".low");
    line("cc " + ch + " 0x17", deck + ".color");
    line("note " + ch + " 0x54", deck + ".pfl");
    s += "led note " + ch + " 0x0B <- " + deck + ".playing\n";
    s += "led note " + ch + " 0x0C <- " + deck + ".paused\n";
    s += "led note " + ch + " 0x58 <- " + deck + ".sync\n";
    s += "led note " + ch + " 0x10 <- " + deck + ".looping\n";
    s += "led note " + ch + " 0x1A <- " + deck + ".keylock\n";
    s += "led note " + ch + " 0x1B <- " + deck + ".slip\n";
    for (int k = 0; k < 8; ++k) s += "led note " + ch + " " + hex(k) + " <- " + deck + ".hotcue" + std::to_string(k + 1) + "\n";
  }
  s +=
      "\n# FX units (channels 5 and 6)\n"
      "note 5 0x47 -> fx1.on\nnote 5 0x48 -> fx1.hold\ncc 5 0x04 -> fx1.depth\ncc 5 0x05 -> fx1.wet\n"
      "cc 5 0x06 -> fx1.beats rel64\nnote 5 0x49 -> fx1.type+\nshift note 5 0x49 -> fx1.type-\n"
      "note 6 0x47 -> fx2.on\nnote 6 0x48 -> fx2.hold\ncc 6 0x04 -> fx2.depth\ncc 6 0x05 -> fx2.wet\n"
      "cc 6 0x06 -> fx2.beats rel64\nnote 6 0x49 -> fx2.type+\nshift note 6 0x49 -> fx2.type-\n"
      "led note 5 0x47 <- fx1.on\nled note 6 0x47 <- fx2.on\n"
      "\n# Mixer (channel 7)\n"
      "cc 7 0x1F -> mixer.crossfader\ncc 7 0x08 -> mixer.master\ncc 7 0x09 -> mixer.colorparam\n"
      "note 7 0x10 -> mixer.colorfx+\nnote 7 0x11 -> mixer.colorfx-\n"
      "note 7 0x20 -> macro.riser bars=4\nnote 7 0x21 -> macro.buildup bars=4\nnote 7 0x22 -> macro.drop\n"
      "note 7 0x23 -> macro.cancel\nled note 7 0x21 <- macro.running\n"
      "\n# Sampler pads: notes 36-51 on channel 10\n";
  for (int p = 0; p < 16; ++p) {
    s += "note 10 " + std::to_string(36 + p) + " -> sampler.pad" + std::to_string(p + 1) + "\n";
    s += "led note 10 " + std::to_string(36 + p) + " <- sampler.pad" + std::to_string(p + 1) + "\n";
  }
  return s;
}

Controller::Controller(djn_engine* engine) : engine_(engine) {
  std::string err;
  load(defaultMappingText(), err);
}

bool Controller::load(const std::string& text, std::string& error) {
  Mapping m;
  if (!parseMapping(text, m, error)) return false;
  LockGuard<Mutex> lock(mu_);
  mapping_ = std::move(m);
  ledSent_.assign(mapping_.leds.size(), -1);  // resend every LED
  sendAt_.assign(mapping_.sends.size(), 0.0);
  sendInit_ = true;
  for (auto& j : jogs_) j = Jog{};
  return true;
}

std::string Controller::text() {
  LockGuard<Mutex> lock(mu_);
  return serializeMapping(mapping_);
}

bool Controller::learn(const char* action, std::string& error) {
  LockGuard<Mutex> lock(mu_);
  if (!action) {
    learning_ = false;
    return true;
  }
  Binding b;
  if (!parseAction(action, b, error)) return false;
  learnBinding_ = b;
  learning_ = true;
  return true;
}

bool Controller::learning() {
  LockGuard<Mutex> lock(mu_);
  return learning_;
}

void Controller::resendLeds() {
  LockGuard<Mutex> lock(mu_);
  std::fill(ledSent_.begin(), ledSent_.end(), -1);
  sendInit_ = true;
}

int Controller::lastMessage(uint8_t out[3]) {
  LockGuard<Mutex> lock(mu_);
  for (int i = 0; i < lastLen_; ++i) out[i] = last_[i];
  return lastLen_;
}

size_t Controller::readOutput(uint8_t* buf, size_t size) {
  LockGuard<Mutex> lock(mu_);
  const size_t n = std::min(size, out_.size());
  if (buf) std::copy(out_.begin(), out_.begin() + std::ptrdiff_t(n), buf);  // null buf: discard
  out_.erase(out_.begin(), out_.begin() + std::ptrdiff_t(n));
  return n;
}

void Controller::send(const uint8_t* b, size_t n) {
  if (out_.size() > 4096) {
    // Nobody is reading. Drop everything (never half a message) and send the
    // full state again once someone does.
    out_.clear();
    std::fill(ledSent_.begin(), ledSent_.end(), -1);
    sendInit_ = true;
  }
  out_.insert(out_.end(), b, b + n);
}

void Controller::feed(const uint8_t* bytes, size_t length) {
  LockGuard<Mutex> lock(mu_);
  for (size_t i = 0; i < length; ++i) {
    const uint8_t b = bytes[i];
    if (b >= 0xF8) continue;  // real-time (clock, active sensing)
    if (b == 0xF0) { sysex_ = true; continue; }
    if (b == 0xF7) { sysex_ = false; continue; }
    if (sysex_) continue;
    if (b & 0x80) {
      running_ = b >= 0xF0 ? 0 : b;  // system common messages cancel running status
      have_ = 0;
      continue;
    }
    if (!running_) continue;
    data_[have_++] = b;
    const uint8_t type = running_ & 0xF0;
    const int needed = (type == 0xC0 || type == 0xD0) ? 1 : 2;
    if (have_ == needed) {
      message(running_, data_[0], needed == 2 ? data_[1] : 0);
      have_ = 0;
    }
  }
}

int Controller::decodeRelative(Encoding enc, int v) const {
  switch (enc) {
    case Encoding::Rel2c: return v < 64 ? v : v - 128;
    case Encoding::RelSign: return (v & 0x40) ? -(v & 0x3F) : (v & 0x3F);
    case Encoding::Rel64:
    case Encoding::Absolute: return v - 64;
  }
  return 0;
}

void Controller::message(uint8_t status, uint8_t d1, uint8_t d2) {
  const int type = status & 0xF0, ch = status & 0x0F;
  last_[0] = status;
  last_[1] = d1;
  last_[2] = d2;
  lastLen_ = (type == 0xC0 || type == 0xD0) ? 2 : 3;

  Control c;
  c.channel = ch;
  bool press = false, release = false;
  double value = 0.0;
  int raw = d2;
  if (type == 0x90 || type == 0x80) {
    c.kind = Kind::Note;
    c.number = d1;
    press = type == 0x90 && d2 > 0;
    release = !press;
    value = d2 / 127.0;
  } else if (type == 0xB0) {
    c.kind = Kind::CC;
    c.number = d1;
    value = d2 / 127.0;
    press = d2 >= 64;
    release = d2 < 64;
  } else if (type == 0xE0) {
    c.kind = Kind::PitchBend;
    raw = (d2 << 7) | d1;
    value = raw / 16383.0;
  } else {
    return;
  }

  if (learning_ && (press || c.kind != Kind::Note)) {
    Binding b = learnBinding_;
    b.control = c;
    b.shift = shift_;
    mapping_.bindings.erase(std::remove_if(mapping_.bindings.begin(), mapping_.bindings.end(),
                                           [&](const Binding& x) { return x.control == c && x.shift == b.shift; }),
                            mapping_.bindings.end());
    mapping_.bindings.push_back(b);
    learning_ = false;
    return;
  }

  // 14-bit CCs: MSB and LSB arrive as two CCs; update the value on either.
  if (c.kind == Kind::CC) {
    for (const auto& b : mapping_.bindings) {
      if (b.control.kind != Kind::CC14 || b.control.channel != ch) continue;
      if (d1 != b.control.number && d1 != b.control.lsb) continue;
      if (d1 == b.control.number) cc14Msb_[size_t(ch)][size_t(b.control.number)] = d2;
      else cc14Lsb_[size_t(ch)][size_t(b.control.number)] = d2;
      const int v14 = (cc14Msb_[size_t(ch)][size_t(b.control.number)] << 7) | cc14Lsb_[size_t(ch)][size_t(b.control.number)];
      dispatch(b.control, v14 / 16383.0, 0, v14, false, false);
      return;
    }
  }
  dispatch(c, value, 0, raw, press, release);
}

void Controller::dispatch(const Control& c, double value01, int /*delta*/, int raw, bool press, bool release) {
  // With SHIFT held, shift-layer bindings win; unmapped shift controls fall back.
  bool matched = false;
  for (int pass = 0; pass < 2 && !matched; ++pass) {
    const bool wantShift = pass == 0 ? shift_ : false;
    if (pass == 1 && !shift_) break;
    for (const auto& b : mapping_.bindings) {
      if (b.shift != wantShift || !(b.control == c)) continue;
      matched = true;
      const bool relative = b.encoding != Encoding::Absolute || b.act == Act::Jog;
      const int delta = relative ? decodeRelative(b.encoding, raw) : 0;
      apply(b, value01, delta, press, release);
    }
  }
}

void Controller::apply(const Binding& b, double v, int delta, bool press, bool release) {
  djn_engine* e = engine_;
  const int d = b.index;
  const double value = b.invert ? 1.0 - v : v;
  djn_engine_state st;
  auto state = [&]() -> djn_engine_state& {
    djn_engine_peek_state(e, &st);
    return st;
  };

  switch (b.act) {
    case Act::Play: if (press) djn_deck_toggle_play(e, d); break;
    case Act::Cue: if (press) djn_deck_cue(e, d); break;
    case Act::Sync: if (press) djn_deck_set_sync(e, d, !state().decks[d].sync); break;
    case Act::KeyLock: if (press) djn_deck_set_key_lock(e, d, !state().decks[d].key_lock); break;
    case Act::Slip:
      if (b.momentary) { if (press || release) djn_deck_set_slip(e, d, press); }
      else if (press) djn_deck_set_slip(e, d, !state().decks[d].slip);
      break;
    case Act::Reverse:
      if (b.momentary) { if (press || release) djn_deck_set_reverse(e, d, press); }
      else if (press) djn_deck_set_reverse(e, d, !state().decks[d].reverse);
      break;
    case Act::Quantize:
      if (press) {
        quantize_[size_t(d)] = !quantize_[size_t(d)];
        djn_deck_set_quantize(e, d, quantize_[size_t(d)]);
      }
      break;
    case Act::Censor: if (press || release) djn_deck_censor(e, d, press); break;
    case Act::HotCue: if (press) djn_deck_hot_cue_trigger(e, d, b.arg); break;
    case Act::HotCueClear: if (press) djn_deck_hot_cue_clear(e, d, b.arg); break;
    case Act::Loop: if (press) djn_deck_loop_beats(e, d, b.beats); break;
    case Act::LoopIn: if (press) djn_deck_loop_in(e, d); break;
    case Act::LoopOut: if (press) djn_deck_loop_out(e, d); break;
    case Act::LoopExit: if (press) djn_deck_loop_exit(e, d); break;
    case Act::LoopHalve: if (press) djn_deck_loop_halve(e, d); break;
    case Act::LoopDouble: if (press) djn_deck_loop_double(e, d); break;
    case Act::Roll:
      if (press) djn_deck_slip_roll(e, d, 1, b.beats);
      else if (release) djn_deck_slip_roll(e, d, 0, 0);
      break;
    case Act::Pitch: djn_deck_set_pitch(e, d, (value - 0.5) * 2.0 * b.range); break;
    case Act::Jog: {
      Jog& j = jogs_[size_t(d)];
      j.ticks += b.invert ? -delta : delta;
      j.ticksPerRev = b.ticks;
      j.vinyl = b.vinyl;
      break;
    }
    case Act::JogTouch: {
      Jog& j = jogs_[size_t(d)];
      if (press) {
        j.touched = true;
        j.rate = 0.0;
        j.vinyl = b.vinyl;
        if (j.vinyl) djn_deck_jog(e, d, 1, 0.0);  // hand on the platter: hold it
      } else if (release) {
        j.touched = false;
        j.rate = 0.0;
        j.sentNudge = 0.0;
        djn_deck_jog(e, d, 0, 0.0);
      }
      break;
    }
    case Act::NudgeUp:
    case Act::NudgeDown:
      if (press) djn_deck_jog(e, d, 0, b.act == Act::NudgeUp ? 0.04 : -0.04);
      else if (release) djn_deck_jog(e, d, 0, 0.0);
      break;
    case Act::Stem: {
      const djn_stem stem = djn_stem(b.arg);
      if (b.control.kind == Kind::Note) {  // button: toggle, or mute while held
        if (b.momentary) {
          if (press || release) djn_deck_set_stem_gain(e, d, stem, press ? 0.0f : 1.0f);
        } else if (press) {
          djn_deck_set_stem_gain(e, d, stem, state().decks[d].stem_gain[b.arg] > 0.5f ? 0.0f : 1.0f);
        }
      } else {  // knob or fader: level
        djn_deck_set_stem_gain(e, d, stem, float(value));
      }
      break;
    }
    case Act::Volume: djn_mixer_set_fader(e, d, float(value)); break;
    case Act::Trim: djn_mixer_set_trim_db(e, d, float((value - 0.5) * 24.0)); break;
    case Act::EqLow: djn_mixer_set_eq_db(e, d, 0, eqDbFor(value)); break;
    case Act::EqMid: djn_mixer_set_eq_db(e, d, 1, eqDbFor(value)); break;
    case Act::EqHigh: djn_mixer_set_eq_db(e, d, 2, eqDbFor(value)); break;
    case Act::Color: {
      double x = (value - 0.5) * 2.0;
      if (std::fabs(x) < 0.02) x = 0.0;  // centre detent
      djn_mixer_set_filter(e, d, float(x));
      break;
    }
    case Act::Pfl:
      if (press) {
        pfl_[size_t(d)] = !pfl_[size_t(d)];
        djn_mixer_set_cue(e, d, pfl_[size_t(d)]);
      }
      break;
    case Act::Crossfader: djn_mixer_set_crossfader(e, float(value)); break;
    case Act::Master:
      djn_mixer_set_master_db(e, value <= 0.001 ? -80.0f
                                 : value >= 0.75 ? float((value - 0.75) / 0.25 * 6.0)
                                                 : float((value / 0.75 - 1.0) * 48.0));
      break;
    case Act::CueMix: djn_mixer_set_cue_mix(e, float(value)); break;
    case Act::ColorParam: djn_mixer_set_color_param(e, float(value)); break;
    case Act::ColorFxNext:
    case Act::ColorFxPrev:
      if (press) djn_mixer_set_color_fx(e, djn_color_fx((state().color_fx + (b.act == Act::ColorFxNext ? 1 : 5)) % 6));
      break;
    case Act::ColorFxSet: if (press) djn_mixer_set_color_fx(e, djn_color_fx(int(b.value) % 6)); break;
    case Act::FxOn:
      if (b.momentary) { if (press || release) djn_fx_set_on(e, d, press); }
      else if (press) djn_fx_set_on(e, d, !state().fx[d].on);
      break;
    case Act::FxHold: if (press || release) djn_fx_set_on(e, d, press); break;
    case Act::FxWet: djn_fx_set_wet(e, d, float(value)); break;
    case Act::FxDepth: djn_fx_set_depth(e, d, float(value)); break;
    case Act::FxBeats: {
      if (b.encoding == Encoding::Absolute) {
        const int n = int(sizeof(kDivisions) / sizeof(kDivisions[0]));
        djn_fx_set_beats(e, d, kDivisions[std::lround(clamp01(value) * (n - 1))]);
      } else if (delta != 0) {
        const double beats = state().fx[d].beats;
        djn_fx_set_beats(e, d, std::min(16.0, std::max(1.0 / 16.0, delta > 0 ? beats * 2.0 : beats / 2.0)));
      }
      break;
    }
    case Act::FxBeatsUp:
    case Act::FxBeatsDown:
      if (press) {
        const double beats = state().fx[d].beats;
        djn_fx_set_beats(e, d, std::min(16.0, std::max(1.0 / 16.0, b.act == Act::FxBeatsUp ? beats * 2.0 : beats / 2.0)));
      }
      break;
    case Act::FxTypeNext:
    case Act::FxTypePrev:
      if (press) djn_fx_set_type(e, d, djn_fx_type((state().fx[d].type + (b.act == Act::FxTypeNext ? 1 : 11)) % 12));
      break;
    case Act::FxTarget:
      if (press) djn_fx_set_target(e, d, int(b.value) == 0 ? DJN_FX_TARGET_MASTER : int(b.value) - 1);
      break;
    case Act::Pad:
      if (press) djn_sampler_trigger(e, b.index, float(b.control.kind == Kind::Note ? std::max(v, 0.05) : 1.0));
      else if (release) djn_sampler_release(e, b.index);
      break;
    case Act::SamplerStopAll: if (press) djn_sampler_stop_all(e); break;
    case Act::Riser:
    case Act::BuildUp:
    case Act::Drop:
      if (press) {
        const djn_macro m = b.act == Act::Riser ? DJN_MACRO_RISER : b.act == Act::BuildUp ? DJN_MACRO_BUILD_UP : DJN_MACRO_DROP;
        djn_macro_start(e, m, b.bars, b.target, b.impact ? 1 : 0);
      }
      break;
    case Act::MacroCancel: if (press) djn_macro_cancel(e); break;
    case Act::Shift:
      if (press) shift_ = true;
      else if (release) shift_ = false;
      break;
  }
}

void Controller::service(double now) {
  LockGuard<Mutex> lock(mu_);
  const double dt = lastService_ < 0 ? 0.005 : std::min(0.1, std::max(0.001, now - lastService_));
  lastService_ = now;
  lastDt_ = dt;

  for (int d = 0; d < 4; ++d) {
    Jog& j = jogs_[size_t(d)];
    if (j.ticks == 0.0 && j.rate == 0.0 && j.sentNudge == 0.0 && !j.touched) continue;
    // Platter speed relative to normal playback, smoothed over a couple of services.
    const double target = (j.ticks / j.ticksPerRev) / dt / kPlatterRevPerSec;
    j.ticks = 0.0;
    j.rate += (target - j.rate) * 0.5;
    if (target == 0.0 && std::fabs(j.rate) < 1e-3) j.rate = 0.0;
    if (j.touched && j.vinyl) {
      djn_deck_jog(engine_, d, 1, j.rate);  // scratch
    } else {
      // Outer ring / no touch: pitch bend proportional to how fast it spins.
      const double nudge = std::max(-0.3, std::min(0.3, j.rate * 0.08));
      if (std::fabs(nudge - j.sentNudge) > 1e-4) {
        djn_deck_jog(engine_, d, 0, nudge);
        j.sentNudge = nudge;
      }
    }
  }
  sendLeds(false);

  // Raw sends: one-shots after a load or a new output, repeats on their timer.
  for (size_t i = 0; i < mapping_.sends.size(); ++i) {
    const Send& snd = mapping_.sends[i];
    const bool due = snd.everyMs ? now >= sendAt_[i] || sendInit_ : sendInit_;
    if (!due) continue;
    send(snd.bytes.data(), snd.bytes.size());
    if (snd.everyMs) sendAt_[i] = now + snd.everyMs / 1000.0;
  }
  sendInit_ = false;
}

void Controller::sendLeds(bool force) {
  if (mapping_.leds.empty()) return;
  djn_engine_state st;
  djn_engine_peek_state(engine_, &st);
  // Meter LEDs: peaks reset whenever the app reads the state, so hold them and
  // fall back at 1.5 full scales per second, like a meter.
  for (size_t d = 0; d < vu_.size(); ++d) {
    const double pk = std::max(st.decks[d].peak_l, st.decks[d].peak_r);
    const double now = pk > 1e-5 ? clamp01((20.0 * std::log10(pk) + 48.0) / 48.0) : 0.0;
    vu_[d] = std::max(now, vu_[d] - 1.5 * lastDt_);
  }
  for (size_t i = 0; i < mapping_.leds.size(); ++i) {
    const Led& l = mapping_.leds[i];
    const djn_deck_state& ds = st.decks[l.index < DJN_MAX_DECKS ? l.index : 0];
    double level = 0.0;  // 0..1
    switch (l.state) {
      case LedState::Playing: level = ds.playing; break;
      case LedState::Paused: level = ds.loaded && !ds.playing; break;
      case LedState::Loaded: level = ds.loaded; break;
      case LedState::Pfl: level = pfl_[size_t(l.index)]; break;  // as toggled from the controller
      case LedState::Stem: level = ds.stems_loaded && ds.stem_gain[l.arg] > 0.5f; break;
      case LedState::Sync: level = ds.sync; break;
      case LedState::KeyLock: level = ds.key_lock; break;
      case LedState::Slip: level = ds.slip; break;
      case LedState::Reverse: level = ds.reverse; break;
      case LedState::Looping: level = ds.looping; break;
      case LedState::Master: level = ds.is_master; break;
      case LedState::Beat: level = ds.playing && ds.beat_phase >= 0 && ds.beat_phase < 0.2; break;
      case LedState::HotCue: level = (ds.hot_cue_mask >> l.arg) & 1u; break;
      case LedState::SlipRoll: level = ds.slip_roll; break;
      case LedState::Censor: level = ds.censor; break;
      case LedState::Vu: level = vu_[size_t(l.index)]; break;
      case LedState::FxOn: level = st.fx[l.index].on; break;
      case LedState::FxTail: level = st.fx[l.index].tail_active; break;
      case LedState::PadPlaying: level = double((st.sampler_playing >> l.index) & 1u); break;
      case LedState::PadLoaded: level = double((st.sampler_loaded >> l.index) & 1u); break;
      case LedState::MacroRunning: level = st.macro >= 0; break;
      case LedState::Shift: level = shift_; break;
    }
    const int vel = l.state == LedState::Vu ? int(std::lround(l.off + (l.on - l.off) * level)) : (level > 0.5 ? l.on : l.off);
    if (!force && ledSent_[i] == vel) continue;
    ledSent_[i] = vel;
    const uint8_t status = uint8_t((l.control.kind == Kind::Note ? 0x90 : 0xB0) | l.control.channel);
    const uint8_t msg[3] = {status, uint8_t(l.control.number), uint8_t(vel)};
    send(msg, 3);
  }
}

}  // namespace midi
}  // namespace djn
