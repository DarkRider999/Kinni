#include "separator.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <complex>
#include <vector>

#include "../analysis/fft.h"
#include "djnexus/djnexus.h"

namespace djn {
namespace stems {

namespace {

using cfloat = std::complex<float>;
constexpr double kPi = 3.14159265358979323846;

// Smooth 0..1 step between f0 and f1 Hz (raised cosine).
float ramp(double f, double f0, double f1) {
  if (f <= f0) return 0.0f;
  if (f >= f1) return 1.0f;
  return float(0.5 - 0.5 * std::cos(kPi * (f - f0) / (f1 - f0)));
}

// Where an output channel goes: every `stride`-th float from `p` (interleaved
// output), or nowhere when p is null (the right channel of mono output).
struct Out {
  float* p = nullptr;
  int stride = 1;
};

struct Bin {
  cfloat l, r;   // spectra of the two channels
  float harm;    // time-median magnitude (sustained)
  float perc;    // frequency-median magnitude (transient)
  double hz;
};

// One streaming STFT pass over planar stereo input. For each frame the time
// median (over `medT` frames) and the frequency median (over `medF` bins) of
// the magnitude are taken; `gains(bin, outGains)` sets a gain per output and
// the gained spectra are overlap-added into the outputs. Memory stays at a
// few frames, whatever the track length.
template <int kOuts, class GainFn>
bool pass(const float* xl, const float* xr, int64_t n, int N, int hop, int medT, int medF, double rate,
          std::array<Out, kOuts> outL, std::array<Out, kOuts> outR, GainFn gains,
          const std::function<bool(float)>& progress, float p0, float p1) {
  analysis::Fft fft(N);
  const int bins = N / 2 + 1;
  // Hann analysis x Hann synthesis sums to N/hop * 3/8 at 75% overlap; at 50%
  // overlap the square-root Hann pair sums to exactly 1.
  const bool half = hop * 2 == N;
  std::vector<float> win(static_cast<size_t>(N));
  for (int i = 0; i < N; ++i) {
    const double h = 0.5 - 0.5 * std::cos(2.0 * kPi * i / N);
    win[size_t(i)] = float(half ? std::sqrt(h) : h);
  }
  const float norm = half ? 1.0f : 1.0f / (float(N) / float(hop) * 0.375f);

  // Ring of recent frames: spectra and magnitudes.
  std::vector<std::vector<cfloat>> ringL(static_cast<size_t>(medT), std::vector<cfloat>(static_cast<size_t>(bins)));
  std::vector<std::vector<cfloat>> ringR(static_cast<size_t>(medT), std::vector<cfloat>(static_cast<size_t>(bins)));
  std::vector<std::vector<float>> ringM(static_cast<size_t>(medT), std::vector<float>(static_cast<size_t>(bins)));
  std::vector<cfloat> work(static_cast<size_t>(N)), inv(static_cast<size_t>(N));
  std::vector<float> column(static_cast<size_t>(medT)), window(static_cast<size_t>(medF));
  std::vector<float> harm(static_cast<size_t>(bins)), perc(static_cast<size_t>(bins));
  std::array<float, kOuts> g{};
  std::array<std::vector<cfloat>, kOuts> spec;
  for (auto& s : spec) s.assign(size_t(N), cfloat());

  // Frame f covers input samples [f * hop - N, f * hop).
  const int64_t frames = (n + N) / hop + 1;
  const int halfT = medT / 2;
  for (int64_t f = 0; f < frames + halfT; ++f) {
    const size_t slot = size_t(f % medT);
    if (f < frames) {
      const int64_t s0 = f * hop - N;
      for (int i = 0; i < N; ++i) {
        const int64_t s = s0 + i;
        const bool in = s >= 0 && s < n;
        work[size_t(i)] = cfloat(in ? xl[s] * win[size_t(i)] : 0.0f, in ? xr[s] * win[size_t(i)] : 0.0f);
      }
      fft.forward(work.data());
      for (int k = 0; k < bins; ++k) {  // unpack two real spectra
        const cfloat z = work[size_t(k)], zc = std::conj(work[size_t((N - k) % N)]);
        const cfloat d = z - zc;
        const cfloat l = (z + zc) * 0.5f, r(d.imag() * 0.5f, -d.real() * 0.5f);  // (z - zc) / 2i
        ringL[slot][size_t(k)] = l;
        ringR[slot][size_t(k)] = r;
        ringM[slot][size_t(k)] = 0.5f * (std::abs(l) + std::abs(r));
      }
    } else {  // past the end: silent frames, so the medians see the ending
      std::fill(ringL[slot].begin(), ringL[slot].end(), cfloat());
      std::fill(ringR[slot].begin(), ringR[slot].end(), cfloat());
      std::fill(ringM[slot].begin(), ringM[slot].end(), 0.0f);
    }
    const int64_t c = f - halfT;  // centre frame, now surrounded by its neighbours
    if (c < 0) continue;
    const size_t cs = size_t(c % medT);
    const bool full = f + 1 >= medT;
    for (int k = 0; k < bins; ++k) {
      int m = 0;
      for (int j = 0; j < medT; ++j) {
        if (!full && j > f) break;
        column[size_t(m++)] = ringM[size_t(j)][size_t(k)];
      }
      std::nth_element(column.begin(), column.begin() + m / 2, column.begin() + m);
      harm[size_t(k)] = column[size_t(m / 2)];
    }
    const std::vector<float>& mc = ringM[cs];
    for (int k = 0; k < bins; ++k) {
      int m = 0;
      for (int j = k - medF / 2; j <= k + medF / 2; ++j) {
        if (j >= 0 && j < bins) window[size_t(m++)] = mc[size_t(j)];
      }
      std::nth_element(window.begin(), window.begin() + m / 2, window.begin() + m);
      perc[size_t(k)] = window[size_t(m / 2)];
    }
    for (int k = 0; k < bins; ++k) {
      const Bin b{ringL[cs][size_t(k)], ringR[cs][size_t(k)], harm[size_t(k)], perc[size_t(k)], k * rate / N};
      gains(b, g.data());
      for (int o = 0; o < kOuts; ++o) {
        // Pack both channels into one inverse transform: L + iR.
        const cfloat yl = b.l * g[size_t(o)], yr = b.r * g[size_t(o)];
        spec[size_t(o)][size_t(k)] = cfloat(yl.real() - yr.imag(), yl.imag() + yr.real());  // yl + i*yr
        if (k > 0 && k < N / 2) {
          spec[size_t(o)][size_t(N - k)] = cfloat(yl.real() + yr.imag(), -yl.imag() + yr.real());  // conj(yl) + i*conj(yr)
        }
      }
    }
    const int64_t s0 = c * hop - N;
    for (int o = 0; o < kOuts; ++o) {
      // Inverse FFT via the forward one: ifft(X) = conj(fft(conj(X))) / N.
      for (int i = 0; i < N; ++i) inv[size_t(i)] = std::conj(spec[size_t(o)][size_t(i)]);
      fft.forward(inv.data());
      const float scale = norm / float(N);
      for (int i = 0; i < N; ++i) {
        const int64_t s = s0 + i;
        if (s < 0 || s >= n) continue;
        const cfloat y = std::conj(inv[size_t(i)]);
        const Out& ol = outL[size_t(o)];
        const Out& orr = outR[size_t(o)];
        ol.p[s * ol.stride] += y.real() * win[size_t(i)] * scale;
        if (orr.p) orr.p[s * orr.stride] += y.imag() * win[size_t(i)] * scale;
      }
    }
    if ((c & 63) == 0 && progress && !progress(p0 + (p1 - p0) * float(double(c) / double(frames)))) return false;
  }
  return true;
}

// Soft (Wiener-style) mask from two magnitude estimates.
float softMask(float a, float b) {
  const float a2 = a * a, b2 = b * b;
  return a2 / (a2 + b2 + 1e-12f);
}

}  // namespace

int separate(const float* in, int64_t frames, int channels, int sampleRate, float* drums, float* bass, float* vocals,
             const std::function<bool(float)>& progress) {
  if (!in || frames <= 0 || (channels != 1 && channels != 2) || sampleRate < 8000 || !drums || !bass || !vocals) {
    return DJN_ERR_INVALID_ARG;
  }
  const size_t n = size_t(frames);
  std::vector<float> xl(n), xr(n);
  for (size_t i = 0; i < n; ++i) {
    xl[i] = in[i * size_t(channels)];
    xr[i] = in[i * size_t(channels) + size_t(channels - 1)];
  }
  // Frame sizes scale with the rate so they cover the same time.
  const int scale = sampleRate > 96000 ? 4 : (sampleRate > 48000 ? 2 : 1);
  const double rate = sampleRate;

  // Outputs are accumulated in place (interleaved), so start them at zero.
  const size_t total = n * size_t(channels);
  std::fill(drums, drums + total, 0.0f);
  std::fill(bass, bass + total, 0.0f);
  std::fill(vocals, vocals + total, 0.0f);
  const int st = channels;
  auto right = [&](float* p) { return Out{channels == 2 ? p + 1 : nullptr, st}; };

  // Stage 1: long frames (~370 ms, 2.7 Hz detail) and a 2.3 s time median.
  // Sustained -> bass (low part) or other; everything that fluctuates (drums,
  // and voices, which move in pitch) goes on to stage 2.
  std::vector<float> flucL(n, 0.0f), flucR(n, 0.0f);
  const bool ok1 = pass<2>(
      xl.data(), xr.data(), frames, 16384 * scale, 4096 * scale, 25, 17, rate, {Out{bass, st}, Out{flucL.data(), 1}},
      {right(bass), Out{flucR.data(), 1}},
      [](const Bin& b, float* g) {
        const float h = softMask(b.harm, b.perc);
        const float low = 1.0f - ramp(b.hz, 150.0, 260.0);
        g[0] = h * low;       // bass
        g[1] = 1.0f - h;      // fluctuating: drums and voice
      },
      progress, 0.0f, 0.6f);
  if (!ok1) return DJN_ERR_STATE;
  std::vector<float>().swap(xl);  // free the input copy before stage 2
  std::vector<float>().swap(xr);

  // Stage 2: short frames (~23 ms, 50% overlap) on the fluctuating part.
  // Steady here (a voice) -> vocals, weighted to the centre and the voice
  // band; transient -> drums. Below ~130 Hz it is all kick drum.
  const bool ok2 = pass<2>(
      flucL.data(), flucR.data(), frames, 1024 * scale, 512 * scale, 9, 17, rate, {Out{vocals, st}, Out{drums, st}},
      {right(vocals), right(drums)},
      [](const Bin& b, float* g) {
        const float h = softMask(b.harm, b.perc);
        const float kickBand = 1.0f - ramp(b.hz, 110.0, 160.0);
        const float voiceBand = ramp(b.hz, 150.0, 220.0) * (1.0f - ramp(b.hz, 7000.0, 11000.0));
        // Centre: both channels alike in level and in phase (1 for mono,
        // 0 or less for wide or out-of-phase sounds).
        const float ll = std::norm(b.l), rr = std::norm(b.r);
        const float cross = b.l.real() * b.r.real() + b.l.imag() * b.r.imag();  // Re(l * conj(r))
        const float centre = ll + rr > 1e-20f ? std::max(0.0f, 2.0f * cross / (ll + rr)) : 1.0f;
        g[0] = h * voiceBand * centre * centre;             // vocals
        g[1] = kickBand + (1.0f - kickBand) * (1.0f - h);   // drums
      },
      progress, 0.6f, 1.0f);
  if (!ok2) return DJN_ERR_STATE;

  if (progress) progress(1.0f);
  return DJN_OK;
}

}  // namespace stems
}  // namespace djn
