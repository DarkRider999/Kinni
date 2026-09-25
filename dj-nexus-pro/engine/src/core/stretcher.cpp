#include "stretcher.h"

#include <algorithm>
#include <cmath>

#include "dsp.h"

namespace djn {

void Stretcher::setup(int sampleRate, int /*maxBlock*/) {
  // ~43 ms frames at 44.1/48 kHz; scale up for high sample rates so the frame
  // covers the same time span.
  frameLen_ = sampleRate > 96000 ? 8192 : (sampleRate > 48000 ? 4096 : 2048);
  hopLen_ = frameLen_ / 2;
  search_ = frameLen_ / 4;
  window_.resize(size_t(frameLen_));
  for (int i = 0; i < frameLen_; ++i) {
    // Periodic Hann: overlapping copies at hop = N/2 sum to exactly 1.
    window_[size_t(i)] = float(0.5 - 0.5 * std::cos(2.0 * kPi * i / frameLen_));
  }
  olaL_.assign(size_t(frameLen_), 0.0f);
  olaR_.assign(size_t(frameLen_), 0.0f);
  fifoL_.assign(size_t(hopLen_), 0.0f);
  fifoR_.assign(size_t(hopLen_), 0.0f);
}

void Stretcher::reset(const Track& track, double sourcePos, double rate) {
  rate = clampv(rate, kMinRate, kMaxRate);
  std::fill(olaL_.begin(), olaL_.end(), 0.0f);
  std::fill(olaR_.begin(), olaR_.end(), 0.0f);
  havePrev_ = false;
  // Pre-roll one hop: afterwards the accumulator holds the tail of a segment
  // that ends where real output begins, so the first chunk is at full level.
  analysisPos_ = sourcePos - hopLen_ * rate;
  hop(track, rate);
  fifoCount_ = 0;
  fifoRead_ = 0;
  chunkPos_ = sourcePos;
  chunkRate_ = rate;
}

void Stretcher::hop(const Track& track, double rate) {
  if (loopActive_) {
    const double len = loopEnd_ - loopStart_;
    while (analysisPos_ >= loopEnd_) analysisPos_ -= len;
  }
  // Tracks carry at least frameLen + search frames of padding (Track::padForRate).
  const int64_t lo = -track.pad + search_;
  const int64_t hi = track.frames + track.pad - frameLen_ - search_ - 1;
  const int64_t ideal = clampv<int64_t>(int64_t(std::llround(analysisPos_)), lo, hi);
  int64_t start = ideal;

  if (havePrev_) {
    // Find the offset whose waveform best matches the natural continuation of
    // the previous segment over the overlap region. Coarse-to-fine: a sparse
    // scan of the whole range, then a dense scan around the winner. The score
    // is normalised so louder candidates don't win by default.
    const int64_t natural = clampv<int64_t>(prevStart_ + hopLen_, lo, hi);
    const float* L = track.l();
    const float* R = track.r();
    const int overlap = hopLen_;
    auto score = [&](int d, int stride) {
      const int64_t cand = ideal + d;
      float dot = 0.0f, energy = 1e-9f;
      for (int i = 0; i < overlap; i += stride) {
        const float c = L[cand + i] + R[cand + i];
        const float n = L[natural + i] + R[natural + i];
        dot += c * n;
        energy += c * c;
      }
      return dot / std::sqrt(energy);
    };
    float best = -1e30f;
    int bestDelta = 0;
    for (int d = -search_; d <= search_; d += 8) {
      const float sc = score(d, 8);
      if (sc > best) { best = sc; bestDelta = d; }
    }
    const int centre = bestDelta;
    best = -1e30f;
    for (int d = std::max(-search_, centre - 8); d <= std::min(search_, centre + 8); ++d) {
      const float sc = score(d, 2);
      if (sc > best) { best = sc; bestDelta = d; }
    }
    start = ideal + bestDelta;
  }

  // Overlap-add the chosen, windowed segment (the search above always uses the
  // full mix, so muting a stem never changes the timing).
  if (stemGains_ && track.stems) {
    for (int i = 0; i < frameLen_; ++i) {
      olaL_[size_t(i)] += stemMixAt(track, 0, start + i, stemGains_) * window_[size_t(i)];
      olaR_[size_t(i)] += stemMixAt(track, 1, start + i, stemGains_) * window_[size_t(i)];
    }
  } else {
    const float* L = track.l() + start;
    const float* R = track.r() + start;
    for (int i = 0; i < frameLen_; ++i) {
      olaL_[size_t(i)] += L[i] * window_[size_t(i)];
      olaR_[size_t(i)] += R[i] * window_[size_t(i)];
    }
  }

  // The first half is now complete: move it to the fifo and shift.
  std::copy(olaL_.begin(), olaL_.begin() + hopLen_, fifoL_.begin());
  std::copy(olaR_.begin(), olaR_.begin() + hopLen_, fifoR_.begin());
  std::copy(olaL_.begin() + hopLen_, olaL_.end(), olaL_.begin());
  std::copy(olaR_.begin() + hopLen_, olaR_.end(), olaR_.begin());
  std::fill(olaL_.begin() + hopLen_, olaL_.end(), 0.0f);
  std::fill(olaR_.begin() + hopLen_, olaR_.end(), 0.0f);
  fifoCount_ = hopLen_;
  fifoRead_ = 0;
  chunkPos_ = analysisPos_;
  chunkRate_ = rate;

  prevStart_ = start;
  havePrev_ = true;
  analysisPos_ += hopLen_ * rate;
}

void Stretcher::process(const Track& track, double rate, float* outL, float* outR, int n) {
  rate = clampv(rate, kMinRate, kMaxRate);
  int done = 0;
  while (done < n) {
    if (fifoRead_ >= fifoCount_) hop(track, rate);
    const int take = std::min(n - done, fifoCount_ - fifoRead_);
    std::copy(fifoL_.begin() + fifoRead_, fifoL_.begin() + fifoRead_ + take, outL + done);
    std::copy(fifoR_.begin() + fifoRead_, fifoR_.begin() + fifoRead_ + take, outR + done);
    fifoRead_ += take;
    done += take;
  }
}

}  // namespace djn
