// The engine: decks + mixer + master bus + recorder, driven by one audio
// callback. Control calls are turned into commands (discrete actions) or
// atomic parameter writes (continuous knobs) and applied at block start.
#pragma once

#include <array>
#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <vector>

#include "channel.h"
#include "deck.h"
#include "dsp.h"
#include "recorder.h"
#include "spsc_queue.h"
#include "track.h"

struct djn_engine_state;

namespace djn {

enum class Cmd : uint8_t {
  Load, Unload, Play, Pause, TogglePlay, Cue, Seek,
  HotCueSet, HotCueSetAt, HotCueTrigger, HotCueClear,
  LoopIn, LoopOut, LoopBeats, LoopExit, LoopHalve, LoopDouble,
  Pitch, KeyLock, Quantize, Slip, Reverse, Sync, Jog,
};

struct Command {
  Cmd type;
  int8_t deck;
  int32_t slot;   // hot cue slot, bool flags, jog touched
  double value;   // seconds, beats, pitch, jog rate
  Track* track;   // Load only
};

class Engine {
 public:
  Engine(int sampleRate, int maxBlock, int numDecks);
  ~Engine();

  // Audio thread.
  int process(float* out, int frames, int outChannels);

  // Control side: callable from any non-audio thread (UI, loader). The queue
  // is single-producer, so producers are serialised here; the audio thread
  // only pops and never takes this lock.
  bool send(const Command& c) {
    std::lock_guard<std::mutex> lock(sendMutex_);
    return commands_.push(c);
  }
  void collectGarbage();
  void fillState(djn_engine_state* out);

  int sampleRate() const { return sampleRate_; }
  int maxBlock() const { return maxBlock_; }
  int numDecks() const { return numDecks_; }

  // Continuous parameters, written by the control thread, read per block.
  struct ChannelAtomics {
    std::atomic<float> trimDb{0.0f}, eqDb[3], filter{0.0f}, fader{1.0f};
    std::atomic<int> assign{0}, cue{0};
    std::atomic<float> peakL{0.0f}, peakR{0.0f};
    ChannelAtomics() {
      for (auto& e : eqDb) e.store(0.0f);
    }
  };
  std::array<ChannelAtomics, 4> channels;
  std::atomic<int> eqMode{0};
  std::atomic<float> resonance{0.3f};
  std::atomic<float> crossfader{0.5f};
  std::atomic<int> crossfaderCurve{0};
  std::atomic<float> masterDb{0.0f};
  std::atomic<int> limiterOn{1};
  std::atomic<float> limiterCeilingDb{-0.3f};
  std::atomic<float> cueMix{0.0f};
  std::atomic<float> headphoneDb{0.0f};
  std::atomic<int> masterDeckRequest{-1};

  Recorder recorder;

 private:
  void dispatch(const Command& c);
  int chooseMasterDeck() const;

  int sampleRate_;
  int maxBlock_;
  int numDecks_;

  std::array<Deck, 4> decks_;
  std::array<ChannelStrip, 4> strips_;
  std::array<DeckTelemetry, 4> telemetry_;
  Limiter limiter_;

  SpscQueue<Command, 1024> commands_;
  SpscQueue<Track*, 64> garbage_;
  std::mutex sendMutex_;
  std::mutex garbageMutex_;

  // Scratch buffers (allocated once).
  std::vector<float> deckL_, deckR_, mixL_, mixR_, cueL_, cueR_, interleaved_;

  float xfGainA_ = 0.707f, xfGainB_ = 0.707f;
  float masterGain_ = 1.0f;
  std::atomic<int> masterDeck_{-1};
  std::atomic<float> masterPeakL_{0.0f}, masterPeakR_{0.0f};
  std::atomic<float> limiterGr_{0.0f};
  std::atomic<uint64_t> blocks_{0};
  std::atomic<double> dspLoad_{0.0};
};

}  // namespace djn
