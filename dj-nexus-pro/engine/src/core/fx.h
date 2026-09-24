// Beat FX: one FX unit hosts one of twelve tempo-synced effects and can be
// inserted on any channel (post-fader) or on the master bus.
#pragma once

#include <array>
#include <cstdint>
#include <vector>

namespace djn {

// Tempo and beat position shared by the FX units and the sampler, taken from
// the sync master deck (or a free-running clock when nothing is playing).
struct BeatClock {
  double bpm = 120.0;         // absolute tempo
  double beat = 0.0;          // continuous beat position at the start of the block
  double beatsPerSample = 0;  // how far `beat` moves per output sample
  double at(int i) const { return beat + beatsPerSample * i; }
};

enum class FxType : int {
  Echo = 0, Delay, PingPong, Reverb, Flanger, Phaser, Roll, Stutter, Trans, Pitch, Distortion, Crush, Count
};

struct FxParams {
  int type = 0;
  double beats = 1.0;   // beat division, 1/16 .. 16
  float depth = 0.5f;   // effect-specific amount
  float wet = 0.5f;     // dry/wet
  bool on = false;
};

// Stereo delay line with an absolute write counter, so it doubles as the
// history buffer for roll/stutter and the pitch shifter.
class DelayLine {
 public:
  void setup(size_t minSize);
  // Logical clear: older samples read as silence. O(1), safe on the audio thread.
  void clear() { validFrom_ = count_; }
  inline void push(float x) {
    buf_[size_t(count_) & mask_] = x;
    ++count_;
  }
  // Sample written `delay` samples ago (delay >= 1), linearly interpolated.
  inline float read(double delay) const {
    const double p = double(count_) - delay;
    const int64_t i = int64_t(p >= 0 ? p : p - 1.0);
    const float f = float(p - double(i));
    return readAbs(i) + (readAbs(i + 1) - readAbs(i)) * f;
  }
  inline float readAbs(int64_t index) const {
    return index < validFrom_ || index >= count_ ? 0.0f : buf_[size_t(index) & mask_];
  }
  int64_t count() const { return count_; }
  size_t size() const { return mask_ + 1; }

 private:
  std::vector<float> buf_;
  size_t mask_ = 0;
  int64_t count_ = 0;
  int64_t validFrom_ = 0;
};

// Real-time pitch shifter: overlapping Hann grains read the input at `ratio`
// speed. Each new grain starts where its waveform best matches the grain it
// overlaps (a streaming WSOLA search), so grains never cancel each other.
class PitchShifter {
 public:
  void setup(int sampleRate);
  void reset();
  inline void process(float inL, float inR, double ratio, float& outL, float& outR) {
    hist_[0].push(inL);
    hist_[1].push(inR);
    if (counter_ == 0) startGrain(ratio);
    counter_ = (counter_ + 1) % hop_;
    float yl = 0.0f, yr = 0.0f;
    for (auto& g : grains_) {
      if (g.age >= grain_) continue;
      const float w = window_[size_t(g.age)];
      yl += hist_[0].read(g.delay) * w;
      yr += hist_[1].read(g.delay) * w;
      g.delay += 1.0 - ratio;
      ++g.age;
    }
    outL = yl;
    outR = yr;
  }

 private:
  struct Grain {
    double delay = 0.0;
    int age = 1 << 30;  // >= grain length: inactive
  };
  void startGrain(double ratio);

  DelayLine hist_[2];
  std::vector<float> window_;
  std::array<Grain, 2> grains_{};
  int grain_ = 1920, hop_ = 960, search_ = 576, corr_ = 288;
  int counter_ = 0;
  int next_ = 0;
};

class FxUnit {
 public:
  void setup(int sampleRate, int maxBlock);

  // In place. Keeps running after `on` goes false while echoes/reverb ring out.
  void process(float* l, float* r, int n, const FxParams& p, const BeatClock& clock);

  bool on() const { return lastOn_; }
  bool tailActive() const { return tail_; }
  int type() const { return type_; }

  static bool isSend(int type) {
    return type == int(FxType::Echo) || type == int(FxType::Delay) || type == int(FxType::PingPong) ||
           type == int(FxType::Reverb);
  }

 private:
  void resetEffect(int type);
  void startRoll(const BeatClock& clock, double beats);
  double beatSamples(const BeatClock& clock) const { return clock.bpm > 0 ? sr_ * 60.0 / clock.bpm : sr_ * 0.5; }

  // Effects. Send effects return the wet signal only; inserts return the processed signal.
  void echo(float xl, float xr, float gate, float& yl, float& yr, float fb, bool filtered);
  void pingPong(float xl, float xr, float gate, float& yl, float& yr, float fb);
  void reverb(float xl, float xr, float gate, float& yl, float& yr);

  double sr_ = 48000.0;
  int type_ = 0;
  bool lastOn_ = false;
  bool tail_ = false;
  float engage_ = 0.0f;       // 0..1 ramp for switching on/off
  float wet_ = 0.0f;          // smoothed wet
  float engageStep_ = 0.001f;
  int silentSamples_ = 0;
  float echoLpC_ = 0.37f, echoHpC_ = 0.0156f, rvDampC_ = 0.45f;

  DelayLine dl_[2];           // shared by echo/delay/ping-pong/flanger/pitch/roll history
  double delay_ = 0.0;        // smoothed delay (samples)
  float fbLp_[2] = {0, 0}, fbHp_[2] = {0, 0};

  // Reverb: 8-line feedback delay network.
  static constexpr int kLines = 8;
  std::array<DelayLine, kLines> rvLine_;
  std::array<double, kLines> rvLen_{};
  std::array<float, kLines> rvDamp_{};
  float rvDecay_ = -1.0f;
  std::array<float, kLines> rvGain_{};

  // Phaser
  float apZ_[2][6] = {};
  float phFb_[2] = {0, 0};
  float apCoef_ = 0.0f;

  // Roll / stutter
  int64_t rollStart_ = 0;     // absolute history index of the slice start
  int64_t rollElapsed_ = 0;   // samples since the slice start
  int64_t rollLen_ = 1;
  double rollBeats_ = 0.0;
  bool rolling_ = false;

  // Trans
  float transGain_ = 1.0f;

  // Pitch shifter
  PitchShifter shifter_;

  // Distortion / crush
  float toneLp_[2] = {0, 0};
  float crushHold_[2] = {0, 0};
  int crushCount_ = 0;
};

}  // namespace djn
