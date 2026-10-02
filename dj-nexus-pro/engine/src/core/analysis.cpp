#include "analysis.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <complex>
#include <vector>

#include "dsp.h"

namespace djn {
namespace {

using Complex = std::complex<double>;

// Iterative radix-2 Cooley-Tukey. `n` must be a power of two. Offline use
// only (allocates internally via the bit-reversal swap, which is in place).
void fft(std::vector<Complex>& a) {
  const size_t n = a.size();
  if (n <= 1) return;
  for (size_t i = 1, j = 0; i < n; ++i) {
    size_t bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) std::swap(a[i], a[j]);
  }
  for (size_t len = 2; len <= n; len <<= 1) {
    const double ang = -2.0 * kPi / double(len);
    const Complex wlen(std::cos(ang), std::sin(ang));
    for (size_t i = 0; i < n; i += len) {
      Complex w(1.0, 0.0);
      for (size_t k = 0; k < len / 2; ++k) {
        const Complex u = a[i + k];
        const Complex v = a[i + k + len / 2] * w;
        a[i + k] = u + v;
        a[i + k + len / 2] = u - v;
        w *= wlen;
      }
    }
  }
}

size_t nextPow2(size_t v) {
  size_t p = 1;
  while (p < v) p <<= 1;
  return p;
}

std::vector<float> downmix(const float* interleaved, int64_t frames, int32_t channels) {
  std::vector<float> mono(size_t(std::max<int64_t>(frames, 0)));
  if (channels <= 1) {
    for (int64_t i = 0; i < frames; ++i) mono[size_t(i)] = interleaved[i];
  } else {
    for (int64_t i = 0; i < frames; ++i) {
      double sum = 0.0;
      for (int32_t c = 0; c < channels; ++c) sum += interleaved[i * channels + c];
      mono[size_t(i)] = float(sum / channels);
    }
  }
  return mono;
}

// ---------------------------------------------------------------- tempo

constexpr double kMinBpm = 60.0;
constexpr double kMaxBpm = 200.0;
constexpr int kOnsetFrame = 512;
constexpr int kOnsetHop = 128;

// Half-wave-rectified first difference of short-time energy: a simple, cheap
// onset novelty curve that responds strongly to drum hits and other transients.
std::vector<double> onsetNovelty(const std::vector<float>& mono, int32_t sampleRate) {
  (void)sampleRate;
  if (mono.size() < size_t(kOnsetFrame) + size_t(kOnsetHop)) return {};
  const size_t numFrames = (mono.size() - kOnsetFrame) / kOnsetHop + 1;
  std::vector<double> energy(numFrames);
  for (size_t f = 0; f < numFrames; ++f) {
    const size_t start = f * kOnsetHop;
    double sum = 0.0;
    for (int i = 0; i < kOnsetFrame; ++i) {
      const double s = mono[start + size_t(i)];
      sum += s * s;
    }
    energy[f] = std::sqrt(sum / kOnsetFrame);
  }
  std::vector<double> novelty(numFrames, 0.0);
  for (size_t f = 1; f < numFrames; ++f) novelty[f] = std::max(0.0, energy[f] - energy[f - 1]);
  return novelty;
}

struct TempoEstimate {
  double bpm = 0.0;
  double confidence = 0.0;
  double firstBeatSec = 0.0;
};

TempoEstimate estimateTempo(const std::vector<double>& novelty, int32_t sampleRate) {
  TempoEstimate out;
  if (novelty.size() < 8) return out;
  const double frameRate = double(sampleRate) / double(kOnsetHop);

  const int minLag = std::max(1, int(std::floor(frameRate * 60.0 / kMaxBpm)));
  const int maxLag = int(std::ceil(frameRate * 60.0 / kMinBpm));
  if (minLag >= maxLag || size_t(maxLag) + 1 >= novelty.size()) return out;

  // Normalised autocorrelation of the novelty curve at every integer lag in
  // the 60-200 BPM range.
  std::vector<double> score(size_t(maxLag) + 1, 0.0);
  for (int lag = minLag; lag <= maxLag; ++lag) {
    double sum = 0.0, norm = 0.0;
    const size_t count = novelty.size() - size_t(lag);
    for (size_t i = 0; i < count; ++i) {
      sum += novelty[i] * novelty[i + size_t(lag)];
      norm += novelty[i] * novelty[i];
    }
    score[size_t(lag)] = (norm > 1e-12 && count > 0) ? sum / norm : 0.0;
  }

  // A perfectly periodic beat scores just as well at every integer multiple
  // of its true period (a Dirac comb's autocorrelation is itself a comb), so
  // picking the lag with the single highest score tends to lock onto a half-
  // or quarter-tempo octave error. Sub-harmonic summation (standard in pitch
  // and tempo trackers) fixes this: a lag's combined score also credits its
  // own multiples, so the true (shortest) period collects support from 2x and
  // 3x its score as well, while a lag that is itself 2x or 3x the true period
  // only collects its own, smaller, share.
  // A harmonic's true position drifts by rounding error as the multiplier
  // grows (e.g. 2x a period already rounded to the nearest frame can land a
  // full frame away from the actual, sharply-peaked, double-period lag), so
  // each harmonic is read as a small local peak rather than a single index.
  auto peakNear = [&](int lag) {
    if (lag < minLag || lag > maxLag) return 0.0;
    double m = score[size_t(lag)];
    if (lag > minLag) m = std::max(m, score[size_t(lag - 1)]);
    if (lag < maxLag) m = std::max(m, score[size_t(lag + 1)]);
    return m;
  };
  std::vector<double> combined(score.size(), 0.0);
  for (int lag = minLag; lag <= maxLag; ++lag)
    combined[size_t(lag)] = score[size_t(lag)] + 0.5 * peakNear(2 * lag) + 0.33 * peakNear(3 * lag);
  int bestLag = minLag;
  double bestCombined = combined[size_t(minLag)];
  for (int lag = minLag + 1; lag <= maxLag; ++lag) {
    if (combined[size_t(lag)] > bestCombined) {
      bestCombined = combined[size_t(lag)];
      bestLag = lag;
    }
  }
  const double maxScore = score[size_t(bestLag)];
  if (maxScore <= 0.0) return out;

  // Parabolic interpolation around the winning lag for sub-frame precision;
  // frame-level resolution alone is too coarse at high BPM (short periods).
  double refinedLag = double(bestLag);
  if (bestLag > minLag && bestLag < maxLag) {
    const double sL = score[size_t(bestLag - 1)], sC = score[size_t(bestLag)], sR = score[size_t(bestLag + 1)];
    const double denom = sL - 2.0 * sC + sR;
    if (std::fabs(denom) > 1e-12) {
      const double delta = 0.5 * (sL - sR) / denom;
      if (delta > -1.0 && delta < 1.0) refinedLag += delta;
    }
  }
  if (refinedLag <= 0.0) return out;

  out.bpm = frameRate * 60.0 / refinedLag;
  double meanScore = 0.0;
  for (int lag = minLag; lag <= maxLag; ++lag) meanScore += score[size_t(lag)];
  meanScore /= double(maxLag - minLag + 1);
  out.confidence = clampv((maxScore - meanScore) / std::max(maxScore, 1e-9), 0.0, 1.0);

  // First beat: the strongest onset within the first beat period, which is a
  // reasonable proxy for the first downbeat on a steady-tempo track.
  const size_t searchEnd = std::min(novelty.size(), size_t(std::max(bestLag, 1)));
  size_t peakFrame = 0;
  double peakVal = -1.0;
  for (size_t i = 0; i < searchEnd; ++i) {
    if (novelty[i] > peakVal) {
      peakVal = novelty[i];
      peakFrame = i;
    }
  }
  out.firstBeatSec = double(peakFrame * kOnsetHop) / double(sampleRate);
  return out;
}

// ---------------------------------------------------------------- key

constexpr int kKeyFrame = 4096;
constexpr int kKeyHop = 2048;
constexpr double kKeyMinHz = 80.0;
constexpr double kKeyMaxHz = 5000.0;
// Analyze at most this many seconds (from the start) to bound compute time on
// long tracks; a track's key rarely changes enough in the first couple of
// minutes to matter for DJ harmonic mixing.
constexpr double kKeyMaxAnalysisSec = 120.0;

// Krumhansl-Schmuckler key profiles (relative perceived stability of each
// scale degree), the standard basis for correlation-based key detection.
constexpr double kMajorProfile[12] = {6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                                       2.52, 5.19, 2.39, 3.66, 2.29, 2.88};
constexpr double kMinorProfile[12] = {6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                                       2.54, 4.75, 3.98, 2.69, 3.34, 3.17};

int wrap12(int v) { return ((v % 12) + 12) % 12; }

std::array<double, 12> computeChroma(const std::vector<float>& mono, int32_t sampleRate) {
  std::array<double, 12> chroma{};
  const size_t maxSamples =
      std::min(mono.size(), size_t(std::max(1.0, kKeyMaxAnalysisSec * sampleRate)));
  if (maxSamples < size_t(kKeyFrame)) return chroma;

  const size_t n = nextPow2(kKeyFrame);
  std::vector<double> window(kKeyFrame);
  for (int i = 0; i < kKeyFrame; ++i)
    window[size_t(i)] = 0.5 - 0.5 * std::cos(2.0 * kPi * i / (kKeyFrame - 1));  // Hann

  std::vector<Complex> buf(n);
  const size_t numFrames = (maxSamples - kKeyFrame) / kKeyHop + 1;
  for (size_t f = 0; f < numFrames; ++f) {
    const size_t start = f * kKeyHop;
    for (size_t i = 0; i < n; ++i)
      buf[i] = i < size_t(kKeyFrame) ? Complex(mono[start + i] * window[i], 0.0) : Complex(0.0, 0.0);
    fft(buf);
    for (size_t bin = 1; bin < n / 2; ++bin) {
      const double freq = double(bin) * sampleRate / double(n);
      if (freq < kKeyMinHz || freq > kKeyMaxHz) continue;
      const double mag = std::abs(buf[bin]);
      const double midi = 69.0 + 12.0 * std::log2(freq / 440.0);
      const int pc = wrap12(int(std::lround(midi)));
      chroma[size_t(pc)] += mag;
    }
  }
  return chroma;
}

double correlation(const std::array<double, 12>& a, const double* b) {
  double meanA = 0, meanB = 0;
  for (int i = 0; i < 12; ++i) {
    meanA += a[size_t(i)];
    meanB += b[i];
  }
  meanA /= 12.0;
  meanB /= 12.0;
  double num = 0, denA = 0, denB = 0;
  for (int i = 0; i < 12; ++i) {
    const double da = a[size_t(i)] - meanA, db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const double den = std::sqrt(denA * denB);
  return den > 1e-12 ? num / den : 0.0;
}

struct KeyEstimate {
  int pitchClass = -1;
  bool isMinor = false;
  double confidence = 0.0;
};

KeyEstimate estimateKey(const std::array<double, 12>& chroma) {
  KeyEstimate out;
  double total = 0;
  for (double v : chroma) total += v;
  if (total <= 1e-9) return out;

  double best = -2.0;
  for (int rotation = 0; rotation < 12; ++rotation) {
    double rotatedMajor[12], rotatedMinor[12];
    for (int i = 0; i < 12; ++i) {
      rotatedMajor[i] = kMajorProfile[size_t(wrap12(i - rotation))];
      rotatedMinor[i] = kMinorProfile[size_t(wrap12(i - rotation))];
    }
    const double cMaj = correlation(chroma, rotatedMajor);
    const double cMin = correlation(chroma, rotatedMinor);
    if (cMaj > best) {
      best = cMaj;
      out.pitchClass = rotation;
      out.isMinor = false;
    }
    if (cMin > best) {
      best = cMin;
      out.pitchClass = rotation;
      out.isMinor = true;
    }
  }
  out.confidence = clampv(best, 0.0, 1.0);
  return out;
}

}  // namespace

AnalysisResult analyzeTrack(const float* interleaved, int64_t frames, int32_t channels,
                            int32_t sampleRate) {
  AnalysisResult result;
  if (!interleaved || frames <= 0 || channels <= 0 || sampleRate <= 0) return result;

  const std::vector<float> mono = downmix(interleaved, frames, channels);

  const auto novelty = onsetNovelty(mono, sampleRate);
  const auto tempo = estimateTempo(novelty, sampleRate);
  result.bpm = tempo.bpm;
  result.bpm_confidence = tempo.confidence;
  result.first_beat_sec = tempo.firstBeatSec;

  const auto chroma = computeChroma(mono, sampleRate);
  const auto key = estimateKey(chroma);
  result.key_pitch_class = key.pitchClass;
  result.key_is_minor = key.isMinor;
  result.key_confidence = key.confidence;

  return result;
}

bool camelotOf(int pitchClass, bool isMinor, int& outNumber, char& outLetter) {
  if (pitchClass < 0 || pitchClass > 11) return false;
  // Camelot number for the MAJOR key rooted at each pitch class (circle of
  // fifths order starting at C=8B, matching the standard Camelot wheel).
  static const int kMajorNumber[12] = {8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1};
  if (!isMinor) {
    outNumber = kMajorNumber[size_t(pitchClass)];
    outLetter = 'B';
  } else {
    // A minor key's relative major sits 3 semitones up; it shares that
    // major's Camelot number with the "A" (minor) letter.
    outNumber = kMajorNumber[size_t(wrap12(pitchClass + 3))];
    outLetter = 'A';
  }
  return true;
}

std::string camelotCode(int pitchClass, bool isMinor) {
  int number;
  char letter;
  if (!camelotOf(pitchClass, isMinor, number, letter)) return "";
  return std::to_string(number) + letter;
}

}  // namespace djn
