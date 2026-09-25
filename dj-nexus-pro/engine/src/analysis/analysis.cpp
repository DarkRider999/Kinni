#include "analysis.h"

#include <algorithm>
#include <cmath>
#include <complex>
#include <numeric>

#include "fft.h"
#include "track.h"  // resampleChannel

namespace djn {
namespace analysis {

namespace {

constexpr double kPi = 3.14159265358979323846;

// ---------------------------------------------------------------- helpers

std::vector<float> hann(int n) {
  std::vector<float> w(static_cast<size_t>(n));
  for (int i = 0; i < n; ++i) w[size_t(i)] = float(0.5 - 0.5 * std::cos(2.0 * kPi * i / n));
  return w;
}

float at(const std::vector<float>& v, double t) {  // linear interpolation, 0 outside
  if (t < 0.0) return 0.0f;
  const size_t i = size_t(t);
  if (i + 1 >= v.size()) return i < v.size() ? v[i] : 0.0f;
  const float f = float(t - double(i));
  return v[i] * (1.0f - f) + v[i + 1] * f;
}

// Plain second-order low-pass (RBJ), for the fine kick envelope.
struct LowPass {
  double b0, b1, b2, a1, a2, z1 = 0.0, z2 = 0.0;
  LowPass(double fc, double rate) {
    const double w = 2.0 * kPi * fc / rate, c = std::cos(w), s = std::sin(w), alpha = s / (2.0 * 0.7071);
    const double a0 = 1.0 + alpha;
    b0 = (1.0 - c) / 2.0 / a0;
    b1 = (1.0 - c) / a0;
    b2 = b0;
    a1 = -2.0 * c / a0;
    a2 = (1.0 - alpha) / a0;
  }
  double tick(double x) {  // transposed direct form II
    const double y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    return y;
  }
};

// ---------------------------------------------------------------- onsets

constexpr int kOnsetFft = 512;
constexpr int kOnsetHop = 128;
constexpr int kBands = 8;

struct Onsets {
  double fps = 0.0;
  std::vector<float> onset;                  // combined, mean-removed, rectified
  std::vector<float> lowOnset;               // kick band only, same treatment
  std::vector<std::array<float, kBands>> bands;  // log band energy per frame (for downbeats)
};

Onsets computeOnsets(const std::vector<float>& x, double rate) {
  Onsets o;
  o.fps = rate / kOnsetHop;
  if (x.size() < size_t(kOnsetFft)) return o;
  const size_t frames = 1 + (x.size() - size_t(kOnsetFft)) / size_t(kOnsetHop);
  const int bins = kOnsetFft / 2;
  const double binHz = rate / kOnsetFft;
  const int lowMax = std::max(1, int(160.0 / binHz));  // kick / bass band
  // Band edges for the downbeat features (log spaced, 40 Hz .. 5 kHz).
  std::array<int, kBands + 1> edge{};
  for (int b = 0; b <= kBands; ++b) edge[size_t(b)] = std::min(bins, std::max(1, int(40.0 * std::pow(125.0, b / double(kBands)) / binHz)));

  Fft fft(kOnsetFft);
  const std::vector<float> win = hann(kOnsetFft);
  std::vector<float> fa(static_cast<size_t>(kOnsetFft)), fb(static_cast<size_t>(kOnsetFft)), ma(static_cast<size_t>(bins + 1)), mb(static_cast<size_t>(bins + 1));
  std::vector<float> prevLog(static_cast<size_t>(bins + 1), 0.0f), curLog(static_cast<size_t>(bins + 1));
  std::vector<std::complex<float>> work;
  std::vector<float> full(frames, 0.0f), low(frames, 0.0f);
  o.bands.assign(frames, {});
  const float norm = 4.0f / kOnsetFft;  // a full-scale sine peaks near 1

  auto consume = [&](size_t t, const std::vector<float>& mag) {
    float sFull = 0.0f, sLow = 0.0f;
    for (int k = 1; k <= bins; ++k) {
      curLog[size_t(k)] = std::log1p(100.0f * mag[size_t(k)] * norm);
      const float d = curLog[size_t(k)] - prevLog[size_t(k)];
      if (d > 0.0f) {
        sFull += d;
        if (k <= lowMax) sLow += d;
      }
    }
    for (int b = 0; b < kBands; ++b) {
      float e = 0.0f;
      for (int k = edge[size_t(b)]; k < std::max(edge[size_t(b)] + 1, edge[size_t(b + 1)]); ++k) e += mag[size_t(k)] * mag[size_t(k)];
      o.bands[t][size_t(b)] = std::log1p(1000.0f * e * norm * norm);
    }
    full[t] = t ? sFull : 0.0f;
    low[t] = t ? sLow : 0.0f;
    std::swap(prevLog, curLog);
  };

  for (size_t t = 0; t < frames; t += 2) {
    const bool pair = t + 1 < frames;
    const float* xa = x.data() + t * kOnsetHop;
    for (int i = 0; i < kOnsetFft; ++i) fa[size_t(i)] = xa[i] * win[size_t(i)];
    if (pair) {
      const float* xb = xa + kOnsetHop;
      for (int i = 0; i < kOnsetFft; ++i) fb[size_t(i)] = xb[i] * win[size_t(i)];
    }
    fft.magnitudes2(fa.data(), pair ? fb.data() : nullptr, ma.data(), pair ? mb.data() : nullptr, work);
    consume(t, ma);
    if (pair) consume(t + 1, mb);
  }

  // Combine: kicks count as much as everything else together.
  const double mFull = std::accumulate(full.begin(), full.end(), 0.0) / double(frames) + 1e-9;
  const double mLow = std::accumulate(low.begin(), low.end(), 0.0) / double(frames) + 1e-9;
  std::vector<float> comb(frames);
  for (size_t t = 0; t < frames; ++t) comb[t] = float(full[t] / mFull + low[t] / mLow);
  std::vector<float> lowOnly(frames);
  for (size_t t = 0; t < frames; ++t) lowOnly[t] = float(low[t] / mLow);
  // Remove the local mean (1 s) and keep the rises.
  const int half = int(o.fps * 0.5);
  auto detrend = [&](const std::vector<float>& in, std::vector<float>& outv) {
    outv.assign(frames, 0.0f);
    double run = 0.0;
    int count = 0;
    size_t lo = 0, hi = 0;
    for (size_t t = 0; t < frames; ++t) {
      const size_t wantHi = std::min(frames, t + size_t(half) + 1), wantLo = t > size_t(half) ? t - size_t(half) : 0;
      while (hi < wantHi) run += in[hi++], ++count;
      while (lo < wantLo) run -= in[lo++], --count;
      outv[t] = std::max(0.0f, in[t] - float(run / std::max(1, count)));
    }
  };
  detrend(comb, o.onset);
  detrend(lowOnly, o.lowOnset);
  return o;
}

// ---------------------------------------------------------------- tempo

// Mean onset strength on a grid with this period and phase (frames).
double combAt(const std::vector<float>& o, double period, double phase) {
  double s = 0.0;
  int n = 0;
  for (double t = phase; t < double(o.size()) - 1.0; t += period) {
    s += at(o, t);
    ++n;
  }
  return n ? s / n : 0.0;
}

struct Comb {
  double score = -1.0, phase = 0.0, mean = 0.0;
};

Comb bestPhase(const std::vector<float>& o, double period, double step) {
  Comb c;
  double sum = 0.0;
  int n = 0;
  for (double ph = 0.0; ph < period; ph += step) {
    const double s = combAt(o, period, ph);
    sum += s;
    ++n;
    if (s > c.score) {
      c.score = s;
      c.phase = ph;
    }
  }
  c.mean = n ? sum / n : 0.0;
  return c;
}

// Tempo salience from the onset autocorrelation, summed over the beat, bar
// and two-bar lags, so the true pulse beats its double and half.
double salience(const std::vector<double>& acf, double lagStep, double lag) {
  auto a = [&](double l) {
    const double i = l / lagStep;
    const size_t k = size_t(i);
    if (k + 1 >= acf.size()) return 0.0;
    const double f = i - double(k);
    return acf[k] * (1.0 - f) + acf[k + 1] * f;
  };
  return a(lag) + 0.5 * a(2.0 * lag) + 0.25 * a(4.0 * lag);
}

// Fine kick envelope at 1 kHz: low-passed energy and its 5 ms rise, for
// placing the grid to within a few milliseconds.
std::vector<float> kickRise(const std::vector<float>& x, double rate, bool lowOnly) {
  LowPass a(150.0, rate), b(150.0, rate);
  const double env = 1.0 - std::exp(-1.0 / (0.004 * rate));
  const double step = rate / 1000.0;
  std::vector<float> e;
  e.reserve(size_t(double(x.size()) / step) + 1);
  double level = 0.0, next = 0.0;
  for (size_t i = 0; i < x.size(); ++i) {
    const double v = lowOnly ? b.tick(a.tick(x[i])) : x[i];
    level += env * (v * v - level);
    if (double(i) >= next) {
      e.push_back(float(level));
      next += step;
    }
  }
  std::vector<float> r(e.size(), 0.0f);
  for (size_t k = 5; k < e.size(); ++k) r[k] = std::max(0.0f, e[k] - e[k - 5]);
  return r;
}

}  // namespace

std::vector<float> monoAt(const float* interleaved, int64_t frames, int channels, int sourceRate, double rate) {
  std::vector<float> mono(static_cast<size_t>(std::max<int64_t>(0, frames)));
  if (frames <= 0 || channels <= 0 || sourceRate <= 0) return {};
  const float g = 1.0f / float(channels);
  for (int64_t i = 0; i < frames; ++i) {
    float s = 0.0f;
    for (int c = 0; c < channels; ++c) s += interleaved[i * channels + c];
    mono[size_t(i)] = s * g;
  }
  const double ratio = rate / sourceRate;
  const int64_t outFrames = int64_t(double(frames) * ratio);
  std::vector<float> out(static_cast<size_t>(std::max<int64_t>(0, outFrames)));
  if (outFrames > 0) resampleChannel(mono.data(), frames, ratio, out.data(), outFrames);
  return out;
}

TempoResult analyzeTempo(const std::vector<float>& x, double rate, const Options& opt) {
  TempoResult r;
  const Onsets on = computeOnsets(x, rate);
  const std::vector<float>& o = on.onset;
  const double fps = on.fps;
  if (o.size() < size_t(fps * 8.0)) return r;  // under 8 s: not enough to be sure
  const double minBpm = std::max(30.0, std::min(opt.minBpm, opt.maxBpm - 1.0));
  const double maxBpm = std::min(300.0, std::max(opt.maxBpm, minBpm + 1.0));

  // 1. Autocorrelation over the lags of 30-300 BPM (and 4x longer, for salience).
  const double lagStep = 0.25;
  const double maxLag = 4.0 * fps * 60.0 / 30.0;
  std::vector<double> acf(static_cast<size_t>(maxLag / lagStep) + 2, 0.0);
  std::vector<double> whole(static_cast<size_t>(maxLag) + 3, 0.0);
  for (size_t l = 0; l < whole.size(); ++l) {
    double s = 0.0;
    for (size_t t = 0; t + l < o.size(); ++t) s += double(o[t]) * o[t + l];
    whole[l] = l < o.size() ? s / double(o.size() - l) : 0.0;
  }
  for (size_t i = 0; i < acf.size(); ++i) {
    const double lag = double(i) * lagStep;
    const size_t k = size_t(lag);
    const double f = lag - double(k);
    acf[i] = k + 1 < whole.size() ? whole[k] * (1.0 - f) + whole[k + 1] * f : 0.0;
  }

  // 2. Best tempo in range: salience times a broad prior around 125 BPM.
  double best = -1.0, bestBpm = 0.0;
  for (double bpm = minBpm; bpm <= maxBpm; bpm += 0.1) {
    const double lag = fps * 60.0 / bpm;
    const double prior = std::exp(-0.5 * std::pow(std::log2(bpm / 125.0) / 0.9, 2.0));
    const double s = salience(acf, lagStep, lag) * prior;
    if (s > best) {
      best = s;
      bestBpm = bpm;
    }
  }
  if (!(best > 0.0)) return r;

  // Double or half? Compare onsets between the slower grid's beats with those
  // on them: kicks there too (four-to-the-floor at 174) mean the faster tempo;
  // only hats or nothing (hip-hop at 90) mean the slower one.
  {
    double slow = 0.0;
    if (bestBpm / 2.0 >= minBpm) slow = bestBpm / 2.0;
    else if (bestBpm * 2.0 <= maxBpm) slow = bestBpm;
    if (slow > 0.0) {
      const double p = fps * 60.0 / slow;
      const Comb all = bestPhase(o, p, 0.5);
      const Comb kick = bestPhase(on.lowOnset, p, 0.5);
      // Kick band when there is a kick, else everything.
      const bool useKick = kick.score > 2.0 * kick.mean;
      const std::vector<float>& sig = useKick ? on.lowOnset : o;
      const Comb& on1 = useKick ? kick : all;
      const double mid = combAt(sig, p, std::fmod(on1.phase + p / 2.0, p));
      const double ratio = on1.score > 0.0 ? mid / on1.score : 0.0;
      bestBpm = ratio >= (useKick ? 0.7 : 0.8) ? slow * 2.0 : slow;
    }
  }

  // 3. Refine against the whole track: the grid that lines up with the most onsets.
  auto refine = [&](double centre, double span, double step, double phaseStep, double& outBpm, Comb& outComb) {
    for (double bpm = centre - span; bpm <= centre + span + 1e-9; bpm += step) {
      const Comb c = bestPhase(o, fps * 60.0 / bpm, phaseStep);
      if (c.score > outComb.score) {
        outComb = c;
        outBpm = bpm;
      }
    }
  };
  double fine = bestBpm;
  Comb comb;
  refine(bestBpm, bestBpm * 0.015, 0.05, 0.5, fine, comb);
  const double coarse = fine;
  comb = Comb();
  refine(coarse, 0.06, 0.005, 0.25, fine, comb);
  // Most tracks are made at whole or half BPMs: prefer them when they fit as
  // well, or when the difference moves the grid by under 8 ms over the whole
  // track (finer than the audio can tell apart).
  const double seconds = double(o.size()) / fps;
  for (const double cand : {std::round(fine), std::round(fine * 2.0) / 2.0}) {
    const Comb c = bestPhase(o, fps * 60.0 / cand, 0.25);
    const bool unnoticeable = std::fabs(cand - fine) / fine * seconds < 0.008;
    if (c.score >= comb.score * (unnoticeable ? 0.97 : 0.997)) {
      comb = c;
      fine = cand;
      break;
    }
  }
  const double periodFrames = fps * 60.0 / fine;

  // 4. Stability: with the global period, does each 32-beat stretch keep its phase?
  const int segBeats = 32;
  const double segLen = periodFrames * segBeats;
  double wSum = 0.0, dev2 = 0.0;
  for (double s0 = 0.0; s0 + segLen <= double(o.size()); s0 += segLen) {
    std::vector<float> seg(o.begin() + std::ptrdiff_t(s0), o.begin() + std::ptrdiff_t(s0 + segLen));
    const Comb c = bestPhase(seg, periodFrames, 0.25);
    const double w = std::max(0.0, c.score - c.mean);
    if (w <= 0.0) continue;
    double d = std::fmod(s0 + c.phase - comb.phase, periodFrames);
    if (d > periodFrames / 2) d -= periodFrames;
    if (d < -periodFrames / 2) d += periodFrames;
    dev2 += w * d * d;
    wSum += w;
  }
  const double rmsDevSec = wSum > 0.0 ? std::sqrt(dev2 / wSum) / fps : 0.0;
  r.stable = rmsDevSec < 0.025;

  // 5. Phase to the millisecond from the kick envelope (or the full band when
  //    there is no kick), corrected for the envelope's rise time.
  const double periodMs = 60000.0 / fine;
  // An onset frame's time is its window centre.
  const double frameCentreMs = kOnsetFft / 2.0 / rate * 1000.0;
  double phaseMs = comb.phase / fps * 1000.0 + frameCentreMs;
  for (const bool lowOnly : {true, false}) {
    const std::vector<float> rise = kickRise(x, rate, lowOnly);
    Comb k = bestPhase(rise, periodMs, 1.0);
    if (k.score > k.mean * 1.5) {
      // Keep it only if it agrees with the coarse phase (within 25 ms).
      double d = std::fmod(k.phase - phaseMs, periodMs);
      if (d > periodMs / 2) d -= periodMs;
      if (d < -periodMs / 2) d += periodMs;
      if (std::fabs(d) < 25.0) {
        phaseMs = k.phase - (lowOnly ? 3.0 : 2.0);
        break;
      }
    }
  }
  const double period = periodMs / 1000.0;
  double phase = std::fmod(phaseMs / 1000.0, period);
  if (phase < 0.0) phase += period;

  // 6. Downbeat: bars start where the sound changes most (new parts, chord and
  //    bass changes, crashes). Score each of the 4 beat positions.
  std::array<double, 4> score{}, count{};
  std::array<float, kBands> prev{};
  bool havePrev = false;
  for (int j = 0;; ++j) {
    const double t0 = (phase + j * period) * fps, t1 = t0 + periodFrames;
    if (t1 >= double(on.bands.size())) break;
    std::array<float, kBands> f{};
    int n = 0;
    for (size_t t = size_t(t0); t < size_t(t1); ++t, ++n) {
      for (int b = 0; b < kBands; ++b) f[size_t(b)] += on.bands[t][size_t(b)];
    }
    for (auto& v : f) v /= float(std::max(1, n));
    if (havePrev) {
      double nov = 0.0;
      for (int b = 0; b < kBands; ++b) nov += std::fabs(f[size_t(b)] - prev[size_t(b)]);
      score[size_t(j % 4)] += nov * nov;
      count[size_t(j % 4)] += 1.0;
    }
    prev = f;
    havePrev = true;
  }
  int bestOff = 0;
  double bestS = -1.0, secondS = -1.0;
  for (int k = 0; k < 4; ++k) {
    const double s = count[size_t(k)] > 0 ? score[size_t(k)] / count[size_t(k)] : 0.0;
    if (s > bestS) {
      secondS = bestS;
      bestS = s;
      bestOff = k;
    } else if (s > secondS) {
      secondS = s;
    }
  }
  r.downbeatConfidence = bestS > 0.0 ? std::min(1.0, std::max(0.0, (bestS - secondS) / bestS) * 2.0) : 0.0;

  r.bpm = std::round(fine * 1000.0) / 1000.0;
  r.firstBeat = std::fmod(phase + bestOff * period, 4.0 * period);
  // Confidence: how far the grid's onsets stand above the average phase.
  const double peak = comb.mean > 0.0 ? comb.score / comb.mean : 0.0;
  r.confidence = std::min(1.0, std::max(0.0, (peak - 1.4) / 1.6)) * (r.stable ? 1.0 : 0.5);
  return r;
}

// ---------------------------------------------------------------- key

namespace {

constexpr int kKeyFft = 4096;
constexpr int kKeyHop = 1024;
constexpr int kMedian = 17;  // frames (~3 s) for the harmonic (time-median) filter
constexpr int kLowPitch = 36, kHighPitch = 96;  // C2 .. C7
constexpr int kSub = 10;                        // 10-cent pitch histogram

// Key profiles: Krumhansl-Kessler and Temperley, averaged after normalising.
constexpr double kKKMajor[12] = {6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88};
constexpr double kKKMinor[12] = {6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17};
constexpr double kTMajor[12] = {0.748, 0.060, 0.488, 0.082, 0.670, 0.460, 0.096, 0.715, 0.104, 0.366, 0.057, 0.400};
constexpr double kTMinor[12] = {0.712, 0.084, 0.474, 0.618, 0.049, 0.460, 0.105, 0.747, 0.404, 0.067, 0.133, 0.330};

double pearson(const double* a, const double* b, int n) {
  double ma = 0.0, mb = 0.0;
  for (int i = 0; i < n; ++i) ma += a[i], mb += b[i];
  ma /= n;
  mb /= n;
  double sab = 0.0, saa = 0.0, sbb = 0.0;
  for (int i = 0; i < n; ++i) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) * (a[i] - ma);
    sbb += (b[i] - mb) * (b[i] - mb);
  }
  return saa > 0.0 && sbb > 0.0 ? sab / std::sqrt(saa * sbb) : 0.0;
}

}  // namespace

KeyResult analyzeKey(const std::vector<float>& x, double rate) {
  KeyResult r;
  if (x.size() < size_t(kKeyFft) + size_t(kKeyHop) * kMedian) return r;
  const size_t frames = 1 + (x.size() - size_t(kKeyFft)) / size_t(kKeyHop);
  const double binHz = rate / kKeyFft;
  const int kLo = std::max(1, int(440.0 * std::pow(2.0, (kLowPitch - 0.5 - 69) / 12.0) / binHz));
  const int kHi = std::min(kKeyFft / 2, int(440.0 * std::pow(2.0, (kHighPitch + 0.5 - 69) / 12.0) / binHz) + 1);
  const int nb = kHi - kLo + 1;
  const int slots = (kHighPitch - kLowPitch) * kSub + 1;
  std::vector<double> hist(static_cast<size_t>(slots), 0.0);
  double peakEnergy = 0.0, allEnergy = 0.0;  // how tonal the track is

  // Spectra in a ring; each frame is replaced by the median of the 17 around
  // it, bin by bin, which keeps sustained notes and drops drum hits.
  Fft fft(kKeyFft);
  const std::vector<float> win = hann(kKeyFft);
  std::vector<std::vector<float>> ring(static_cast<size_t>(kMedian), std::vector<float>(static_cast<size_t>(nb)));
  std::vector<float> fa(static_cast<size_t>(kKeyFft)), fb(static_cast<size_t>(kKeyFft)), ma(static_cast<size_t>(kKeyFft / 2 + 1)), mb(static_cast<size_t>(kKeyFft / 2 + 1));
  std::vector<std::complex<float>> work;
  std::array<float, kMedian> column{};
  std::vector<float> med(static_cast<size_t>(nb)), floorLevel(static_cast<size_t>(nb));
  const int floorHalf = std::max(4, int(25.0 / binHz));  // +-25 Hz noise-floor window
  auto push = [&](size_t t, const std::vector<float>& mag) {
    std::vector<float>& dst = ring[t % size_t(kMedian)];
    std::copy(mag.begin() + kLo, mag.begin() + kHi + 1, dst.begin());
    if (t + 1 < size_t(kMedian)) return;
    for (int k = 0; k < nb; ++k) {
      for (int m = 0; m < kMedian; ++m) column[size_t(m)] = ring[size_t(m)][size_t(k)];
      std::nth_element(column.begin(), column.begin() + kMedian / 2, column.end());
      med[size_t(k)] = column[size_t(kMedian / 2)];
      allEnergy += med[size_t(k)];
    }
    // Noise floor: running mean across frequency.
    double run = 0.0;
    int lo = 0, hi = 0, cnt = 0;
    for (int k = 0; k < nb; ++k) {
      while (hi < std::min(nb, k + floorHalf + 1)) run += med[size_t(hi++)], ++cnt;
      while (lo < k - floorHalf) run -= med[size_t(lo++)], --cnt;
      floorLevel[size_t(k)] = float(run / std::max(1, cnt));
    }
    // Only spectral peaks well above the floor count (the drums' noise doesn't),
    // placed between bins by parabolic interpolation.
    for (int k = 1; k + 1 < nb; ++k) {
      const float c = med[size_t(k)];
      if (!(c > med[size_t(k - 1)] && c >= med[size_t(k + 1)] && c > 2.0f * floorLevel[size_t(k)])) continue;
      const double a = std::log(med[size_t(k - 1)] + 1e-12), b = std::log(c + 1e-12), g = std::log(med[size_t(k + 1)] + 1e-12);
      const double den = a - 2.0 * b + g;
      const double off = den < 0.0 ? std::max(-0.5, std::min(0.5, 0.5 * (a - g) / den)) : 0.0;
      const double f = (kLo + k + off) * binHz;
      const double p = 69.0 + 12.0 * std::log2(f / 440.0);
      const int sl = int(std::lround((p - kLowPitch) * kSub));
      if (sl >= 0 && sl < slots) hist[size_t(sl)] += c - floorLevel[size_t(k)];
      peakEnergy += c - floorLevel[size_t(k)];
    }
  };
  for (size_t t = 0; t < frames; t += 2) {
    const bool pair = t + 1 < frames;
    const float* xa = x.data() + t * kKeyHop;
    for (int i = 0; i < kKeyFft; ++i) fa[size_t(i)] = xa[i] * win[size_t(i)];
    if (pair) {
      for (int i = 0; i < kKeyFft; ++i) fb[size_t(i)] = xa[i + kKeyHop] * win[size_t(i)];
    }
    fft.magnitudes2(fa.data(), pair ? fb.data() : nullptr, ma.data(), pair ? mb.data() : nullptr, work);
    push(t, ma);
    if (pair) push(t + 1, mb);
  }

  // Tuning: where, within a semitone, the energy sits (circular mean over the
  // 10-cent slots, weighted towards the peaks).
  double sx = 0.0, sy = 0.0;
  for (int i = 0; i < slots; ++i) {
    const double w = hist[size_t(i)] * hist[size_t(i)];
    const double a = 2.0 * kPi * (i % kSub) / kSub;
    sx += w * std::cos(a);
    sy += w * std::sin(a);
  }
  r.tuningCents = (sx != 0.0 || sy != 0.0) ? std::atan2(sy, sx) / (2.0 * kPi) * 100.0 : 0.0;

  // Chroma (tuned), plus a bass chroma below A3 for the tonic.
  std::array<double, 12> chroma{}, bass{};
  for (int i = 0; i < slots; ++i) {
    const double p = kLowPitch + double(i) / kSub - r.tuningCents / 100.0;
    const double q = std::round(p);
    const double w = std::max(0.0, 1.0 - 2.0 * std::fabs(p - q));
    const int pc = ((int(q) % 12) + 12) % 12;
    chroma[size_t(pc)] += w * hist[size_t(i)];
    if (q < 57) bass[size_t(pc)] += w * hist[size_t(i)];
  }
  const double total = std::accumulate(chroma.begin(), chroma.end(), 0.0);
  if (!(total > 0.0)) return r;
  for (int i = 0; i < 12; ++i) r.chroma[size_t(i)] = chroma[size_t(i)] / total;
  double geo = 0.0;
  for (double v : r.chroma) geo += std::log(std::max(v, 1e-9));
  // No key when almost nothing is tonal (noise, drums only) or the pitch
  // classes are evenly spread.
  if (peakEnergy < 0.004 * allEnergy || std::exp(geo / 12.0) / (1.0 / 12.0) > 0.92) return r;

  const double bassMax = *std::max_element(bass.begin(), bass.end());
  double best = -2.0, second = -2.0;
  for (int key = 0; key < 24; ++key) {
    const int tonic = key % 12;
    const bool minor = key >= 12;
    double rot[12];
    for (int i = 0; i < 12; ++i) rot[i] = r.chroma[size_t((i + tonic) % 12)];
    const double s = 0.5 * pearson(rot, minor ? kKKMinor : kKKMajor, 12) + 0.5 * pearson(rot, minor ? kTMinor : kTMajor, 12) +
                     (bassMax > 0.0 ? 0.12 * bass[size_t(tonic)] / bassMax : 0.0);
    if (s > best) {
      second = best;
      best = s;
      r.key = key;
    } else if (s > second) {
      second = s;
    }
  }
  r.confidence = std::min(1.0, std::max(0.0, (best - second) * 5.0));
  return r;
}

// ---------------------------------------------------------------- names

namespace {
const char* const kMajorNames[12] = {"C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"};
const char* const kMinorNames[12] = {"C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"};

int fifths(int pc) { return (pc * 7) % 12; }  // position on the circle of fifths from C
}  // namespace

std::string keyName(int key) {
  if (key < 0 || key > 23) return "";
  return key < 12 ? std::string(kMajorNames[key]) + " major" : std::string(kMinorNames[key - 12]) + " minor";
}

std::string camelot(int key) {
  if (key < 0 || key > 23) return "";
  const int major = key < 12 ? key : (key - 12 + 3) % 12;  // minor keys share their relative major's number
  return std::to_string((fifths(major) + 7) % 12 + 1) + (key < 12 ? "B" : "A");
}

std::string openKey(int key) {
  if (key < 0 || key > 23) return "";
  const int major = key < 12 ? key : (key - 12 + 3) % 12;
  return std::to_string(fifths(major) + 1) + (key < 12 ? "d" : "m");
}

}  // namespace analysis
}  // namespace djn
