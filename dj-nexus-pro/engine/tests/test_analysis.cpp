// Unit tests for offline BPM/key analysis (src/core/analysis.cpp).
#include <cmath>
#include <vector>

#include "analysis.h"
#include "dsp.h"
#include "test.h"

namespace {

// A click track: short decaying impulses spaced exactly 60/bpm seconds apart,
// the simplest signal with an unambiguous, strongly periodic onset.
std::vector<float> makeClickTrack(double bpm, double seconds, int sampleRate) {
  std::vector<float> buf(size_t(seconds * sampleRate), 0.0f);
  const double period = 60.0 / bpm;
  const int clickLen = int(0.004 * sampleRate);  // 4 ms decaying click
  for (double t = 0.0; t < seconds; t += period) {
    const int start = int(t * sampleRate);
    for (int i = 0; i < clickLen && start + i < int(buf.size()); ++i) {
      const double decay = std::exp(-6.0 * i / clickLen);
      buf[size_t(start + i)] += float(decay);
    }
  }
  return buf;
}

// A punchy kick-like transient: a decaying low sine, closer to a real drum
// hit than makeClickTrack's broadband impulse.
std::vector<float> makeKickTrack(double bpm, double seconds, int sampleRate) {
  std::vector<float> buf(size_t(seconds * sampleRate), 0.0f);
  const double period = 60.0 / bpm;
  const int kickLen = int(0.05 * sampleRate);  // 50 ms
  for (double t = 0.0; t < seconds; t += period) {
    const int start = int(t * sampleRate);
    for (int i = 0; i < kickLen && start + i < int(buf.size()); ++i) {
      const double decay = std::exp(-30.0 * i / kickLen);
      buf[size_t(start + i)] += float(0.9 * decay * std::sin(2.0 * djn::kPi * 90.0 * i / sampleRate));
    }
  }
  return buf;
}

// A sustained triad (three sine partials), the simplest signal with an
// unambiguous tonal center for key detection.
std::vector<float> makeChord(double rootHz, bool minorThird, double seconds, int sampleRate) {
  std::vector<float> buf(size_t(seconds * sampleRate), 0.0f);
  const double thirdRatio = minorThird ? std::pow(2.0, 3.0 / 12.0) : std::pow(2.0, 4.0 / 12.0);
  const double fifthRatio = std::pow(2.0, 7.0 / 12.0);
  const double freqs[3] = {rootHz, rootHz * thirdRatio, rootHz * fifthRatio};
  for (size_t i = 0; i < buf.size(); ++i) {
    double s = 0.0;
    for (double f : freqs) s += std::sin(2.0 * djn::kPi * f * double(i) / sampleRate);
    buf[i] = float(s / 3.0);
  }
  return buf;
}

}  // namespace

TEST(bpm_detection_finds_a_clean_click_track) {
  const int sr = 44100;
  const auto buf = makeClickTrack(128.0, 12.0, sr);
  const auto r = djn::analyzeTrack(buf.data(), int64_t(buf.size()), 1, sr);
  CHECK(r.bpm > 0.0);
  CHECK_NEAR(r.bpm, 128.0, 2.0);
  CHECK(r.bpm_confidence > 0.2);
}

TEST(bpm_detection_scales_with_tempo) {
  const int sr = 44100;
  const auto slow = djn::analyzeTrack(makeClickTrack(90.0, 12.0, sr).data(), int64_t(12.0 * sr), 1, sr);
  const auto fast = djn::analyzeTrack(makeClickTrack(174.0, 12.0, sr).data(), int64_t(12.0 * sr), 1, sr);
  CHECK_NEAR(slow.bpm, 90.0, 2.0);
  CHECK_NEAR(fast.bpm, 174.0, 2.0);
}

TEST(bpm_detection_survives_a_sustained_chord_under_the_beat) {
  // Regression test: a plain energy-based onset curve (this function's first
  // version) locked onto the chord's own beating pattern instead of the kick
  // -- 128 BPM measured as ~186 BPM -- because a continuous multi-tone bed
  // modulates broadband energy just as much as a drum hit does. Spectral
  // flux (energy appearing in a bin that didn't have it a moment ago) is what
  // fixed it, since a sustained chord doesn't do that but a kick does.
  const int sr = 44100;
  auto buf = makeKickTrack(128.0, 15.0, sr);
  const auto chord = makeChord(261.63, false, 15.0, sr);
  // makeChord() already averages its 3 partials (divides by 3); undo that so
  // the chord here has the same per-partial amplitude (0.05) as the bug repro.
  for (size_t i = 0; i < buf.size(); ++i) buf[i] += 0.15f * chord[i];
  const auto r = djn::analyzeTrack(buf.data(), int64_t(buf.size()), 1, sr);
  CHECK_NEAR(r.bpm, 128.0, 2.0);
}

TEST(bpm_detection_reports_nothing_on_silence) {
  const int sr = 44100;
  std::vector<float> silence(size_t(5 * sr), 0.0f);
  const auto r = djn::analyzeTrack(silence.data(), int64_t(silence.size()), 1, sr);
  CHECK(r.bpm == 0.0);
}

TEST(key_detection_finds_c_major) {
  const int sr = 44100;
  const auto buf = makeChord(261.63 /* C4 */, false, 6.0, sr);  // C major triad
  const auto r = djn::analyzeTrack(buf.data(), int64_t(buf.size()), 1, sr);
  CHECK(r.key_pitch_class == 0);
  CHECK(!r.key_is_minor);
  CHECK(r.key_confidence > 0.5);
}

TEST(key_detection_finds_a_minor) {
  const int sr = 44100;
  const auto buf = makeChord(220.00 /* A3 */, true, 6.0, sr);  // A minor triad
  const auto r = djn::analyzeTrack(buf.data(), int64_t(buf.size()), 1, sr);
  CHECK(r.key_pitch_class == 9);
  CHECK(r.key_is_minor);
}

TEST(key_detection_reports_nothing_on_silence) {
  const int sr = 44100;
  std::vector<float> silence(size_t(5 * sr), 0.0f);
  const auto r = djn::analyzeTrack(silence.data(), int64_t(silence.size()), 1, sr);
  CHECK(r.key_pitch_class == -1);
}

TEST(stereo_input_is_downmixed_before_analysis) {
  const int sr = 44100;
  const auto mono = makeClickTrack(140.0, 10.0, sr);
  std::vector<float> stereo(mono.size() * 2);
  for (size_t i = 0; i < mono.size(); ++i) {
    stereo[2 * i] = mono[i];
    stereo[2 * i + 1] = mono[i];
  }
  const auto r = djn::analyzeTrack(stereo.data(), int64_t(mono.size()), 2, sr);
  CHECK_NEAR(r.bpm, 140.0, 2.0);
}

TEST(camelot_code_matches_the_standard_wheel) {
  CHECK(djn::camelotCode(0, false) == "8B");    // C major
  CHECK(djn::camelotCode(9, true) == "8A");     // A minor (relative of C major)
  CHECK(djn::camelotCode(7, false) == "9B");    // G major
  CHECK(djn::camelotCode(2, true) == "7A");     // D minor (relative of F major, 7B)
  CHECK(djn::camelotCode(-1, false) == "");
  CHECK(djn::camelotCode(12, false) == "");
}
