// Unit tests for internal DSP pieces.
#include <cmath>
#include <vector>

#include "dsp.h"
#include "spsc_queue.h"
#include "test.h"
#include "track.h"

TEST(resampler_is_clean_44k1_to_48k) {
  const double inRate = 44100, outRate = 48000, f = 997;
  std::vector<float> in(44100);
  for (size_t i = 0; i < in.size(); ++i) in[i] = float(0.5 * std::sin(2 * djn::kPi * f * double(i) / inRate));
  std::vector<float> out(size_t(in.size() * outRate / inRate));
  djn::resampleChannel(in.data(), int64_t(in.size()), outRate / inRate, out.data(), int64_t(out.size()));
  // Compare the middle against the ideal sine at the new rate.
  double err = 0, sig = 0;
  for (size_t i = 2000; i < out.size() - 2000; ++i) {
    const double ideal = 0.5 * std::sin(2 * djn::kPi * f * double(i) / outRate);
    err += (out[i] - ideal) * (out[i] - ideal);
    sig += ideal * ideal;
  }
  const double snrDb = 10 * std::log10(sig / err);
  CHECK(snrDb > 70);
}

TEST(resampler_rejects_aliasing_when_downsampling) {
  // 30 kHz at 96 kHz must vanish when converting to 48 kHz (above new Nyquist).
  std::vector<float> in(96000);
  for (size_t i = 0; i < in.size(); ++i) in[i] = float(0.5 * std::sin(2 * djn::kPi * 30000 * double(i) / 96000));
  std::vector<float> out(48000);
  djn::resampleChannel(in.data(), int64_t(in.size()), 0.5, out.data(), int64_t(out.size()));
  double s = 0;
  for (size_t i = 1000; i < out.size() - 1000; ++i) s += double(out[i]) * out[i];
  const double rmsDb = 10 * std::log10(s / double(out.size() - 2000) + 1e-20);
  CHECK(rmsDb < -60);
}

TEST(limiter_never_exceeds_ceiling) {
  djn::Limiter lim;
  lim.setup(48000);
  lim.setCeilingDb(-3.0f);
  std::vector<float> l(48000), r(48000);
  for (size_t i = 0; i < l.size(); ++i) {
    // Sudden full-scale bursts on silence: the worst case for a limiter.
    const float burst = (i / 4800) % 2 ? 1.8f : 0.05f;
    l[i] = burst * float(std::sin(2 * djn::kPi * 150 * double(i) / 48000));
    r[i] = -l[i];
  }
  lim.process(l.data(), r.data(), int(l.size()));
  float mx = 0;
  for (size_t i = 0; i < l.size(); ++i) mx = std::max(mx, std::max(std::fabs(l[i]), std::fabs(r[i])));
  CHECK(mx <= djn::dbToGain(-3.0f) + 1e-5f);
}

TEST(spsc_queue_fifo_and_capacity) {
  djn::SpscQueue<int, 4> q;
  CHECK(q.push(1) && q.push(2) && q.push(3) && q.push(4));
  CHECK(!q.push(5));
  int v = 0;
  CHECK(q.pop(v) && v == 1);
  CHECK(q.push(5));
  for (int want : {2, 3, 4, 5}) CHECK(q.pop(v) && v == want);
  CHECK(!q.pop(v));
}

TEST(sample_ring_wraps) {
  djn::SampleRing ring(8);
  float in[6] = {1, 2, 3, 4, 5, 6}, out[8] = {};
  CHECK(ring.write(in, 6) == 6);
  CHECK(ring.read(out, 4) == 4 && out[3] == 4);
  CHECK(ring.write(in, 6) == 6);  // wraps around the end
  CHECK(ring.write(in, 1) == 0);  // full
  CHECK(ring.read(out, 8) == 8 && out[0] == 5 && out[2] == 1 && out[7] == 6);
}
