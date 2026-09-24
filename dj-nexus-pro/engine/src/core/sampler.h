// Sampler: 64 sample slots played by 16 voices. Pads can be one-shot, gate,
// loop or toggle; loops can follow the master tempo with key lock; triggers can
// be quantized to the beat; choke groups cut each other off (e.g. open/closed hats).
#pragma once

#include <array>
#include <cstdint>
#include <vector>

#include "fx.h"
#include "stretcher.h"
#include "track.h"

namespace djn {

class Sampler {
 public:
  static constexpr int kSlots = 64;
  static constexpr int kVoices = 16;
  enum Mode { kOneShot = 0, kGate = 1, kLoop = 2, kToggle = 3 };

  void setup(int sampleRate, int maxBlock);

  // Audio thread. load/unload return the previous sample for the engine to free.
  Track* load(int slot, Track* sample);
  void trigger(int slot, float velocity, const BeatClock& clock, double quantizeBeats);
  void release(int slot);
  void stopAll();
  void setMode(int slot, int mode) { if (valid(slot)) slots_[size_t(slot)].mode = mode; }
  void setChoke(int slot, int group) { if (valid(slot)) slots_[size_t(slot)].choke = group; }
  void setGainDb(int slot, float db) { if (valid(slot)) slots_[size_t(slot)].gainDb = db; }
  void setPitch(int slot, float semis) { if (valid(slot)) slots_[size_t(slot)].pitch = semis; }
  void setSync(int slot, bool on) { if (valid(slot)) slots_[size_t(slot)].sync = on; }

  // Adds the sampler's output into l/r.
  void render(float* l, float* r, int n, const BeatClock& clock);

  uint64_t loadedMask() const;
  uint64_t playingMask() const;
  Track* sample(int slot) const { return valid(slot) ? slots_[size_t(slot)].track : nullptr; }

 private:
  struct Slot {
    Track* track = nullptr;
    int mode = kOneShot;
    int choke = 0;       // 0 = none, 1..8
    float gainDb = 0.0f;
    float pitch = 0.0f;  // semitones (ignored for synced loops, which keep their key)
    bool sync = true;    // loops follow the master tempo when the sample has a BPM
  };
  struct Voice {
    bool active = false;
    int slot = -1;
    double pos = 0.0;
    int startDelay = 0;  // samples to wait (quantized trigger)
    float velocity = 1.0f;
    float env = 0.0f;
    bool releasing = false;
    bool stretching = false;
    uint64_t age = 0;
    Stretcher stretcher;
  };

  static bool valid(int slot) { return slot >= 0 && slot < kSlots; }
  bool looping(int mode) const { return mode == kLoop || mode == kToggle; }
  void releaseVoice(Voice& v) { v.releasing = true; }
  Voice* allocateVoice();
  inline float readCubic(const Track& t, const float* ch, double p) const;

  int sampleRate_ = 48000;
  std::array<Slot, kSlots> slots_{};
  std::array<Voice, kVoices> voices_{};
  uint64_t ageCounter_ = 0;
  float attackStep_ = 0.02f, releaseStep_ = 0.003f;
  std::vector<float> tmpL_, tmpR_;  // one voice's block (maxBlock)
};

}  // namespace djn
