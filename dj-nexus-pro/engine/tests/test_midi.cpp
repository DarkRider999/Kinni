// MIDI controller tests: messages go in through djn_midi_feed, LED bytes come
// out through djn_midi_read_output, and the service clock is driven by hand.
#include <algorithm>
#include <chrono>
#include <string>
#include <thread>
#include <vector>

#include "djnexus/djnexus.h"
#include "test.h"
#include "test_util.h"

namespace {

struct Midi {
  djn_midi* m;
  double now = 0.0;
  explicit Midi(djn_engine* e) : m(djn_midi_create(e, DJN_MIDI_MANUAL_SERVICE)) {}
  ~Midi() { djn_midi_destroy(m); }
  void send(std::vector<uint8_t> bytes) { djn_midi_feed(m, bytes.data(), int32_t(bytes.size())); }
  void note(int ch, int n, int vel = 127) { send({uint8_t(0x90 | (ch - 1)), uint8_t(n), uint8_t(vel)}); }
  void noteOff(int ch, int n) { send({uint8_t(0x80 | (ch - 1)), uint8_t(n), 0}); }
  void press(int ch, int n) {
    note(ch, n);
    noteOff(ch, n);
  }
  void cc(int ch, int n, int v) { send({uint8_t(0xB0 | (ch - 1)), uint8_t(n), uint8_t(v)}); }
  void service(double dt = 0.01) {
    now += dt;
    djn_midi_service(m, now);
  }
  std::vector<uint8_t> output() {
    std::vector<uint8_t> out(8192);
    out.resize(size_t(djn_midi_read_output(m, out.data(), int32_t(out.size()))));
    return out;
  }
  std::string mapping() {
    std::string s(size_t(djn_midi_get_mapping(m, nullptr, 0)) + 1, '\0');
    djn_midi_get_mapping(m, &s[0], int32_t(s.size()));
    s.resize(s.size() - 1);
    return s;
  }
};

// True when the 3-byte message appears in `bytes` on a message boundary.
bool hasMessage(const std::vector<uint8_t>& bytes, uint8_t a, uint8_t b, uint8_t c) {
  for (size_t i = 0; i + 2 < bytes.size(); i += 3) {
    if (bytes[i] == a && bytes[i + 1] == b && bytes[i + 2] == c) return true;
  }
  return false;
}

djn_engine_state stateOf(djn_engine* e) {
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  return s;
}

void tick(djn_engine* e) { render(e, 0.02); }  // lets queued commands reach the audio thread

}  // namespace

TEST(midi_mapping_errors_name_the_line) {
  EngineHandle e;
  Midi midi(e);
  char err[128];
  CHECK(djn_midi_load_mapping(midi.m, "name: test\nnote 1 200 -> deck1.play\n", err, sizeof(err)) == DJN_ERR_INVALID_ARG);
  CHECK(std::string(err).find("line 2") == 0);
  CHECK(djn_midi_load_mapping(midi.m, "note 1 1 -> deck9.play\n", err, sizeof(err)) == DJN_ERR_INVALID_ARG);
  CHECK(std::string(err).find("line 1") == 0);
  CHECK(djn_midi_load_mapping(midi.m, "note 1 1 -> deck1.fly\n", err, sizeof(err)) == DJN_ERR_INVALID_ARG);
  CHECK(djn_midi_load_mapping(midi.m, "cc 1 1 => deck1.volume\n", err, sizeof(err)) == DJN_ERR_INVALID_ARG);
  // The previous (default) mapping survives a failed load.
  CHECK(midi.mapping().find("deck1.play") != std::string::npos);

  CHECK(djn_midi_load_mapping(midi.m, "# ok\nname: Mine\nnote 1 0x10 -> deck2.play\nled note 1 0x10 <- deck2.playing on=5\n",
                              err, sizeof(err)) == DJN_OK);
  const std::string text = midi.mapping();
  CHECK(text.find("name: Mine") != std::string::npos);
  CHECK(text.find("note 1 0x10 -> deck2.play") != std::string::npos);
  CHECK(text.find("led note 1 0x10 <- deck2.playing on=5") != std::string::npos);
}

TEST(midi_default_mapping_round_trips) {
  EngineHandle e;
  Midi midi(e);
  const std::string text = midi.mapping();
  char err[128] = "";
  CHECK(djn_midi_load_mapping(midi.m, text.c_str(), err, sizeof(err)) == DJN_OK);
  CHECK(midi.mapping() == text);
}

TEST(midi_note_toggles_play_with_running_status_and_realtime) {
  EngineHandle e;
  load(e, 0, sine(440, 4), 120, 0);
  load(e, 1, sine(440, 4), 120, 0);
  Midi midi(e);
  midi.note(1, 0x0B);
  tick(e);
  CHECK(deckState(e, 0).playing == 1);
  CHECK(deckState(e, 1).playing == 0);
  // Running status (no second status byte) with a clock byte in the middle.
  // Note on with velocity 0 (a release), then a press via running status.
  midi.send({0x90, 0x0B, 0x00, 0x0B, 0xF8, 0x7F});
  tick(e);
  CHECK(deckState(e, 0).playing == 0);
  midi.send({0x91, 0x0B, 0x7F});  // channel 2 = deck 2
  tick(e);
  CHECK(deckState(e, 1).playing == 1);
  // SysEx is skipped entirely.
  midi.send({0xF0, 0x7E, 0x0B, 0x7F, 0xF7});
  tick(e);
  CHECK(deckState(e, 1).playing == 1);
  uint8_t last[3];
  CHECK(djn_midi_last_message(midi.m, last) == 3);
  CHECK(last[0] == 0x91 && last[1] == 0x0B);
}

TEST(midi_14bit_pitch_fader) {
  EngineHandle e;
  load(e, 0, sine(440, 4), 120, 0);
  Midi midi(e);
  midi.note(1, 0x0B);
  midi.cc(1, 0x00, 0);  // MSB
  midi.cc(1, 0x20, 0);  // LSB: fader at the top = +8% (inverted, like hardware)
  tick(e);
  CHECK_NEAR(deckState(e, 0).rate, 1.08, 1e-3);
  midi.cc(1, 0x00, 0x40);  // centre: 0x40 << 7 = 8192 of 16383
  midi.cc(1, 0x20, 0x00);
  tick(e);
  CHECK_NEAR(deckState(e, 0).rate, 1.0, 1e-4);
  midi.cc(1, 0x00, 0x7F);
  midi.cc(1, 0x20, 0x7F);
  tick(e);
  CHECK_NEAR(deckState(e, 0).rate, 0.92, 1e-3);
}

TEST(midi_faders_and_crossfader) {
  EngineHandle e;
  load(e, 0, sine(440, 4), 120, 0);
  Midi midi(e);
  midi.note(1, 0x0B);
  render(e, 0.3);
  const double full = rms(render(e, 0.2));
  CHECK(full > 0.05);
  midi.cc(1, 0x13, 0);  // channel fader down
  render(e, 0.1);
  CHECK(rms(render(e, 0.1)) < full * 1e-3);  // -60 dB
  midi.cc(1, 0x13, 127);
  djn_mixer_set_xfader_assign(e, 0, DJN_XF_A);
  midi.cc(7, 0x1F, 127);  // crossfader hard right: deck 1 (side A) out
  render(e, 0.1);
  CHECK(rms(render(e, 0.1)) < full * 1e-3);
  midi.cc(7, 0x1F, 0);
  render(e, 0.1);
  CHECK_NEAR(db(rms(render(e, 0.1))), db(full), 1.0);
}

TEST(midi_jog_scratches_while_touched_and_nudges_when_not) {
  EngineHandle e;
  load(e, 0, sine(440, 8), 120, 0);
  Midi midi(e);
  midi.note(1, 0x0B);  // play
  render(e, 0.5);

  // Hand on the platter, not moving: the track stops.
  midi.note(1, 0x36);
  midi.service();
  render(e, 0.1);
  double p0 = deckState(e, 0).position_sec;
  for (int i = 0; i < 20; ++i) {
    midi.service();
    render(e, 0.01);
  }
  CHECK_NEAR(deckState(e, 0).position_sec, p0, 0.01);

  // Spin forward at about twice normal speed: 256 ticks/rev at 33 1/3 rpm is
  // 142 ticks/s, so 3 ticks every 10 ms is ~2.1x.
  p0 = deckState(e, 0).position_sec;
  for (int i = 0; i < 50; ++i) {
    midi.cc(1, 0x21, 64 + 3);
    midi.service();
    render(e, 0.01);
  }
  const double forward = deckState(e, 0).position_sec - p0;
  CHECK(forward > 0.7 && forward < 1.3);

  // Backwards.
  p0 = deckState(e, 0).position_sec;
  for (int i = 0; i < 50; ++i) {
    midi.cc(1, 0x21, 64 - 2);
    midi.service();
    render(e, 0.01);
  }
  CHECK(deckState(e, 0).position_sec < p0 - 0.3);

  // Let go: playback resumes at normal speed.
  midi.noteOff(1, 0x36);
  midi.service();
  render(e, 0.1);
  p0 = deckState(e, 0).position_sec;
  render(e, 0.5);
  CHECK_NEAR(deckState(e, 0).position_sec - p0, 0.5, 0.02);

  // Outer ring (not touched): turning it bends the pitch while it moves.
  midi.cc(1, 0x21, 64 + 3);
  midi.service();
  render(e, 0.01);
  CHECK(deckState(e, 0).rate > 1.02);
  for (int i = 0; i < 10; ++i) {  // stops moving: the bend falls away
    midi.service();
    render(e, 0.01);
  }
  CHECK_NEAR(deckState(e, 0).rate, 1.0, 1e-3);
}

TEST(midi_shift_layer_and_hot_cue_leds) {
  EngineHandle e;
  load(e, 0, sine(440, 8), 120, 0);
  Midi midi(e);
  midi.service();
  auto out = midi.output();
  CHECK(hasMessage(out, 0x90, 0x0B, 0x00));  // play LED off
  CHECK(hasMessage(out, 0x90, 0x00, 0x00));  // hot cue 1 LED off

  midi.press(1, 0x0B);
  render(e, 0.3);
  midi.press(1, 0x00);  // set hot cue 1
  tick(e);
  CHECK((deckState(e, 0).hot_cue_mask & 1u) == 1u);
  midi.service();
  out = midi.output();
  CHECK(hasMessage(out, 0x90, 0x0B, 0x7F));  // play LED on
  CHECK(hasMessage(out, 0x90, 0x00, 0x7F));  // hot cue 1 LED on
  midi.service();
  CHECK(midi.output().empty());  // unchanged LEDs are not resent

  // SHIFT + pad clears it; the unshifted pad does nothing else.
  midi.note(1, 0x3F);
  midi.press(1, 0x00);
  midi.noteOff(1, 0x3F);
  tick(e);
  CHECK((deckState(e, 0).hot_cue_mask & 1u) == 0u);
  // SHIFT + play has no shift binding: it falls back to play.
  midi.note(1, 0x3F);
  midi.press(1, 0x0B);
  midi.noteOff(1, 0x3F);
  tick(e);
  CHECK(deckState(e, 0).playing == 0);
}

TEST(midi_learn_binds_the_next_control) {
  EngineHandle e;
  load(e, 0, sine(440, 4), 120, 0);
  Midi midi(e);
  CHECK(djn_midi_learn(midi.m, "deck1.fly") == DJN_ERR_INVALID_ARG);
  CHECK(djn_midi_learn(midi.m, "deck1.play") == DJN_OK);
  CHECK(djn_midi_learning(midi.m) == 1);
  midi.noteOff(3, 60);  // releases are ignored while learning
  CHECK(djn_midi_learning(midi.m) == 1);
  midi.note(3, 60);  // this one is learned, not acted on
  CHECK(djn_midi_learning(midi.m) == 0);
  tick(e);
  CHECK(deckState(e, 0).playing == 0);
  CHECK(midi.mapping().find("note 3 0x3C -> deck1.play") != std::string::npos);
  midi.press(3, 60);
  tick(e);
  CHECK(deckState(e, 0).playing == 1);

  // Learning an encoder with options.
  CHECK(djn_midi_learn(midi.m, "deck1.volume") == DJN_OK);
  midi.cc(3, 7, 100);
  CHECK(midi.mapping().find("cc 3 0x07 -> deck1.volume") != std::string::npos);
  CHECK(djn_midi_learn(midi.m, "deck1.play") == DJN_OK);
  CHECK(djn_midi_learn(midi.m, nullptr) == DJN_OK);
  CHECK(djn_midi_learning(midi.m) == 0);
}

TEST(midi_fx_encoder_pads_and_macros) {
  EngineHandle e;
  load(e, 0, sine(440, 8), 120, 0);
  std::vector<float> hit = sine(880, 0.5);
  CHECK(djn_sampler_load_pcm(e, 0, hit.data(), int64_t(hit.size() / 2), 2, kRate, 0) == DJN_OK);
  Midi midi(e);
  tick(e);
  const double beats = stateOf(e).fx[0].beats;
  midi.cc(5, 0x06, 65);  // relative +1: double
  tick(e);
  CHECK_NEAR(stateOf(e).fx[0].beats, beats * 2, 1e-9);
  midi.cc(5, 0x06, 63);  // -1: halve
  midi.cc(5, 0x06, 63);
  tick(e);
  CHECK_NEAR(stateOf(e).fx[0].beats, beats / 2, 1e-9);
  const int type = stateOf(e).fx[0].type;
  midi.press(5, 0x49);
  tick(e);
  CHECK(stateOf(e).fx[0].type == (type + 1) % 12);
  midi.press(5, 0x47);
  tick(e);
  CHECK(stateOf(e).fx[0].on == 1);

  midi.note(10, 36, 100);  // pad 1
  render(e, 0.05);
  CHECK((stateOf(e).sampler_playing & 1u) == 1u);
  midi.service();
  CHECK(hasMessage(midi.output(), 0x99, 36, 0x7F));  // pad LED lit while it sounds

  midi.press(1, 0x0B);
  midi.press(7, 0x21);  // build-up
  render(e, 0.1);
  CHECK(stateOf(e).macro == DJN_MACRO_BUILD_UP);
  midi.press(7, 0x23);  // cancel
  render(e, 0.1);
  CHECK(stateOf(e).macro == -1);
}

TEST(midi_service_thread_and_ports_are_safe_to_use) {
  EngineHandle e;
  load(e, 0, sine(440, 4), 120, 0);
  djn_midi* m = djn_midi_create(e, 0);  // with its own service thread
  CHECK(m != nullptr);
  const int32_t inputs = djn_midi_input_count(m);
  CHECK(inputs >= 0);
  CHECK(djn_midi_open_input(m, inputs) != DJN_OK);  // one past the end
  CHECK(djn_midi_open_output(m, djn_midi_output_count(m)) != DJN_OK);
  char name[64];
  CHECK(djn_midi_input_name(m, -1, name, sizeof(name)) == DJN_ERR_INVALID_ARG);
  const uint8_t play[] = {0x90, 0x0B, 0x7F, 0x80, 0x0B, 0x00};
  CHECK(djn_midi_feed(m, play, sizeof(play)) == DJN_OK);
  render(e, 0.1);
  CHECK(deckState(e, 0).playing == 1);
  // The thread keeps LED feedback flowing without djn_midi_service calls.
  std::vector<uint8_t> out;
  for (int i = 0; i < 400 && !hasMessage(out, 0x90, 0x0B, 0x7F); ++i) {
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
    uint8_t buf[4095];
    out.insert(out.end(), buf, buf + djn_midi_read_output(m, buf, sizeof(buf)));
  }
  CHECK(hasMessage(out, 0x90, 0x0B, 0x7F));
  CHECK(djn_midi_close_ports(m) == DJN_OK);
  djn_midi_destroy(m);
  djn_midi_destroy(nullptr);
  CHECK(djn_midi_create(nullptr, 0) == nullptr);
}

// ---------------------------------------------------------------- Pioneer DDJ-FLX4

namespace {

std::vector<std::vector<uint8_t>> messages(const std::vector<uint8_t>& b) {
  std::vector<std::vector<uint8_t>> out;
  for (size_t i = 0; i < b.size();) {
    size_t len = 3;
    if (b[i] == 0xF0) {
      len = 1;
      while (i + len < b.size() && b[i + len - 1] != 0xF7) ++len;
    }
    out.emplace_back(b.begin() + std::ptrdiff_t(i), b.begin() + std::ptrdiff_t(std::min(b.size(), i + len)));
    i += len;
  }
  return out;
}

bool has(const std::vector<std::vector<uint8_t>>& msgs, std::vector<uint8_t> m) {
  return std::find(msgs.begin(), msgs.end(), m) != msgs.end();
}

size_t countSysex(const std::vector<std::vector<uint8_t>>& msgs) {
  return size_t(std::count_if(msgs.begin(), msgs.end(), [](const std::vector<uint8_t>& m) { return m[0] == 0xF0; }));
}

struct Flx4 : Midi {
  explicit Flx4(djn_engine* e) : Midi(e) {
    char err[128] = "";
    ok = djn_midi_load_mapping(m, djn_midi_builtin_text("pioneer-ddj-flx4"), err, sizeof(err)) == DJN_OK;
    if (!ok) std::printf("    mapping error: %s\n", err);
  }
  bool ok = false;
};

}  // namespace

TEST(midi_builtin_mappings_are_listed_and_matched) {
  CHECK(djn_midi_builtin_count() >= 2);
  CHECK(std::string(djn_midi_builtin_id(0)) == "generic");
  bool found = false;
  for (int i = 0; i < djn_midi_builtin_count(); ++i) {
    if (std::string(djn_midi_builtin_id(i)) == "pioneer-ddj-flx4") found = std::string(djn_midi_builtin_name(i)) == "Pioneer DDJ-FLX4";
  }
  CHECK(found);
  CHECK(djn_midi_builtin_id(djn_midi_builtin_count()) == nullptr);
  CHECK(djn_midi_builtin_text("nope") == nullptr);
  // Port names differ per OS: "DDJ-FLX4" (macOS), "DDJ-FLX4 MIDI 1" (Windows), "DDJ-FLX4:DDJ-FLX4 MIDI 1 20:0" (ALSA).
  for (const char* port : {"DDJ-FLX4", "DDJ-FLX4 MIDI 1", "DDJ-FLX4:DDJ-FLX4 MIDI 1 20:0", "ddj-flx4"}) {
    const char* id = djn_midi_builtin_for_device(port);
    CHECK(id && std::string(id) == "pioneer-ddj-flx4");
  }
  CHECK(djn_midi_builtin_for_device("DDJ-400") == nullptr);
  CHECK(djn_midi_builtin_for_device(nullptr) == nullptr);

  // Every built-in parses and survives a save/load round trip.
  EngineHandle e;
  Midi midi(e);
  for (int i = 0; i < djn_midi_builtin_count(); ++i) {
    char err[128] = "";
    CHECK(djn_midi_load_mapping(midi.m, djn_midi_builtin_text(djn_midi_builtin_id(i)), err, sizeof(err)) == DJN_OK);
    const std::string text = midi.mapping();
    CHECK(djn_midi_load_mapping(midi.m, text.c_str(), err, sizeof(err)) == DJN_OK);
    CHECK(midi.mapping() == text);
  }
}

TEST(midi_flx4_keep_alive_and_start_up_lights) {
  EngineHandle e;
  load(e, 0, sine(440, 4), 120, 0);
  Flx4 flx(e);
  CHECK(flx.ok);
  tick(e);
  flx.service(0.01);
  auto out = messages(flx.output());
  CHECK(countSysex(out) == 1);
  CHECK(has(out, {0xF0, 0x00, 0x40, 0x05, 0x00, 0x00, 0x04, 0x05, 0x00, 0x50, 0x02, 0xF7}));
  CHECK(has(out, {0x90, 0x10, 0x7F}) && has(out, {0x91, 0x4E, 0x7F}));  // loop buttons lit
  CHECK(has(out, {0x9F, 0x00, 0x7F}));                                   // deck 1 loaded
  // Keep-alive every 200 ms; the start-up messages are not repeated.
  int sysex = 0;
  bool loopAgain = false;
  for (int i = 0; i < 100; ++i) {  // 1 s
    out = messages(flx.output());
    flx.service(0.01);
    out = messages(flx.output());
    sysex += int(countSysex(out));
    loopAgain = loopAgain || has(out, {0x90, 0x10, 0x7F});
  }
  CHECK(sysex >= 4 && sysex <= 6);
  CHECK(!loopAgain);
}

TEST(midi_flx4_deck_mixer_and_leds) {
  EngineHandle e;
  load(e, 0, sine(440, 8), 120, 0);
  load(e, 1, sine(440, 8), 120, 0);
  Flx4 flx(e);
  tick(e);
  flx.service();
  CHECK(has(messages(flx.output()), {0x90, 0x0C, 0x7F}));  // cue LED on: loaded and paused

  flx.send({0x90, 0x0B, 0x7F, 0x90, 0x0B, 0x00});  // PLAY
  render(e, 0.2);
  flx.service();
  auto out = messages(flx.output());
  CHECK(deckState(e, 0).playing == 1);
  CHECK(has(out, {0x90, 0x0B, 0x7F}) && has(out, {0x90, 0x47, 0x7F}));  // play LED, and its SHIFT twin
  CHECK(has(out, {0x90, 0x0C, 0x00}));                                   // cue LED off while playing
  bool vu = false;
  for (const auto& m : out) vu = vu || (m[0] == 0xB0 && m[1] == 0x02 && m[2] > 60);
  CHECK(vu);

  // 14-bit tempo fader: 0 is the + end (±10% range).
  flx.send({0xB0, 0x00, 0x00, 0xB0, 0x20, 0x00});
  tick(e);
  CHECK_NEAR(deckState(e, 0).rate, 1.10, 1e-3);
  flx.send({0xB0, 0x00, 0x40, 0xB0, 0x20, 0x00});
  tick(e);
  CHECK_NEAR(deckState(e, 0).rate, 1.0, 1e-3);

  // Channel fader (14-bit) down.
  const double full = rms(render(e, 0.2));
  flx.send({0xB0, 0x13, 0x00, 0xB0, 0x33, 0x00});
  render(e, 0.1);
  CHECK(rms(render(e, 0.1)) < full * 1e-3);
  flx.send({0xB0, 0x13, 0x7F, 0xB0, 0x33, 0x7F});

  // Pads, hot cue mode: set cue 1 on deck 1; SHIFT + pad (channel 9) deletes it.
  flx.send({0x97, 0x00, 0x7F, 0x97, 0x00, 0x00});
  tick(e);
  CHECK((deckState(e, 0).hot_cue_mask & 1u) == 1u);
  flx.service();
  out = messages(flx.output());
  CHECK(has(out, {0x97, 0x00, 0x7F}) && has(out, {0x98, 0x00, 0x7F}));
  flx.send({0x98, 0x00, 0x7F, 0x98, 0x00, 0x00});
  tick(e);
  CHECK((deckState(e, 0).hot_cue_mask & 1u) == 0u);

  // Beat loop mode pad 5 = 4-beat loop; RELOOP/EXIT lights, and exits.
  flx.send({0x97, 0x64, 0x7F, 0x97, 0x64, 0x00});
  render(e, 0.05);
  CHECK(deckState(e, 0).looping == 1);
  CHECK_NEAR(deckState(e, 0).loop_end_sec - deckState(e, 0).loop_start_sec, 2.0, 1e-3);
  flx.service();
  CHECK(has(messages(flx.output()), {0x90, 0x4D, 0x7F}));
  flx.send({0x90, 0x4D, 0x7F, 0x90, 0x4D, 0x00});
  tick(e);
  CHECK(deckState(e, 0).looping == 0);

  // SHIFT + PLAY is censor while held.
  flx.send({0x90, 0x0E, 0x7F});
  tick(e);
  CHECK(deckState(e, 0).censor == 1);
  flx.send({0x90, 0x0E, 0x00});
  tick(e);
  CHECK(deckState(e, 0).censor == 0);

  // Deck 2 on MIDI channel 2, headphone cue LED follows the button.
  flx.send({0x91, 0x0B, 0x7F, 0x91, 0x54, 0x7F});
  tick(e);
  CHECK(deckState(e, 1).playing == 1);
  flx.service();
  CHECK(has(messages(flx.output()), {0x91, 0x54, 0x7F}));
}

TEST(midi_flx4_jog_scratch) {
  EngineHandle e;
  load(e, 0, sine(440, 8), 120, 0);
  Flx4 flx(e);
  flx.send({0x90, 0x0B, 0x7F});
  render(e, 0.5);
  flx.send({0x90, 0x36, 0x7F});  // touch the platter
  // 720 ticks per revolution at 33 1/3 rpm = 400 ticks/s normal speed; 8 per 10 ms is 2x.
  double p0 = deckState(e, 0).position_sec;
  for (int i = 0; i < 50; ++i) {
    flx.send({0xB0, 0x22, 64 + 8});
    flx.service();
    render(e, 0.01);
  }
  const double moved = deckState(e, 0).position_sec - p0;
  CHECK(moved > 0.7 && moved < 1.3);
  flx.send({0x90, 0x36, 0x00});
  flx.service();
  // Side of the wheel bends the pitch while it turns.
  flx.send({0xB0, 0x21, 64 + 6});
  flx.service();
  render(e, 0.01);
  CHECK(deckState(e, 0).rate > 1.02);
}

TEST(midi_flx4_beat_fx_and_sampler) {
  EngineHandle e;
  load(e, 0, sine(440, 8), 120, 0);
  std::vector<float> hit = sine(880, 0.5);
  CHECK(djn_sampler_load_pcm(e, 0, hit.data(), int64_t(hit.size() / 2), 2, kRate, 0) == DJN_OK);
  CHECK(djn_sampler_load_pcm(e, 8, hit.data(), int64_t(hit.size() / 2), 2, kRate, 0) == DJN_OK);
  Flx4 flx(e);
  tick(e);

  // FX ON with the CH SELECT switch on CH2: the note arrives on channel 6.
  flx.send({0x95, 0x47, 0x7F, 0x95, 0x47, 0x00});
  tick(e);
  djn_engine_state st;
  djn_engine_get_state(e, &st);
  CHECK(st.fx[0].on == 1);
  CHECK(st.fx[0].target == 1);
  flx.service();
  CHECK(has(messages(flx.output()), {0x94, 0x47, 0x7F}));
  // LEVEL/DEPTH turns both wet and depth.
  flx.send({0xB4, 0x02, 0x7F, 0xB4, 0x22, 0x7F});
  tick(e);
  djn_engine_get_state(e, &st);
  CHECK_NEAR(st.fx[0].wet, 1.0, 1e-3);
  CHECK_NEAR(st.fx[0].depth, 1.0, 1e-3);
  const double beats = st.fx[0].beats;
  flx.send({0x94, 0x4B, 0x7F});  // BEAT >
  tick(e);
  djn_engine_get_state(e, &st);
  CHECK_NEAR(st.fx[0].beats, beats * 2, 1e-9);

  // Sampler mode: deck 1 pad 1 is sampler pad 1, deck 2 pad 1 is pad 9.
  flx.send({0x97, 0x30, 0x7F});
  flx.send({0x99, 0x30, 0x7F});
  render(e, 0.05);
  djn_engine_get_state(e, &st);
  CHECK((st.sampler_playing & 1u) == 1u);
  CHECK(((st.sampler_playing >> 8) & 1u) == 1u);
  flx.service();
  auto out = messages(flx.output());
  CHECK(has(out, {0x97, 0x30, 0x7F}) && has(out, {0x99, 0x30, 0x7F}));
  flx.send({0x98, 0x31, 0x7F});  // SHIFT + pad: stop all
  render(e, 0.05);
  djn_engine_get_state(e, &st);
  CHECK(st.sampler_playing == 0);
}
