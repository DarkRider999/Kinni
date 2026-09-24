// Shared helpers for the engine tests: signal generators, offline rendering and
// measurements.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include "djnexus/djnexus.h"

namespace djntest {

constexpr int kRate = 48000;
constexpr int kBlock = 256;
constexpr double kPi = 3.14159265358979323846;

struct EngineHandle {
  djn_engine* e;
  explicit EngineHandle(int decks = 2, int rate = kRate) {
    djn_engine_config cfg{rate, 1024, decks};
    e = djn_engine_create(&cfg);
  }
  ~EngineHandle() { djn_engine_destroy(e); }
  operator djn_engine*() const { return e; }
};

inline std::vector<float> sine(double freq, double seconds, float amp = 0.5f, int rate = kRate) {
  const size_t n = size_t(seconds * rate);
  std::vector<float> s(n * 2);
  for (size_t i = 0; i < n; ++i) {
    const float v = amp * float(std::sin(2 * kPi * freq * double(i) / rate));
    s[2 * i] = s[2 * i + 1] = v;
  }
  return s;
}

// Decaying 2 kHz click on every beat.
inline std::vector<float> clicks(double bpm, double firstBeat, double seconds, int rate = kRate) {
  const size_t n = size_t(seconds * rate);
  std::vector<float> s(n * 2, 0.0f);
  const double spb = 60.0 / bpm;
  for (double t = firstBeat; t < seconds; t += spb) {
    const size_t start = size_t(t * rate);
    for (size_t i = 0; i < size_t(0.03 * rate) && start + i < n; ++i) {
      const float v = 0.6f * float(std::exp(-double(i) / (0.005 * rate)) * std::sin(2 * kPi * 2000 * double(i) / rate));
      s[2 * (start + i)] = s[2 * (start + i) + 1] = v;
    }
  }
  return s;
}

inline int load(djn_engine* e, int deck, const std::vector<float>& pcm, double bpm = 0, double firstBeat = 0,
         int rate = kRate) {
  return djn_deck_load_pcm(e, deck, pcm.data(), int64_t(pcm.size() / 2), 2, rate, bpm, firstBeat);
}

// Renders `seconds` of audio; returns the left channel of the master.
inline std::vector<float> render(djn_engine* e, double seconds, int channels = 2, std::vector<float>* all = nullptr) {
  const int total = int(seconds * kRate);
  std::vector<float> left;
  left.reserve(size_t(total));
  std::vector<float> buf(size_t(kBlock) * channels);
  for (int done = 0; done < total; done += kBlock) {
    const int n = std::min(kBlock, total - done);
    djn_engine_process(e, buf.data(), n, channels);
    for (int i = 0; i < n; ++i) left.push_back(buf[size_t(i * channels)]);
    if (all) all->insert(all->end(), buf.begin(), buf.begin() + n * channels);
  }
  djn_engine_collect_garbage(e);
  return left;
}

inline double rms(const std::vector<float>& x, size_t from = 0, size_t to = 0) {
  if (to == 0 || to > x.size()) to = x.size();
  double s = 0;
  for (size_t i = from; i < to; ++i) s += double(x[i]) * x[i];
  return std::sqrt(s / double(std::max<size_t>(1, to - from)));
}

inline double db(double v) { return 20.0 * std::log10(std::max(v, 1e-12)); }

inline double peak(const std::vector<float>& x, size_t from = 0) {
  double p = 0;
  for (size_t i = from; i < x.size(); ++i) p = std::max(p, double(std::fabs(x[i])));
  return p;
}

// Frequency from interpolated rising zero crossings.
inline double frequency(const std::vector<float>& x, size_t from) {
  double first = -1, last = -1;
  int count = 0;
  for (size_t i = from + 1; i < x.size(); ++i) {
    if (x[i - 1] < 0 && x[i] >= 0) {
      const double t = double(i - 1) + x[i - 1] / (x[i - 1] - x[i]);
      if (first < 0) first = t;
      last = t;
      ++count;
    }
  }
  if (count < 2) return 0;
  return (count - 1) / ((last - first) / kRate);
}

inline djn_deck_state deckState(djn_engine* e, int d) {
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  return s.decks[d];
}

inline double phaseDiff(double a, double b) {
  double d = a - b;
  while (d > 0.5) d -= 1;
  while (d <= -0.5) d += 1;
  return d;
}

}  // namespace djntest

using namespace djntest;
