// Small iterative radix-2 FFT for offline analysis (not used on the audio thread).
#pragma once

#include <cmath>
#include <complex>
#include <vector>

namespace djn {
namespace analysis {

class Fft {
 public:
  explicit Fft(int n) : n_(n), rev_(size_t(n)), tw_(size_t(n / 2)) {
    int bits = 0;
    while ((1 << bits) < n) ++bits;
    for (int i = 0; i < n; ++i) {
      int r = 0;
      for (int b = 0; b < bits; ++b) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev_[size_t(i)] = r;
    }
    const double pi = 3.14159265358979323846;
    for (int i = 0; i < n / 2; ++i) tw_[size_t(i)] = std::polar(1.0f, float(-2.0 * pi * i / n));
  }

  int size() const { return n_; }

  // In place, forward transform. `a` must hold size() values.
  void forward(std::complex<float>* a) const {
    for (int i = 0; i < n_; ++i) {
      if (i < rev_[size_t(i)]) std::swap(a[i], a[rev_[size_t(i)]]);
    }
    for (int len = 2; len <= n_; len <<= 1) {
      const int half = len / 2, step = n_ / len;
      for (int i = 0; i < n_; i += len) {
        for (int j = 0; j < half; ++j) {
          const std::complex<float> w = tw_[size_t(j * step)];
          const std::complex<float> u = a[i + j], v = a[i + j + half] * w;
          a[i + j] = u + v;
          a[i + j + half] = u - v;
        }
      }
    }
  }

  // Magnitude spectrum (bins 0..n/2) of two real frames at once: `x` and `y`
  // share one complex transform (x in the real part, y in the imaginary part).
  void magnitudes2(const float* x, const float* y, float* magX, float* magY, std::vector<std::complex<float>>& work) const {
    work.resize(size_t(n_));
    for (int i = 0; i < n_; ++i) work[size_t(i)] = {x[i], y ? y[i] : 0.0f};
    forward(work.data());
    for (int k = 0; k <= n_ / 2; ++k) {
      const std::complex<float> z = work[size_t(k)], zc = std::conj(work[size_t((n_ - k) % n_)]);
      magX[k] = std::abs(z + zc) * 0.5f;
      if (magY) magY[k] = std::abs(z - zc) * 0.5f;
    }
  }

 private:
  int n_;
  std::vector<int> rev_;
  std::vector<std::complex<float>> tw_;
};

}  // namespace analysis
}  // namespace djn
