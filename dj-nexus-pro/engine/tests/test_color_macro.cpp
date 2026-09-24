// Colour FX and performance macro tests through the public C API.
#include <random>
#include <set>
#include <vector>

#include "djnexus/djnexus.h"
#include "test.h"
#include "test_util.h"

namespace {

std::vector<float> clickAt(double at, double seconds) {
  std::vector<float> s(size_t(seconds * kRate) * 2, 0.0f);
  const size_t i = size_t(at * kRate);
  for (size_t k = 0; k < 48; ++k) s[2 * (i + k)] = s[2 * (i + k) + 1] = 0.8f * float(std::exp(-double(k) / 8.0));
  return s;
}

djn_engine_state stateOf(djn_engine* e) {
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  return s;
}

double windowRms(const std::vector<float>& x, double from, double to) {
  return rms(x, size_t(from * kRate), size_t(to * kRate));
}

}  // namespace

// ---------------------------------------------------------------- colour FX

TEST(color_noise_adds_filtered_noise_only_when_turned) {
  EngineHandle e;
  djn_mixer_set_color_fx(e, DJN_COLOR_NOISE);
  auto out = render(e, 0.3);
  CHECK(peak(out) == 0.0);  // knob at centre: nothing
  djn_mixer_set_filter(e, 0, 0.8f);
  out = render(e, 0.5);
  CHECK(windowRms(out, 0.2, 0.5) > 0.01);
}

TEST(color_dub_echo_repeats_and_rings_out) {
  EngineHandle e;
  load(e, 0, clickAt(1.0, 6), 120, 0.0);
  djn_mixer_set_color_fx(e, DJN_COLOR_DUB_ECHO);
  djn_mixer_set_color_param(e, 0.5f);
  djn_mixer_set_filter(e, 0, 0.3f);  // echo send open (mild high-pass on the repeats)
  djn_deck_play(e, 0);
  render(e, 1.05);
  djn_mixer_set_filter(e, 0, 0.0f);  // knob back to centre: send closes, echoes continue
  const auto out = render(e, 1.0);
  // 3/4 beat at 120 BPM = 375 ms after the click at 1.0 s.
  const double echo = windowRms(out, 0.32, 0.35);  // 1.375 s absolute
  const double gap = windowRms(out, 0.15, 0.25);
  CHECK(echo > 0.005);
  CHECK(echo > gap * 10);
}

TEST(color_pitch_bends_an_octave_each_way) {
  for (float knob : {1.0f, -1.0f}) {
    EngineHandle e;
    load(e, 0, sine(500, 5), 0, 0);
    djn_mixer_set_color_fx(e, DJN_COLOR_PITCH);
    djn_mixer_set_filter(e, 0, knob);
    djn_deck_play(e, 0);
    const auto out = render(e, 1.0);
    const size_t a = size_t(0.3 * kRate), b = out.size();
    const double target = toneLevel(out, knob > 0 ? 1000.0 : 250.0, a, b);
    const double original = toneLevel(out, 500.0, a, b);
    CHECK(db(target / original) > 15);  // the energy moved an octave
    CHECK(target > 0.25);  // and stayed close to full level (0.354)
  }
}

TEST(color_crush_reduces_resolution) {
  EngineHandle e;
  load(e, 0, sine(300, 5), 0, 0);
  djn_mixer_set_color_fx(e, DJN_COLOR_CRUSH);
  djn_mixer_set_filter(e, 0, -0.35f);  // crushed; the low-pass is still wide open for 300 Hz
  djn_deck_play(e, 0);
  const auto out = render(e, 0.7);
  std::set<int> levels;
  for (size_t i = size_t(0.2 * kRate); i < out.size(); ++i) levels.insert(int(std::lround(out[i] * 1e4)));
  CHECK(levels.size() < 2000);  // a clean sine this long has several thousand distinct values
  CHECK(windowRms(out, 0.2, 0.7) > 0.2);  // but it is still clearly audible
}

TEST(color_space_adds_a_tail) {
  EngineHandle e;
  load(e, 0, clickAt(0.5, 6), 120, 0.0);
  djn_mixer_set_color_fx(e, DJN_COLOR_SPACE);
  djn_mixer_set_color_param(e, 0.6f);
  djn_mixer_set_filter(e, 0, 0.3f);
  djn_deck_play(e, 0);
  render(e, 0.55);
  djn_mixer_set_filter(e, 0, 0.0f);
  const auto tail = render(e, 0.6);
  CHECK(windowRms(tail, 0.1, 0.5) > 1e-3);  // reverb still ringing after the knob returns
}

TEST(color_filter_mode_is_unchanged) {
  EngineHandle e;
  load(e, 0, sine(5000, 3), 0, 0);
  djn_mixer_set_color_fx(e, DJN_COLOR_FILTER);
  djn_mixer_set_filter(e, 0, -1.0f);
  djn_deck_play(e, 0);
  const auto out = render(e, 1.0);
  CHECK(db(windowRms(out, 0.5, 1.0) / 0.3535) < -30);
}

TEST(every_color_fx_is_stable) {
  for (int type = DJN_COLOR_FILTER; type <= DJN_COLOR_SPACE; ++type) {
    EngineHandle e;
    load(e, 0, clicks(126, 0.0, 10), 126, 0.0);
    load(e, 1, sine(220, 10, 0.5f), 0, 0);
    djn_mixer_set_color_fx(e, djn_color_fx(type));
    djn_mixer_set_color_param(e, 1.0f);
    djn_deck_play(e, 0);
    djn_deck_play(e, 1);
    std::vector<float> all;
    for (float k : {-1.0f, -0.5f, 0.0f, 0.3f, 1.0f, 0.0f}) {
      djn_mixer_set_filter(e, 0, k);
      djn_mixer_set_filter(e, 1, -k);
      render(e, 0.5, 2, &all);
    }
    bool ok = true;
    for (float v : all) ok = ok && std::isfinite(v) && std::fabs(v) <= 1.0f;
    CHECK(ok);
  }
}

// ---------------------------------------------------------------- macros

TEST(riser_grows_and_ends_on_the_bar_line) {
  EngineHandle e;  // nothing loaded: free-running clock at 120 BPM from beat 0
  CHECK(djn_macro_start(e, DJN_MACRO_RISER, 2, DJN_FX_TARGET_MASTER, 0) == DJN_OK);
  render(e, 0.01);
  CHECK(stateOf(e).macro == DJN_MACRO_RISER);
  const auto out = render(e, 4.4);  // 2 bars = 8 beats = 4 s at 120 BPM
  const double early = windowRms(out, 0.3, 1.0), late = windowRms(out, 3.3, 3.95);
  CHECK(late > early * 4);
  CHECK(windowRms(out, 4.01, 4.4) < 1e-4);  // stopped at the bar line
  CHECK(stateOf(e).macro == -1);
}

TEST(build_up_sweeps_the_lows_and_snaps_back_on_the_drop) {
  EngineHandle e;
  load(e, 0, sine(80, 20), 120, 0.0);
  djn_deck_play(e, 0);
  render(e, 0.5);  // beat 1 of bar 0
  djn_macro_start(e, DJN_MACRO_BUILD_UP, 2, 0, 0);
  const auto out = render(e, 4.0);  // the build ends at beat 8 = 4.0 s, i.e. 3.5 s from here
  const double before = 0.3535;
  // The 80 Hz tone itself (ignoring the riser noise the build-up adds).
  const double nearEnd = toneLevel(out, 80.0, size_t(2.6 * kRate), size_t(2.95 * kRate));
  const double early = toneLevel(out, 80.0, size_t(0.1 * kRate), size_t(0.45 * kRate));
  CHECK(db(early / before) > -1.5);   // still full at the start of the build
  CHECK(db(nearEnd / before) < -10);  // swept out by the high-pass near the end
  CHECK_NEAR(db(windowRms(out, 3.6, 3.95) / before), 0.0, 0.5);  // clean again after the drop
  CHECK(stateOf(e).macro == -1);
}

TEST(drop_cuts_until_the_next_bar_then_returns) {
  EngineHandle e;
  load(e, 0, sine(440, 20), 120, 0.0);
  djn_deck_play(e, 0);
  render(e, 1.25);  // beat 2.5
  djn_macro_start(e, DJN_MACRO_DROP, 1, DJN_FX_TARGET_MASTER, 0);
  const auto out = render(e, 1.5);  // next bar line: beat 4 = 2.0 s absolute = 0.75 s from here
  CHECK(windowRms(out, 0.05, 0.7) < 1e-4);
  CHECK_NEAR(windowRms(out, 0.8, 1.4), 0.3535, 0.01);
  // Back within a few ms of the bar line.
  size_t firstLoud = 0;
  for (size_t i = size_t(0.7 * kRate); i < out.size(); ++i) {
    if (std::fabs(out[i]) > 0.1f) { firstLoud = i; break; }
  }
  CHECK_NEAR(double(firstLoud) / kRate, 0.75, 0.006);
}

TEST(drop_with_impact_adds_a_boom) {
  EngineHandle e;
  load(e, 0, std::vector<float>(size_t(20 * kRate) * 2, 0.0f), 120, 0.0);
  djn_deck_play(e, 0);
  render(e, 0.25);
  djn_macro_start(e, DJN_MACRO_DROP, 1, DJN_FX_TARGET_MASTER, 1);
  const auto out = render(e, 3.0);  // bar line at 2.0 s absolute = 1.75 s from here
  CHECK(windowRms(out, 0.1, 1.7) < 1e-4);
  CHECK(windowRms(out, 1.76, 2.2) > 0.05);  // the impact
}

TEST(macro_on_a_channel_leaves_others_alone) {
  EngineHandle e;
  load(e, 0, sine(440, 10), 120, 0.0);
  djn_deck_play(e, 0);
  djn_macro_start(e, DJN_MACRO_DROP, 1, 1, 0);  // cut channel B only
  const auto out = render(e, 1.0);
  CHECK_NEAR(windowRms(out, 0.1, 0.9), 0.3535, 0.01);
}

TEST(macro_cancel_returns_to_dry) {
  EngineHandle e;
  load(e, 0, sine(440, 10), 120, 0.0);
  djn_deck_play(e, 0);
  djn_macro_start(e, DJN_MACRO_DROP, 1, DJN_FX_TARGET_MASTER, 1);
  render(e, 0.3);
  djn_macro_cancel(e);
  const auto out = render(e, 0.3);
  CHECK_NEAR(windowRms(out, 0.02, 0.3), 0.3535, 0.01);  // no impact on cancel
  CHECK(djn_macro_start(e, djn_macro(3), 1, -1, 0) == DJN_ERR_INVALID_ARG);
  CHECK(djn_macro_start(e, DJN_MACRO_RISER, 0, -1, 0) == DJN_ERR_INVALID_ARG);
}

TEST(macros_survive_abuse) {
  EngineHandle e;
  load(e, 0, clicks(128, 0.0, 30), 128, 0.0);
  djn_deck_play(e, 0);
  std::mt19937 rng(5);
  std::vector<float> buf(size_t(kBlock) * 2);
  bool ok = true;
  for (int block = 0; block < 3000; ++block) {
    if (block % 40 == 0) {
      switch (rng() % 4) {
        case 0: djn_macro_start(e, djn_macro(rng() % 3), 1 + int(rng() % 4), int(rng() % 3) - 1, int(rng() % 2)); break;
        case 1: djn_macro_cancel(e); break;
        case 2: djn_mixer_set_color_fx(e, djn_color_fx(rng() % 6)); break;
        case 3: djn_mixer_set_filter(e, int(rng() % 2), float(int(rng() % 21) - 10) / 10.0f); break;
      }
    }
    djn_engine_process(e, buf.data(), kBlock, 2);
    for (float v : buf) ok = ok && std::isfinite(v) && std::fabs(v) <= 1.0f;
  }
  CHECK(ok);
}
