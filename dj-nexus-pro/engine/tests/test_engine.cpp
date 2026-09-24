// End-to-end engine tests through the public C API, rendered offline.
#include <atomic>
#include <cstdio>
#include <cstring>
#include <memory>
#include <random>
#include <thread>
#include <vector>

#include "djnexus/djnexus.h"
#include "test.h"
#include "test_util.h"


TEST(silent_when_nothing_loaded) {
  EngineHandle e;
  const auto out = render(e, 0.5);
  CHECK(peak(out) == 0.0);
}

TEST(plays_sine_at_unity_gain) {
  EngineHandle e;
  CHECK(load(e, 0, sine(1000, 3)) == DJN_OK);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.0);
  CHECK_NEAR(rms(out, kRate / 10), 0.5 / std::sqrt(2.0), 0.005);
  CHECK_NEAR(frequency(out, kRate / 10), 1000, 1);
}

TEST(pitch_changes_frequency_without_key_lock) {
  EngineHandle e;
  load(e, 0, sine(1000, 5));
  djn_deck_set_pitch(e, 0, 0.10);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.0);
  CHECK_NEAR(frequency(out, kRate / 5), 1100, 5);
}

TEST(key_lock_keeps_pitch_and_changes_tempo) {
  for (double pitch : {0.10, -0.15, 0.30}) {
    EngineHandle e;
    load(e, 0, sine(1000, 10));
    djn_deck_set_key_lock(e, 0, 1);
    djn_deck_set_pitch(e, 0, pitch);
    djn_deck_play(e, 0);
    const auto out = render(e, 2.0);
    CHECK_NEAR(frequency(out, kRate / 5), 1000, 10);
    CHECK_NEAR(deckState(e, 0).position_sec, 2.0 * (1 + pitch), 0.05);
    // No level pumping: 10 ms windows stay within 1.5 dB of the overall level.
    const double overall = rms(out, kRate / 5);
    double worst = 0;
    for (size_t w = kRate / 5; w + 480 < out.size(); w += 480) worst = std::max(worst, std::fabs(db(rms(out, w, w + 480) / overall)));
    CHECK(worst < 1.5);
  }
}

TEST(resamples_tracks_to_engine_rate) {
  EngineHandle e;
  load(e, 0, sine(1000, 4, 0.5f, 44100), 0, 0, 44100);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.0);
  CHECK_NEAR(frequency(out, kRate / 10), 1000, 1);
  CHECK_NEAR(deckState(e, 0).duration_sec, 4.0, 0.001);
}

TEST(classic_eq_low_cut_and_mid_untouched) {
  EngineHandle e;
  load(e, 0, sine(50, 5));
  load(e, 1, sine(1000, 5));
  djn_mixer_set_fader(e, 1, 0);
  djn_mixer_set_eq_db(e, 0, 0, -26);
  djn_deck_play(e, 0);
  const auto low = render(e, 1.0);
  CHECK(db(rms(low, kRate / 2) / (0.5 / std::sqrt(2.0))) < -15);

  djn_mixer_set_fader(e, 0, 0);
  djn_mixer_set_fader(e, 1, 1);
  djn_mixer_set_eq_db(e, 1, 0, -26);
  djn_deck_play(e, 1);
  const auto mid = render(e, 1.0);
  CHECK_NEAR(db(rms(mid, kRate / 2) / (0.5 / std::sqrt(2.0))), 0.0, 1.0);
}

TEST(isolator_eq_flat_when_neutral_and_kills_bands) {
  for (double f : {80.0, 1000.0, 9000.0}) {
    EngineHandle e;
    djn_mixer_set_eq_mode(e, DJN_EQ_ISOLATOR);
    load(e, 0, sine(f, 3));
    djn_deck_play(e, 0);
    const auto out = render(e, 1.0);
    CHECK_NEAR(db(rms(out, kRate / 2) / (0.5 / std::sqrt(2.0))), 0.0, 0.3);
  }
  struct Case { double freq; int band; } cases[] = {{50, 0}, {1000, 1}, {12000, 2}};
  for (auto c : cases) {
    EngineHandle e;
    djn_mixer_set_eq_mode(e, DJN_EQ_ISOLATOR);
    djn_mixer_set_eq_db(e, 0, c.band, -80);  // kill
    load(e, 0, sine(c.freq, 3));
    djn_deck_play(e, 0);
    const auto out = render(e, 1.0);
    CHECK(db(rms(out, kRate / 2) / (0.5 / std::sqrt(2.0))) < -25);
  }
}

TEST(filter_knob_low_and_high_pass) {
  {
    EngineHandle e;
    load(e, 0, sine(5000, 3));
    djn_mixer_set_filter(e, 0, -1.0f);
    djn_deck_play(e, 0);
    const auto out = render(e, 1.0);
    CHECK(db(rms(out, kRate / 2) / 0.3535) < -30);
  }
  {
    EngineHandle e;
    load(e, 0, sine(100, 3));
    djn_mixer_set_filter(e, 0, 1.0f);
    djn_deck_play(e, 0);
    const auto out = render(e, 1.0);
    CHECK(db(rms(out, kRate / 2) / 0.3535) < -30);
  }
  {
    EngineHandle e;  // centre = untouched
    load(e, 0, sine(5000, 3));
    djn_mixer_set_filter(e, 0, 0.0f);
    djn_deck_play(e, 0);
    const auto out = render(e, 1.0);
    CHECK_NEAR(db(rms(out, kRate / 2) / 0.3535), 0.0, 0.1);
  }
}

TEST(crossfader_assign_and_curves) {
  EngineHandle e;
  load(e, 0, sine(1000, 5));
  djn_mixer_set_xfader_assign(e, 0, DJN_XF_A);
  djn_mixer_set_crossfader(e, 1.0f);  // fully on B
  djn_deck_play(e, 0);
  auto out = render(e, 0.5);
  CHECK(db(rms(out, kRate / 4)) < -80);

  djn_mixer_set_crossfader_curve(e, DJN_XF_CURVE_SHARP);
  djn_mixer_set_crossfader(e, 0.5f);  // sharp curve: both full in the middle
  out = render(e, 0.5);
  CHECK_NEAR(rms(out, kRate / 4), 0.3535, 0.01);
}

TEST(limiter_holds_ceiling) {
  EngineHandle e;
  load(e, 0, sine(200, 3, 0.9f));
  djn_mixer_set_trim_db(e, 0, 12);
  djn_mixer_set_limiter(e, 1, -1.0f);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.5);
  CHECK(peak(out) <= std::pow(10.0, -1.0 / 20.0) + 1e-4);
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  CHECK(s.limiter_gain_reduction_db > 5);
}

TEST(hot_cue_jumps) {
  EngineHandle e;
  load(e, 0, sine(1000, 10));
  djn_deck_hot_cue_set_at(e, 0, 3, 1.0);
  djn_deck_play(e, 0);
  render(e, 3.0);
  djn_deck_hot_cue_trigger(e, 0, 3);
  render(e, 0.5);
  CHECK_NEAR(deckState(e, 0).position_sec, 1.5, 0.02);
}

TEST(beat_loop_snaps_and_holds) {
  for (int keyLock = 0; keyLock <= 1; ++keyLock) {
    EngineHandle e;
    load(e, 0, clicks(120, 0.0, 20), 120, 0.0);
    djn_deck_set_key_lock(e, 0, keyLock);
    djn_deck_set_pitch(e, 0, keyLock ? 0.05 : 0.0);
    djn_deck_play(e, 0);
    render(e, 2.1);
    djn_deck_loop_beats(e, 0, 1);
    render(e, 0.05);
    auto s = deckState(e, 0);
    CHECK(s.looping == 1);
    CHECK_NEAR(s.loop_end_sec - s.loop_start_sec, 0.5, 1e-6);
    CHECK_NEAR(std::fmod(s.loop_start_sec, 0.5), 0.0, 1e-6);  // on a beat
    render(e, 3.0);
    s = deckState(e, 0);
    CHECK(s.position_sec >= s.loop_start_sec - 1e-3 && s.position_sec <= s.loop_end_sec + 1e-3);
    djn_deck_loop_exit(e, 0);
    render(e, 1.0);
    CHECK(deckState(e, 0).position_sec > s.loop_end_sec);
  }
}

TEST(sync_matches_tempo_and_phase) {
  for (int keyLock = 0; keyLock <= 1; ++keyLock) {
    EngineHandle e;
    load(e, 0, clicks(126, 0.0, 60), 126, 0.0);
    load(e, 1, clicks(128, 0.1, 60), 128, 0.1);
    djn_deck_set_key_lock(e, 1, keyLock);
    djn_deck_play(e, 0);
    render(e, 1.37);
    djn_deck_set_sync(e, 1, 1);
    djn_deck_play(e, 1);
    render(e, 4.0);
    djn_engine_state s;
    djn_engine_get_state(e, &s);
    CHECK(s.master_deck == 0);
    CHECK_NEAR(s.decks[1].effective_bpm, 126.0, 0.01);
    CHECK(std::fabs(phaseDiff(s.decks[1].beat_phase, s.decks[0].beat_phase)) < 0.02);
  }
}

TEST(sync_follows_master_tempo_changes) {
  EngineHandle e;
  load(e, 0, clicks(124, 0.0, 60), 124, 0.0);
  load(e, 1, clicks(124, 0.0, 60), 124, 0.0);
  djn_deck_play(e, 0);
  djn_deck_set_sync(e, 1, 1);
  djn_deck_play(e, 1);
  render(e, 1.0);
  djn_deck_set_pitch(e, 0, 0.04);
  render(e, 3.0);
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  CHECK_NEAR(s.decks[1].effective_bpm, 124 * 1.04, 0.01);
  CHECK(std::fabs(phaseDiff(s.decks[1].beat_phase, s.decks[0].beat_phase)) < 0.02);
}

TEST(set_grid_enables_sync_after_load) {
  EngineHandle e;
  load(e, 0, clicks(126, 0.0, 30), 126, 0.0);
  load(e, 1, clicks(128, 0.1, 30), 0, 0.0);  // loaded without a grid
  djn_deck_play(e, 0);
  render(e, 0.5);
  CHECK(deckState(e, 1).track_bpm == 0.0);
  CHECK(djn_deck_set_grid(e, 1, 128, 0.1) == DJN_OK);
  djn_deck_set_sync(e, 1, 1);
  djn_deck_play(e, 1);
  render(e, 3.0);
  const auto a = deckState(e, 0), b = deckState(e, 1);
  CHECK_NEAR(b.track_bpm, 128.0, 1e-9);
  CHECK_NEAR(b.effective_bpm, 126.0, 0.01);
  CHECK(std::fabs(phaseDiff(b.beat_phase, a.beat_phase)) < 0.02);
  CHECK(djn_deck_set_grid(e, 1, 1000, 0) == DJN_ERR_INVALID_ARG);
}

TEST(cue_sets_when_paused_and_returns_when_playing) {
  EngineHandle e;
  load(e, 0, sine(440, 10));
  djn_deck_seek(e, 0, 2.0);
  render(e, 0.05);
  djn_deck_cue(e, 0);
  render(e, 0.05);
  CHECK_NEAR(deckState(e, 0).cue_sec, 2.0, 1e-3);
  djn_deck_play(e, 0);
  render(e, 1.0);
  djn_deck_cue(e, 0);
  const auto tail = render(e, 0.2);
  const auto s = deckState(e, 0);
  CHECK(s.playing == 0);
  CHECK_NEAR(s.position_sec, 2.0, 1e-3);
  // Silent after the 5 ms fade. Not exactly zero on every CPU: the EQ filters
  // leave a rounding tail around -230 dB on ARM64.
  CHECK(peak(tail, 2400) < 1e-7);
}

TEST(reverse_plays_backwards) {
  EngineHandle e;
  load(e, 0, sine(440, 10));
  djn_deck_seek(e, 0, 5.0);
  djn_deck_play(e, 0);
  render(e, 0.01);
  djn_deck_set_reverse(e, 0, 1);
  render(e, 1.0);
  CHECK_NEAR(deckState(e, 0).position_sec, 4.0, 0.03);
}

TEST(slip_returns_to_shadow_position) {
  EngineHandle e;
  load(e, 0, clicks(120, 0.0, 30), 120, 0.0);
  djn_deck_set_slip(e, 0, 1);
  djn_deck_play(e, 0);
  render(e, 2.0);
  djn_deck_loop_beats(e, 0, 1);
  render(e, 2.0);
  djn_deck_loop_exit(e, 0);
  render(e, 0.5);
  CHECK_NEAR(deckState(e, 0).position_sec, 4.5, 0.03);
}

TEST(jog_scratch_moves_playhead) {
  EngineHandle e;
  load(e, 0, sine(440, 10));
  djn_deck_seek(e, 0, 5.0);
  render(e, 0.01);
  djn_deck_jog(e, 0, 1, -1.0);  // paused deck, platter dragged backwards
  render(e, 0.5);
  CHECK_NEAR(deckState(e, 0).position_sec, 4.5, 0.02);
  djn_deck_jog(e, 0, 0, 0.0);
  render(e, 0.3);
  CHECK_NEAR(deckState(e, 0).position_sec, 4.5, 0.02);  // released while paused: stays
}

TEST(stops_at_end_of_track) {
  EngineHandle e;
  load(e, 0, sine(440, 1.0));
  djn_deck_play(e, 0);
  render(e, 1.5);
  const auto s = deckState(e, 0);
  CHECK(s.playing == 0);
  CHECK_NEAR(s.position_sec, 1.0, 1e-3);
}

TEST(headphone_cue_is_pre_fader) {
  EngineHandle e;
  load(e, 0, sine(1000, 3));
  djn_mixer_set_fader(e, 0, 0.0f);
  djn_mixer_set_cue(e, 0, 1);
  djn_mixer_set_cue_mix(e, 0.0f);
  djn_deck_play(e, 0);
  std::vector<float> all;
  render(e, 1.0, 4, &all);
  double master = 0, phones = 0;
  for (size_t i = size_t(kRate / 2) * 4; i < all.size(); i += 4) {
    master = std::max(master, double(std::fabs(all[i])));
    phones = std::max(phones, double(std::fabs(all[i + 2])));
  }
  CHECK(master < 1e-6);
  CHECK_NEAR(phones, 0.5, 0.01);
}

TEST(recorder_writes_wav) {
  EngineHandle e;
  load(e, 0, sine(1000, 3));
  djn_deck_play(e, 0);
  const char* path = "djnexus_test_recording.wav";
  CHECK(djn_record_start(e, path, DJN_REC_WAV16) == DJN_OK);
  render(e, 1.0);
  CHECK(djn_record_stop(e) == DJN_OK);
  std::FILE* f = std::fopen(path, "rb");
  CHECK(f != nullptr);
  if (!f) return;
  unsigned char h[44];
  CHECK(std::fread(h, 1, 44, f) == 44);
  std::fseek(f, 0, SEEK_END);
  const long size = std::ftell(f);
  std::fclose(f);
  std::remove(path);
  CHECK(std::memcmp(h, "RIFF", 4) == 0 && std::memcmp(h + 8, "WAVE", 4) == 0);
  const uint32_t dataBytes = uint32_t(h[40]) | uint32_t(h[41]) << 8 | uint32_t(h[42]) << 16 | uint32_t(h[43]) << 24;
  CHECK(dataBytes == uint32_t(size - 44));
  CHECK_NEAR(dataBytes / 4.0, double(kRate), kBlock);
}

TEST(rejects_bad_arguments) {
  EngineHandle e;
  std::vector<float> buf(4096 * 2);
  CHECK(djn_engine_process(e, buf.data(), 4096, 2) == DJN_ERR_INVALID_ARG);  // > max block
  CHECK(djn_engine_process(e, buf.data(), 128, 3) == DJN_ERR_INVALID_ARG);
  CHECK(djn_deck_play(e, 7) == DJN_ERR_INVALID_ARG);
  CHECK(djn_deck_hot_cue_set(e, 0, 16) == DJN_ERR_INVALID_ARG);
  CHECK(djn_mixer_set_eq_db(e, 0, 3, 0) == DJN_ERR_INVALID_ARG);
  djn_engine_config bad{48000, 1024, 5};
  CHECK(djn_engine_create(&bad) == nullptr);
  CHECK(djn_deck_load_file(e, 0, "/definitely/not/here.wav", 0, 0) != DJN_OK);
}

TEST(survives_random_abuse) {
  EngineHandle e(4);
  for (int d = 0; d < 4; ++d) load(e, d, clicks(120 + d * 3, 0.05 * d, 8), 120 + d * 3, 0.05 * d);
  std::mt19937 rng(1234);
  std::uniform_int_distribution<int> pick(0, 23), deck(0, 3);
  std::uniform_real_distribution<double> uni(-1.0, 1.0);
  std::vector<float> buf(size_t(kBlock) * 4);
  bool finite = true;
  float maxAbs = 0;
  for (int block = 0; block < 4000; ++block) {  // ~21 s
    const int d = deck(rng);
    switch (pick(rng)) {
      case 0: djn_deck_toggle_play(e, d); break;
      case 1: djn_deck_cue(e, d); break;
      case 2: djn_deck_seek(e, d, 4 + 4 * uni(rng)); break;
      case 3: djn_deck_hot_cue_trigger(e, d, int(8 * std::fabs(uni(rng)))); break;
      case 4: djn_deck_loop_beats(e, d, std::pow(2.0, std::round(4 * uni(rng)))); break;
      case 5: djn_deck_loop_exit(e, d); break;
      case 6: djn_deck_set_pitch(e, d, 0.3 * uni(rng)); break;
      case 7: djn_deck_set_key_lock(e, d, uni(rng) > 0); break;
      case 8: djn_deck_set_sync(e, d, uni(rng) > 0); break;
      case 9: djn_deck_set_reverse(e, d, uni(rng) > 0.5); break;
      case 10: djn_deck_set_slip(e, d, uni(rng) > 0); break;
      case 11: djn_deck_jog(e, d, uni(rng) > 0.3, 3 * uni(rng)); break;
      case 12: djn_mixer_set_eq_db(e, d, int(3 * std::fabs(uni(rng))) % 3, float(20 * uni(rng))); break;
      case 13: djn_mixer_set_filter(e, d, float(uni(rng))); break;
      case 14: djn_mixer_set_crossfader(e, float(0.5 + 0.5 * uni(rng))); break;
      case 15: djn_mixer_set_eq_mode(e, uni(rng) > 0 ? DJN_EQ_ISOLATOR : DJN_EQ_CLASSIC); break;
      case 16: djn_deck_loop_halve(e, d); break;
      case 17: djn_deck_loop_double(e, d); break;
      case 18: djn_mixer_set_trim_db(e, d, float(12 * uni(rng))); break;
      case 19: if (block % 97 == 0) load(e, d, sine(300 + 100 * d, 6), 0, 0); break;
      case 20: djn_mixer_set_filter_resonance(e, float(std::fabs(uni(rng)))); break;
      case 21: djn_engine_set_master_deck(e, int(uni(rng) * 2)); break;
      case 22: djn_deck_loop_in(e, d); break;
      case 23: djn_deck_loop_out(e, d); break;
    }
    djn_engine_process(e, buf.data(), kBlock, 4);
    for (float v : buf) {
      if (!std::isfinite(v)) finite = false;
      maxAbs = std::max(maxAbs, std::fabs(v));
    }
    if (block % 16 == 0) djn_engine_collect_garbage(e);
  }
  CHECK(finite);
  CHECK(maxAbs <= 1.0f);
}

TEST(control_thread_and_audio_thread_run_concurrently) {
  // The real-world threading model: an audio thread renders while the UI
  // thread sends commands, loads tracks, reads state and collects garbage.
  EngineHandle e(4);
  const auto a = clicks(124, 0.0, 6);
  const auto b = sine(330, 6);
  std::atomic<bool> stop{false};
  std::atomic<bool> finite{true};
  std::thread audio([&] {
    std::vector<float> buf(size_t(kBlock) * 4);
    while (!stop.load()) {
      djn_engine_process(e, buf.data(), kBlock, 4);
      for (float v : buf) {
        if (!std::isfinite(v)) finite = false;
      }
    }
  });
  // A background loader thread, as the app would use for decoding.
  std::thread loader([&] {
    for (int i = 0; i < 40; ++i) {
      load(e, i % 4, (i % 2) ? a : b, 124, 0.0);
      djn_engine_collect_garbage(e);
    }
  });
  const char* path = "djnexus_test_concurrent.wav";
  djn_record_start(e, path, DJN_REC_WAV_FLOAT);
  std::mt19937 rng(7);
  for (int i = 0; i < 3000; ++i) {
    const int d = int(rng() % 4);
    switch (rng() % 12) {
      case 8: djn_fx_set_on(e, int(rng() % 2), int(rng() % 2)); break;
      case 9: djn_fx_set_type(e, int(rng() % 2), djn_fx_type(rng() % 12)); break;
      case 10: djn_sampler_trigger(e, int(rng() % 4), 1.0f); break;
      case 11: djn_sampler_capture(e, int(rng() % 4), d, 1.0); break;
      case 0: load(e, d, (rng() % 2) ? a : b, 124, 0.0); break;
      case 1: djn_deck_toggle_play(e, d); break;
      case 2: djn_deck_set_sync(e, d, int(rng() % 2)); break;
      case 3: djn_deck_loop_beats(e, d, 1 + double(rng() % 8)); break;
      case 4: djn_mixer_set_eq_db(e, d, int(rng() % 3), -float(rng() % 30)); break;
      case 5: djn_deck_set_key_lock(e, d, int(rng() % 2)); break;
      case 6: { djn_engine_state s; djn_engine_get_state(e, &s); break; }
      case 7: djn_engine_collect_garbage(e); break;
    }
  }
  loader.join();
  djn_record_stop(e);
  stop = true;
  audio.join();
  std::remove(path);
  CHECK(finite.load());
}

// ---------------------------------------------------------------- slip roll / censor

namespace {
// One tone per beat at 120 BPM: 200, 250, 300 ... Hz, so the playing beat is audible.
std::vector<float> beatTones(double seconds) {
  std::vector<float> s(size_t(seconds * kRate) * 2);
  double phase = 0;
  for (size_t i = 0; i < s.size() / 2; ++i) {
    const int beat = int(double(i) / (kRate * 0.5));
    phase += 2 * kPi * (200.0 + 50.0 * beat) / kRate;
    s[2 * i] = s[2 * i + 1] = 0.4f * float(std::sin(phase));
  }
  return s;
}
}  // namespace

TEST(slip_roll_repeats_the_slice_and_returns_on_time) {
  EngineHandle e;
  load(e, 0, beatTones(20), 120, 0.0);
  djn_deck_play(e, 0);
  render(e, 2.15);  // beat 4.3 (400 Hz)
  djn_deck_slip_roll(e, 0, 1, 0.5);
  const auto held = render(e, 1.0);
  auto s = deckState(e, 0);
  CHECK(s.slip_roll == 1 && s.looping == 1 && s.slip == 1);
  CHECK_NEAR(s.loop_start_sec, 2.0, 1e-6);  // the half-beat line before 2.15 s
  CHECK_NEAR(s.loop_end_sec - s.loop_start_sec, 0.25, 1e-6);
  CHECK_NEAR(frequency(held, size_t(0.5 * kRate)), 400.0, 5.0);  // still beat 4, a second later
  djn_deck_slip_roll(e, 0, 0, 0);
  render(e, 0.2);
  s = deckState(e, 0);
  CHECK(s.slip_roll == 0 && s.looping == 0);
  CHECK(s.slip == 0);                            // the user's setting (off) is back
  CHECK_NEAR(s.position_sec, 2.15 + 1.2, 0.02);  // continued as if never rolled
}

TEST(slip_roll_length_changes_while_held) {
  EngineHandle e;
  load(e, 0, beatTones(20), 120, 0.0);
  djn_deck_play(e, 0);
  render(e, 2.6);
  djn_deck_slip_roll(e, 0, 1, 1.0);
  render(e, 0.3);
  CHECK_NEAR(deckState(e, 0).loop_end_sec - deckState(e, 0).loop_start_sec, 0.5, 1e-6);
  djn_deck_slip_roll(e, 0, 1, 0.25);
  render(e, 0.3);
  CHECK_NEAR(deckState(e, 0).loop_end_sec - deckState(e, 0).loop_start_sec, 0.125, 1e-6);
  djn_deck_slip_roll(e, 0, 0, 0);
  render(e, 0.1);
  CHECK_NEAR(deckState(e, 0).position_sec, 2.6 + 0.7, 0.02);
}

TEST(censor_plays_backwards_then_snaps_to_the_real_position) {
  EngineHandle e;
  load(e, 0, beatTones(20), 120, 0.0);
  djn_deck_set_slip(e, 0, 1);  // the user already had slip on: it must stay on
  djn_deck_play(e, 0);
  render(e, 3.0);
  djn_deck_censor(e, 0, 1);
  render(e, 1.0);
  auto s = deckState(e, 0);
  CHECK(s.censor == 1 && s.reverse == 1);
  CHECK_NEAR(s.position_sec, 2.0, 0.03);  // went backwards
  djn_deck_censor(e, 0, 0);
  render(e, 0.1);
  s = deckState(e, 0);
  CHECK(s.censor == 0 && s.reverse == 0 && s.slip == 1);
  CHECK_NEAR(s.position_sec, 4.1, 0.03);
}

TEST(slip_roll_needs_a_grid_and_survives_pause) {
  EngineHandle e;
  load(e, 0, beatTones(20), 0, 0.0);  // no grid
  djn_deck_play(e, 0);
  render(e, 1.0);
  CHECK(djn_deck_slip_roll(e, 0, 1, 1.0) == DJN_OK);
  render(e, 0.2);
  CHECK(deckState(e, 0).slip_roll == 0);  // ignored
  CHECK(djn_deck_slip_roll(e, 0, 1, 0) == DJN_ERR_INVALID_ARG);

  djn_deck_set_grid(e, 0, 120, 0.0);
  djn_deck_slip_roll(e, 0, 1, 1.0);
  render(e, 0.2);
  djn_deck_pause(e, 0);
  render(e, 0.2);
  djn_deck_slip_roll(e, 0, 0, 0);  // released while paused
  render(e, 0.1);
  const auto s = deckState(e, 0);
  CHECK(s.slip_roll == 0 && s.slip == 0 && s.looping == 0);
}
