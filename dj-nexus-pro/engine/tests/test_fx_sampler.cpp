// Beat FX and sampler tests through the public C API, rendered offline.
#include <random>
#include <vector>

#include "djnexus/djnexus.h"
#include "test.h"
#include "test_util.h"

namespace {

// Silence with one click at `at` seconds.
std::vector<float> impulse(double at, double seconds) {
  std::vector<float> s(size_t(seconds * kRate) * 2, 0.0f);
  const size_t i = size_t(at * kRate);
  for (size_t k = 0; k < 48; ++k) s[2 * (i + k)] = s[2 * (i + k) + 1] = 0.8f * float(std::exp(-double(k) / 8.0));
  return s;
}

// One sine per beat, each beat a different pitch: 200, 250, 300 ... Hz at 120 BPM.
std::vector<float> steppedTones(double seconds) {
  std::vector<float> s(size_t(seconds * kRate) * 2);
  double phase = 0;
  for (size_t i = 0; i < s.size() / 2; ++i) {
    const int beat = int(double(i) / (kRate * 0.5));
    phase += 2 * kPi * (200.0 + 50.0 * beat) / kRate;
    s[2 * i] = s[2 * i + 1] = 0.4f * float(std::sin(phase));
  }
  return s;
}

std::vector<float> silence(double seconds) { return std::vector<float>(size_t(seconds * kRate) * 2, 0.0f); }

int loadSample(djn_engine* e, int slot, const std::vector<float>& pcm, double bpm = 0) {
  return djn_sampler_load_pcm(e, slot, pcm.data(), int64_t(pcm.size() / 2), 2, kRate, bpm);
}

djn_engine_state engineState(djn_engine* e) {
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  return s;
}

size_t firstSound(const std::vector<float>& x, size_t from = 0, float threshold = 1e-4f) {
  for (size_t i = from; i < x.size(); ++i) {
    if (std::fabs(x[i]) > threshold) return i;
  }
  return x.size();
}

void setupFx(djn_engine* e, int unit, djn_fx_type type, double beats, float depth, float wet) {
  djn_fx_set_type(e, unit, type);
  djn_fx_set_beats(e, unit, beats);
  djn_fx_set_depth(e, unit, depth);
  djn_fx_set_wet(e, unit, wet);
  djn_fx_set_target(e, unit, DJN_FX_TARGET_MASTER);
}

}  // namespace

// ---------------------------------------------------------------- beat FX

TEST(echo_repeats_on_the_beat_division) {
  EngineHandle e;
  load(e, 0, impulse(1.0, 4), 120, 0.0);
  setupFx(e, 0, DJN_FX_ECHO, 0.5, 0.0f, 1.0f);  // half a beat at 120 BPM = 250 ms
  djn_fx_set_on(e, 0, 1);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.6);
  const double direct = rms(out, size_t(1.0 * kRate), size_t(1.02 * kRate));
  const double gap = rms(out, size_t(1.08 * kRate), size_t(1.22 * kRate));
  const double echo1 = rms(out, size_t(1.25 * kRate), size_t(1.27 * kRate));
  const double echo2 = rms(out, size_t(1.50 * kRate), size_t(1.52 * kRate));
  CHECK(db(gap / direct) < -60);
  CHECK_NEAR(db(echo1 / direct), 0.0, 0.5);  // wet 100%: the first repeat comes back at full level
  CHECK(db(echo2 / echo1) < -6);             // feedback repeats get quieter
}

TEST(echo_and_reverb_ring_out_after_switching_off) {
  for (djn_fx_type type : {DJN_FX_ECHO, DJN_FX_REVERB}) {
    EngineHandle e;
    load(e, 0, impulse(0.5, 30), 120, 0.0);
    setupFx(e, 0, type, 0.5, 0.3f, 1.0f);
    djn_fx_set_on(e, 0, 1);
    djn_deck_play(e, 0);
    render(e, 0.6);
    djn_fx_set_on(e, 0, 0);  // off right after the click
    const auto tail = render(e, 0.4);
    CHECK(rms(tail) > 1e-3);  // repeats / reverb still audible
    CHECK(engineState(e).fx[0].tail_active == 1);
    render(e, 12.0);
    CHECK(engineState(e).fx[0].tail_active == 0);  // and eventually finished
  }
}

TEST(roll_repeats_the_slice_from_the_last_beat) {
  EngineHandle e;
  load(e, 0, steppedTones(12), 120, 0.0);
  setupFx(e, 0, DJN_FX_ROLL, 1.0, 0.5f, 1.0f);
  djn_deck_play(e, 0);
  render(e, 2.15);  // beat 4.3: the tone of beat 4 is 400 Hz
  djn_fx_set_on(e, 0, 1);
  const auto out = render(e, 1.5);
  // Two beats later the deck plays 500-550 Hz, but the roll still repeats beat 4.
  std::vector<float> win(out.begin() + int(0.9 * kRate), out.begin() + int(1.3 * kRate));
  CHECK_NEAR(frequency(win, 0), 400.0, 6.0);
  djn_fx_set_on(e, 0, 0);
  const auto after = render(e, 0.4);
  std::vector<float> live(after.begin() + int(0.05 * kRate), after.end());
  CHECK(frequency(live, 0) > 500.0);  // back to the live deck
}

TEST(trans_cuts_on_the_beat) {
  EngineHandle e;
  load(e, 0, sine(1000, 10), 120, 0.0);
  setupFx(e, 0, DJN_FX_TRANS, 0.5, 1.0f, 1.0f);  // 250 ms slots: 125 ms on, 125 ms off
  djn_fx_set_on(e, 0, 1);
  djn_deck_play(e, 0);
  const auto out = render(e, 2.5);
  const double on = rms(out, size_t(2.01 * kRate), size_t(2.11 * kRate));
  const double off = rms(out, size_t(2.14 * kRate), size_t(2.24 * kRate));
  CHECK_NEAR(on, 0.3535, 0.01);
  CHECK(db(off / on) < -40);
}

TEST(pitch_fx_shifts_an_octave) {
  EngineHandle e;
  load(e, 0, sine(500, 5), 120, 0.0);
  setupFx(e, 0, DJN_FX_PITCH, 1.0, 1.0f, 1.0f);  // depth 1 = +12 semitones
  djn_fx_set_on(e, 0, 1);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.5);
  std::vector<float> win(out.begin() + int(0.5 * kRate), out.end());
  CHECK_NEAR(frequency(win, 0), 1000.0, 15.0);
}

TEST(fx_on_a_channel_leaves_other_channels_alone) {
  EngineHandle e;
  load(e, 0, sine(1000, 5), 120, 0.0);
  setupFx(e, 0, DJN_FX_TRANS, 0.25, 1.0f, 1.0f);
  djn_fx_set_target(e, 0, 1);  // channel B, which is silent
  djn_fx_set_on(e, 0, 1);
  djn_deck_play(e, 0);
  auto out = render(e, 1.0);
  double worst = 0;
  for (size_t w = kRate / 5; w + 480 < out.size(); w += 480) worst = std::max(worst, std::fabs(db(rms(out, w, w + 480) / 0.3535)));
  CHECK(worst < 0.2);  // channel A untouched
  djn_fx_set_target(e, 0, 0);
  out = render(e, 1.0);
  double quiet = 1;
  for (size_t w = kRate / 5; w + 480 < out.size(); w += 480) quiet = std::min(quiet, rms(out, w, w + 480));
  CHECK(quiet < 0.01);  // now it cuts channel A
}

TEST(every_effect_is_stable) {
  const djn_fx_type all[] = {DJN_FX_ECHO, DJN_FX_DELAY, DJN_FX_PING_PONG, DJN_FX_REVERB, DJN_FX_FLANGER, DJN_FX_PHASER,
                             DJN_FX_ROLL, DJN_FX_STUTTER, DJN_FX_TRANS, DJN_FX_PITCH, DJN_FX_DISTORTION, DJN_FX_CRUSH};
  for (djn_fx_type t : all) {
    EngineHandle e;
    load(e, 0, clicks(124, 0.0, 20), 124, 0.0);
    load(e, 1, sine(220, 20, 0.4f), 0, 0);
    setupFx(e, 0, t, 1.0, 1.0f, 1.0f);  // maximum depth and wet
    djn_fx_set_on(e, 0, 1);
    djn_deck_play(e, 0);
    djn_deck_play(e, 1);
    std::vector<float> all;
    for (double beats : {1.0, 0.25, 4.0, 1.0 / 16.0, 16.0}) {
      djn_fx_set_beats(e, 0, beats);
      render(e, 0.7, 2, &all);
    }
    djn_fx_set_on(e, 0, 0);
    render(e, 1.0, 2, &all);
    bool finite = true;
    for (float v : all) finite = finite && std::isfinite(v) && std::fabs(v) <= 1.0f;
    CHECK(finite);
    const double changed = rms(all, size_t(0.2 * kRate), size_t(0.7 * kRate));
    CHECK(changed > 0.01);
  }
}

TEST(fx_rejects_bad_arguments) {
  EngineHandle e;
  CHECK(djn_fx_set_type(e, 2, DJN_FX_ECHO) == DJN_ERR_INVALID_ARG);
  CHECK(djn_fx_set_type(e, 0, djn_fx_type(12)) == DJN_ERR_INVALID_ARG);
  CHECK(djn_fx_set_target(e, 0, 2) == DJN_ERR_INVALID_ARG);  // only 2 decks
  CHECK(djn_fx_set_beats(e, 0, 0) == DJN_ERR_INVALID_ARG);
  CHECK(djn_fx_set_bpm(e, -1) == DJN_ERR_INVALID_ARG);
}

// ---------------------------------------------------------------- sampler

TEST(one_shot_plays_once_then_frees_its_voice) {
  EngineHandle e;
  CHECK(loadSample(e, 3, sine(600, 0.2)) == DJN_OK);
  render(e, 0.01);
  CHECK(engineState(e).sampler_loaded == (uint64_t(1) << 3));
  djn_sampler_trigger(e, 3, 1.0f);
  const auto out = render(e, 0.5);
  CHECK_NEAR(rms(out, size_t(0.02 * kRate), size_t(0.18 * kRate)), 0.3535, 0.01);
  CHECK(peak(out, size_t(0.22 * kRate)) < 1e-6);
  CHECK(engineState(e).sampler_playing == 0);
}

TEST(gate_loop_and_toggle_modes) {
  EngineHandle e;
  loadSample(e, 0, sine(500, 2.0));
  loadSample(e, 1, sine(700, 0.25));
  djn_sampler_set_mode(e, 0, DJN_PAD_GATE);
  djn_sampler_set_mode(e, 1, DJN_PAD_TOGGLE);
  djn_sampler_trigger(e, 0, 1.0f);
  render(e, 0.3);
  djn_sampler_release(e, 0);
  auto out = render(e, 0.3);
  CHECK(peak(out, size_t(0.02 * kRate)) < 1e-6);  // gate stopped on release

  djn_sampler_trigger(e, 1, 1.0f);  // toggle on: a 250 ms sample loops
  out = render(e, 1.0);
  CHECK(rms(out, size_t(0.8 * kRate), size_t(1.0 * kRate)) > 0.3);
  CHECK((engineState(e).sampler_playing & 2) != 0);
  djn_sampler_trigger(e, 1, 1.0f);  // toggle off
  out = render(e, 0.2);
  CHECK(peak(out, size_t(0.02 * kRate)) < 1e-6);
}

TEST(choke_group_cuts_the_other_pad) {
  EngineHandle e;
  loadSample(e, 0, sine(400, 2.0));  // "open hat"
  loadSample(e, 1, sine(900, 0.1));  // "closed hat"
  djn_sampler_set_choke(e, 0, 1);
  djn_sampler_set_choke(e, 1, 1);
  djn_sampler_trigger(e, 0, 1.0f);
  render(e, 0.2);
  djn_sampler_trigger(e, 1, 1.0f);
  const auto out = render(e, 0.4);
  CHECK(peak(out, size_t(0.15 * kRate)) < 1e-6);  // both done: pad 0 was choked
}

TEST(quantized_trigger_lands_on_the_next_beat) {
  EngineHandle e;
  load(e, 0, silence(10), 120, 0.0);  // master deck at 120 BPM
  loadSample(e, 0, sine(800, 0.3));
  djn_sampler_set_quantize(e, 1.0);
  djn_deck_play(e, 0);
  render(e, 0.3);  // beat 0.6
  djn_sampler_trigger(e, 0, 1.0f);
  const auto out = render(e, 0.5);
  const double onset = double(firstSound(out)) / kRate;
  CHECK_NEAR(onset, 0.2, 0.002);  // beat 1 is at 0.5 s: 0.2 s after the press
}

TEST(synced_loop_follows_the_master_tempo_and_keeps_pitch) {
  EngineHandle e;
  load(e, 0, silence(20), 120, 0.0);
  djn_deck_set_pitch(e, 0, 0.05);  // master at 126 BPM
  loadSample(e, 0, sine(1000, 0.5), 120);  // one beat at 120 BPM
  djn_sampler_set_mode(e, 0, DJN_PAD_LOOP);
  djn_deck_play(e, 0);
  render(e, 0.2);
  djn_sampler_trigger(e, 0, 1.0f);
  const auto out = render(e, 2.0);
  std::vector<float> win(out.begin() + int(0.3 * kRate), out.end());
  CHECK_NEAR(frequency(win, 0), 1000.0, 10.0);
  CHECK(rms(out, size_t(1.5 * kRate), size_t(2.0 * kRate)) > 0.3);  // still looping
}

TEST(capture_grabs_the_last_beats_from_a_deck) {
  EngineHandle e;
  load(e, 0, sine(440, 10), 120, 0.0);
  djn_deck_play(e, 0);
  render(e, 2.0);
  CHECK(djn_sampler_capture(e, 5, 0, 1.0) == DJN_OK);  // 1 beat = 0.5 s
  render(e, 0.01);
  CHECK((engineState(e).sampler_loaded >> 5) & 1);
  djn_mixer_set_fader(e, 0, 0.0f);  // mute the deck: only the sampler remains
  render(e, 0.1);
  djn_sampler_trigger(e, 5, 1.0f);
  const auto out = render(e, 0.8);
  std::vector<float> win(out.begin() + int(0.05 * kRate), out.begin() + int(0.45 * kRate));
  CHECK_NEAR(frequency(win, 0), 440.0, 2.0);
  CHECK(peak(out, size_t(0.52 * kRate)) < 1e-6);  // 0.5 s long
}

TEST(sampler_routes_through_a_channel) {
  EngineHandle e;
  loadSample(e, 0, sine(600, 1.0));
  djn_sampler_set_output(e, 1);
  djn_mixer_set_fader(e, 1, 0.0f);  // channel B down: sampler silent
  djn_sampler_trigger(e, 0, 1.0f);
  auto out = render(e, 0.3);
  CHECK(peak(out) < 1e-6);
  djn_sampler_set_output(e, DJN_SAMPLER_TO_MASTER);
  djn_sampler_trigger(e, 0, 1.0f);
  out = render(e, 0.3);
  CHECK(rms(out, size_t(0.05 * kRate)) > 0.3);
}

TEST(sampler_pitch_and_gain) {
  EngineHandle e;
  loadSample(e, 0, sine(500, 1.0));
  djn_sampler_set_pitch(e, 0, 12.0f);
  djn_sampler_set_gain_db(e, 0, -6.0f);
  djn_sampler_trigger(e, 0, 1.0f);
  const auto out = render(e, 0.4);
  CHECK_NEAR(frequency(out, size_t(0.02 * kRate)), 1000.0, 2.0);
  CHECK_NEAR(db(rms(out, size_t(0.02 * kRate), size_t(0.4 * kRate)) / 0.3535), -6.0, 0.2);
}

TEST(sampler_survives_abuse) {
  EngineHandle e(2);
  load(e, 0, clicks(126, 0.0, 30), 126, 0.0);
  djn_deck_play(e, 0);
  std::mt19937 rng(99);
  std::vector<float> buf(size_t(kBlock) * 2);
  bool finite = true;
  for (int block = 0; block < 3000; ++block) {
    const int slot = int(rng() % 8);
    switch (rng() % 10) {
      case 0: loadSample(e, slot, sine(200 + 100 * slot, 0.05 + 0.1 * (rng() % 5)), (rng() % 2) ? 126 : 0); break;
      case 1: djn_sampler_trigger(e, slot, 0.8f); break;
      case 2: djn_sampler_release(e, slot); break;
      case 3: djn_sampler_set_mode(e, slot, djn_pad_mode(rng() % 4)); break;
      case 4: djn_sampler_unload(e, slot); break;
      case 5: djn_sampler_capture(e, slot, 0, 0.25 * double(1 + rng() % 8)); break;
      case 6: djn_sampler_set_quantize(e, (rng() % 2) ? 0.25 : 0.0); break;
      case 7: djn_sampler_set_choke(e, slot, int(rng() % 3)); break;
      case 8: djn_sampler_set_pitch(e, slot, float(int(rng() % 25) - 12)); break;
      case 9: if (block % 500 == 0) djn_sampler_stop_all(e); break;
    }
    djn_engine_process(e, buf.data(), kBlock, 2);
    for (float v : buf) finite = finite && std::isfinite(v) && std::fabs(v) <= 1.0f;
    if (block % 8 == 0) djn_engine_collect_garbage(e);
  }
  CHECK(finite);
}
