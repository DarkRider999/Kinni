#include "track.h"

#include <algorithm>
#include <cmath>

#include "dsp.h"

namespace djn {

namespace {

constexpr int kBaseHalfTaps = 16;  // 32 taps (in output samples)
constexpr int kPhases = 512;       // kernel table resolution

// Blackman-windowed sinc sampled at kPhases sub-sample offsets. When
// downsampling, the kernel is stretched in input samples so it keeps the same
// number of zero crossings (and so the same stopband) at the lower cutoff.
struct SincTable {
  std::vector<float> taps;  // (kPhases + 1) * (2 * halfTaps)
  double cutoff = 1.0;
  int halfTaps = kBaseHalfTaps;

  explicit SincTable(double cut) : cutoff(cut) {
    halfTaps = int(std::ceil(kBaseHalfTaps / std::min(1.0, cut / 0.97)));
    const int kHalfTaps = halfTaps;
    const int width = 2 * kHalfTaps;
    taps.resize(size_t(kPhases + 1) * width);
    for (int p = 0; p <= kPhases; ++p) {
      const double frac = double(p) / kPhases;
      for (int k = 0; k < width; ++k) {
        const double x = (k - kHalfTaps + 1) - frac;  // distance from the output point
        const double sx = x * cutoff;
        const double sinc = std::fabs(sx) < 1e-9 ? 1.0 : std::sin(kPi * sx) / (kPi * sx);
        const double t = (x + kHalfTaps) / (2.0 * kHalfTaps);  // 0..1 across the window
        const double w = (t <= 0 || t >= 1) ? 0.0
                         : 0.42 - 0.5 * std::cos(2 * kPi * t) + 0.08 * std::cos(4 * kPi * t);
        taps[size_t(p) * width + k] = float(sinc * w * cutoff);
      }
    }
  }
};

}  // namespace

void resampleChannel(const float* in, int64_t inFrames, double ratio, float* out, int64_t outFrames) {
  // When downsampling, lower the cutoff below the new Nyquist to prevent aliasing.
  const double cutoff = ratio < 1.0 ? ratio * 0.97 : 0.97;
  const SincTable table(cutoff);
  const int kHalfTaps = table.halfTaps;
  const int width = 2 * kHalfTaps;
  const double step = 1.0 / ratio;  // input frames per output frame

  for (int64_t i = 0; i < outFrames; ++i) {
    const double t = double(i) * step;
    const int64_t base = int64_t(std::floor(t));
    const double frac = t - double(base);
    const double pf = frac * kPhases;
    const int p0 = int(pf);
    const float mix = float(pf - p0);
    const float* k0 = &table.taps[size_t(p0) * width];
    const float* k1 = &table.taps[size_t(p0 + 1 > kPhases ? kPhases : p0 + 1) * width];
    float acc = 0.0f;
    const int64_t first = base - kHalfTaps + 1;
    for (int k = 0; k < width; ++k) {
      const int64_t idx = first + k;
      if (idx < 0 || idx >= inFrames) continue;
      const float coef = k0[k] + (k1[k] - k0[k]) * mix;
      acc += in[idx] * coef;
    }
    out[i] = acc;
  }
}

std::unique_ptr<Track> makeTrack(const float* interleaved, int64_t frames, int channels,
                                 int sourceRate, int engineRate, double bpm, double firstBeatSec,
                                 int64_t pad) {
  if (!interleaved || frames <= 0 || channels < 1 || channels > 2 || sourceRate <= 0 || engineRate <= 0) {
    return nullptr;
  }

  // Split into planar channels at the source rate.
  std::vector<float> srcL(static_cast<size_t>(frames)), srcR(static_cast<size_t>(frames));
  for (int64_t i = 0; i < frames; ++i) {
    srcL[size_t(i)] = interleaved[i * channels];
    srcR[size_t(i)] = interleaved[i * channels + (channels == 2 ? 1 : 0)];
  }

  auto track = std::make_unique<Track>();
  track->pad = pad;
  track->sampleRate = engineRate;
  track->bpm = bpm > 0 ? bpm : 0.0;
  track->firstBeatFrame = firstBeatSec * engineRate;

  int64_t outFrames = frames;
  if (sourceRate != engineRate) {
    const double ratio = double(engineRate) / double(sourceRate);
    outFrames = int64_t(std::floor(double(frames) * ratio));
    track->left.assign(size_t(outFrames + 2 * pad), 0.0f);
    track->right.assign(size_t(outFrames + 2 * pad), 0.0f);
    resampleChannel(srcL.data(), frames, ratio, track->left.data() + pad, outFrames);
    resampleChannel(srcR.data(), frames, ratio, track->right.data() + pad, outFrames);
  } else {
    track->left.assign(size_t(outFrames + 2 * pad), 0.0f);
    track->right.assign(size_t(outFrames + 2 * pad), 0.0f);
    std::copy(srcL.begin(), srcL.end(), track->left.begin() + pad);
    std::copy(srcR.begin(), srcR.end(), track->right.begin() + pad);
  }
  track->frames = outFrames;
  return track;
}

}  // namespace djn

namespace djn {

std::unique_ptr<Stems> makeStems(const float* const parts[Stems::kParts], int64_t frames, int channels, int sourceRate,
                                 int engineRate, int64_t pad) {
  auto stems = std::make_unique<Stems>();
  stems->pad = pad;
  for (int p = 0; p < Stems::kParts; ++p) {
    std::unique_ptr<Track> t = makeTrack(parts[p], frames, channels, sourceRate, engineRate, 0.0, 0.0, pad);
    if (!t) return nullptr;
    stems->frames = t->frames;
    auto toInt = [](const std::vector<float>& in, std::vector<int16_t>& out) {
      out.resize(in.size());
      for (size_t i = 0; i < in.size(); ++i) {
        const float v = std::max(-1.0f, std::min(1.0f, in[i])) * 32767.0f;
        out[i] = int16_t(std::lround(v));
      }
    };
    toInt(t->left, stems->left[size_t(p)]);
    toInt(t->right, stems->right[size_t(p)]);
  }
  return stems;
}

std::unique_ptr<Track> makeSilentTrack(int64_t frames, int engineRate, int64_t pad) {
  if (frames <= 0 || engineRate <= 0) return nullptr;
  auto track = std::make_unique<Track>();
  track->pad = pad;
  track->sampleRate = engineRate;
  track->frames = frames;
  track->left.assign(size_t(frames + 2 * pad), 0.0f);
  track->right.assign(size_t(frames + 2 * pad), 0.0f);
  return track;
}

}  // namespace djn
