// Track analysis tests on synthesised music with known tempo, downbeat and key.
#include <cmath>
#include <cstdint>
#include <random>
#include <string>
#include <vector>

#include "djnexus/djnexus.h"
#include "test.h"
#include "test_util.h"

namespace {

double harmonicWave(double cycles);

struct Song {
  double bpm = 128.0;
  double start = 0.37;      // seconds of silence before the first downbeat
  double seconds = 45.0;
  int rate = 44100;
  int tonic = 9;            // pitch class
  bool minor = true;
  double detuneCents = 0.0;
  bool fourOnFloor = true;  // false: hip-hop pattern (kick 1 and 3, snare 2 and 4)
  bool drums = true;
  bool harmony = true;
  double endBpm = 0.0;      // > 0: tempo ramps linearly to this
};

// Stereo interleaved PCM. Beats land at known times; bars change chord and bass,
// every 8th bar has a crash, and bars 8-11 are a breakdown without drums.
std::vector<float> render(const Song& s, std::vector<double>* beatTimes = nullptr) {
  const size_t n = size_t(s.seconds * s.rate);
  std::vector<float> out(n * 2, 0.0f);
  std::mt19937 rng(7);
  std::uniform_real_distribution<float> noise(-1.0f, 1.0f);
  const double ref = 440.0 * std::pow(2.0, s.detuneCents / 1200.0);
  auto hz = [&](int midi) { return ref * std::pow(2.0, (midi - 69) / 12.0); };
  // Scale degrees of each bar's chord: major I-IV-V-I, minor i-VI-VII-i.
  const int majorProg[4] = {0, 5, 7, 0}, minorProg[4] = {0, 8, 10, 0};
  const int majorTriad[3] = {0, 4, 7}, minorTriad[3] = {0, 3, 7};

  auto add = [&](double t0, double dur, auto&& voice) {
    const int64_t a = int64_t(t0 * s.rate), b = std::min<int64_t>(int64_t(n), int64_t((t0 + dur) * s.rate));
    for (int64_t i = std::max<int64_t>(0, a); i < b; ++i) {
      const float v = voice(double(i - a) / s.rate);
      out[size_t(i) * 2] += v;
      out[size_t(i) * 2 + 1] += v;
    }
  };

  double t = s.start;
  for (int beat = 0; t < s.seconds; ++beat) {
    const double frac = t / s.seconds;
    const double bpm = s.endBpm > 0 ? s.bpm + (s.endBpm - s.bpm) * frac : s.bpm;
    const double spb = 60.0 / bpm;
    if (beatTimes) beatTimes->push_back(t);
    const int bar = beat / 4, inBar = beat % 4;
    const bool breakdown = bar >= 8 && bar < 12;
    if (s.drums && !breakdown) {
      const bool kick = s.fourOnFloor || inBar == 0 || inBar == 2;
      if (kick) {
        add(t, 0.25, [&](double x) {
          const double f = 50.0 + 90.0 * std::exp(-x * 30.0);
          return float(0.8 * std::exp(-x * 9.0) * std::sin(2.0 * 3.14159265358979 * f * x));
        });
      }
      if (inBar == 1 || inBar == 3) {  // clap / snare
        add(t, 0.15, [&](double x) { return float(0.25 * std::exp(-x * 25.0) * noise(rng)); });
      }
      // Hats: off-beat (house) or every 8th (hip-hop).
      for (double h : s.fourOnFloor ? std::vector<double>{0.5} : std::vector<double>{0.0, 0.5}) {
        add(t + h * spb, 0.05, [&](double x) {
          static float hp = 0.0f;
          const float w = noise(rng);
          const float y = w - hp;
          hp = w;
          return float(0.08 * std::exp(-x * 60.0)) * y;
        });
      }
      if (inBar == 0 && bar % 8 == 0) {  // crash
        add(t, 1.2, [&](double x) { return float(0.12 * std::exp(-x * 3.0) * noise(rng)); });
      }
    }
    if (s.harmony && inBar == 0) {
      const int degree = (s.minor ? minorProg : majorProg)[bar % 4];
      // Chord quality: tonic chord follows the mode; the others are major (VI, VII / IV, V).
      const int* triad = (degree == 0 && s.minor) ? minorTriad : majorTriad;
      const int root = 48 + (s.tonic + degree) % 12;  // octave 3
      const double dur = 4.0 * spb;
      const double gain = degree == 0 ? 1.0 : 0.8;
      for (int k = 0; k < 3; ++k) {
        const double f = hz(root + triad[k]);
        add(t, dur, [&, f](double x) {
          const double v = harmonicWave(f * x);
          const double env = std::min(1.0, x / 0.05) * std::min(1.0, (dur - x) / 0.05);
          return float(0.05 * gain * env * v);
        });
      }
      // Bass: house on the off-beats, hip-hop (808 style) with the kicks.
      const double fb = hz(root - 12);
      for (int k = 0; k < 4; ++k) {
        if (!s.fourOnFloor && (k == 1 || k == 3)) continue;
        add(t + (k + (s.fourOnFloor ? 0.5 : 0.0)) * spb, spb * 0.45, [&, fb](double x) {
          return float(0.25 * gain * std::min(1.0, x / 0.01) * std::exp(-x * 4.0) * std::sin(2.0 * 3.14159265358979 * fb * x));
        });
      }
    }
    t += spb;
  }
  return out;
}

// One cycle of a tone with 6 harmonics (1/h), looked up by phase in cycles.
double harmonicWave(double cycles) {
  static const std::vector<double> table = [] {
    std::vector<double> t(4096);
    for (size_t i = 0; i < t.size(); ++i) {
      for (int h = 1; h <= 6; ++h) t[i] += std::sin(2.0 * 3.14159265358979 * h * double(i) / double(t.size())) / h;
    }
    return t;
  }();
  const double ph = cycles - std::floor(cycles);
  return table[size_t(ph * double(table.size())) % table.size()];
}

djn_analysis analyze(const std::vector<float>& pcm, int rate, const djn_analysis_options* opt = nullptr) {
  djn_analysis a;
  const int r = djn_analyze_pcm(pcm.data(), int64_t(pcm.size() / 2), 2, rate, opt, &a);
  CHECK(r == DJN_OK);
  return a;
}

double phaseError(double got, double want, double period) {  // seconds, modulo one bar
  double d = std::fmod(got - want, period);
  if (d > period / 2) d -= period;
  if (d < -period / 2) d += period;
  return d;
}

}  // namespace

TEST(analysis_tempo_grid_and_downbeat) {
  for (double bpm : {120.0, 124.0, 126.5, 128.0, 140.0, 150.0, 174.0}) {
    Song s;
    s.bpm = bpm;
    const djn_analysis a = analyze(render(s), s.rate);
    const double bar = 4 * 60.0 / bpm;
    const double err = phaseError(a.first_beat_sec, s.start, bar);
    if (std::fabs(a.bpm - bpm) > 0.01 || std::fabs(err) > 0.006 || !a.tempo_stable) {
      std::printf("    bpm %.1f -> %.3f, downbeat error %.1f ms, stable %d\n", bpm, a.bpm, err * 1000, a.tempo_stable);
    }
    CHECK_NEAR(a.bpm, bpm, 0.01);
    CHECK(std::fabs(err) < 0.006);  // the downbeat, not just a beat
    CHECK(a.first_beat_sec >= 0.0 && a.first_beat_sec < bar);
    CHECK(a.tempo_stable == 1);
    CHECK(a.bpm_confidence > 0.3);
  }
}

TEST(analysis_tempo_other_rates_and_hip_hop) {
  Song s;
  s.bpm = 128.0;
  s.rate = 48000;
  djn_analysis a = analyze(render(s), s.rate);
  CHECK_NEAR(a.bpm, 128.0, 0.01);
  // Hip-hop: kick 1 and 3, 8th-note hats. 90 BPM, not 180.
  Song h;
  h.bpm = 90.0;
  h.fourOnFloor = false;
  a = analyze(render(h), h.rate);
  CHECK_NEAR(a.bpm, 90.0, 0.01);
  // The range folds the result: the same track read in 100-200 is 180.
  djn_analysis_options o;
  djn_analysis_default_options(&o);
  o.min_bpm = 100;
  o.max_bpm = 200;
  o.flags = DJN_ANALYZE_TEMPO;
  a = analyze(render(h), h.rate, &o);
  CHECK_NEAR(a.bpm, 180.0, 0.02);
  CHECK(a.key == -1);  // key not requested
}

TEST(analysis_tempo_drift_is_flagged) {
  Song s;
  s.bpm = 120.0;
  s.endBpm = 126.0;  // like a live band speeding up
  const djn_analysis a = analyze(render(s), s.rate);
  CHECK(a.tempo_stable == 0);
  CHECK(a.bpm > 119.0 && a.bpm < 127.0);
}

TEST(analysis_no_beat_no_key) {
  // White noise: no tempo worth trusting and no key.
  std::vector<float> pcm(size_t(44100 * 30) * 2);
  std::mt19937 rng(3);
  std::uniform_real_distribution<float> d(-0.3f, 0.3f);
  for (auto& v : pcm) v = d(rng);
  djn_analysis a = analyze(pcm, 44100);
  CHECK(a.key == -1);
  CHECK(a.key_name[0] == '\0');
  CHECK(a.bpm_confidence < 0.3);
  // Too short to analyse.
  std::vector<float> tiny(size_t(44100 * 3) * 2, 0.0f);
  a = analyze(tiny, 44100);
  CHECK(a.bpm == 0.0);
  CHECK(a.key == -1);
  djn_analysis bad;
  CHECK(djn_analyze_pcm(nullptr, 10, 2, 44100, nullptr, &bad) == DJN_ERR_INVALID_ARG);
  CHECK(djn_analyze_file("/no/such/file.wav", nullptr, &bad) != DJN_OK);
}

TEST(analysis_key_all_24) {
  int wrong = 0;
  for (int key = 0; key < 24; ++key) {
    Song s;
    s.tonic = key % 12;
    s.minor = key >= 12;
    s.seconds = 24.0;
    s.rate = 22050;
    djn_analysis_options o;
    djn_analysis_default_options(&o);
    o.flags = DJN_ANALYZE_KEY;
    const djn_analysis a = analyze(render(s), s.rate, &o);
    if (a.key != key) {
      std::printf("    key %d detected as %d (%s)\n", key, a.key, a.key_name);
      ++wrong;
    }
    CHECK(std::fabs(a.tuning_cents) < 6.0);
    CHECK(a.bpm == 0.0);  // tempo not requested
  }
  CHECK(wrong == 0);
}

TEST(analysis_key_with_detuning_and_names) {
  Song s;
  s.tonic = 9;  // A minor, tuned 30 cents sharp
  s.minor = true;
  s.detuneCents = 30.0;
  s.seconds = 45.0;
  const djn_analysis a = analyze(render(s), s.rate);
  CHECK(a.key == 12 + 9);
  CHECK_NEAR(a.tuning_cents, 30.0, 6.0);
  CHECK(std::string(a.key_name) == "A minor");
  CHECK(std::string(a.camelot) == "8A");
  CHECK(std::string(a.open_key) == "1m");
  CHECK(a.key_confidence > 0.0);
  CHECK_NEAR(a.bpm, 128.0, 0.01);  // tempo in the same pass

  // Camelot and Open Key wheels.
  Song c;
  c.seconds = 24.0;
  c.rate = 22050;
  djn_analysis_options o;
  djn_analysis_default_options(&o);
  o.flags = DJN_ANALYZE_KEY;
  const struct { int tonic; bool minor; const char *name, *cam, *open; } cases[] = {
      {0, false, "C major", "8B", "1d"},  {7, false, "G major", "9B", "2d"},   {5, false, "F major", "7B", "12d"},
      {6, false, "F# major", "2B", "7d"}, {1, false, "Db major", "3B", "8d"},  {4, true, "E minor", "9A", "2m"},
      {0, true, "C minor", "5A", "10m"},  {8, true, "G# minor", "1A", "6m"},   {3, true, "Eb minor", "2A", "7m"},
  };
  for (const auto& k : cases) {
    c.tonic = k.tonic;
    c.minor = k.minor;
    const djn_analysis r = analyze(render(c), c.rate, &o);
    CHECK(std::string(r.key_name) == k.name);
    CHECK(std::string(r.camelot) == k.cam);
    CHECK(std::string(r.open_key) == k.open);
  }
}
