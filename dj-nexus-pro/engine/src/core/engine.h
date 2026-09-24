// The engine: decks + mixer + master bus + recorder, driven by one audio
// callback. Control calls are turned into commands (discrete actions) or
// atomic parameter writes (continuous knobs) and applied at block start.
#pragma once

#include <array>
#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "channel.h"
#include "deck.h"
#include "dsp.h"
#include "fx.h"
#include "macro.h"
#include "platform.h"
#include "sampler.h"
#include "recorder.h"
#include "spsc_queue.h"
#include "track.h"

struct djn_engine_state;

namespace djn {

enum class Cmd : uint8_t {
  Load, Unload, Play, Pause, TogglePlay, Cue, Seek,
  HotCueSet, HotCueSetAt, HotCueTrigger, HotCueClear,
  LoopIn, LoopOut, LoopBeats, LoopExit, LoopHalve, LoopDouble,
  Pitch, KeyLock, Quantize, Slip, Reverse, Sync, Jog, SetGrid, SlipRoll, Censor,
  // Sampler (deck = -1 except SamplerCapture, which names the source deck)
  SamplerLoad, SamplerCapture, SamplerTrigger, SamplerRelease, SamplerStopAll,
  SamplerMode, SamplerChoke, SamplerGain, SamplerPitch, SamplerSync,
  // Macros (deck = target channel, -1 = master)
  MacroStart, MacroCancel,
};

struct Command {
  Cmd type;
  int8_t deck;
  int32_t slot;   // hot cue slot, bool flags, jog touched
  double value;   // seconds, beats, pitch, jog rate, bpm
  double value2;  // SetGrid: first beat (seconds)
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
    LockGuard<Mutex> lock(sendMutex_);
    return commands_.push(c);
  }
  void collectGarbage();
  void fillState(djn_engine_state* out, bool consumePeaks = true);

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

  struct FxAtomics {
    std::atomic<int> type{0}, on{0}, target{-1};
    std::atomic<double> beats{1.0};
    std::atomic<float> depth{0.5f}, wet{0.5f};
    std::atomic<int> tail{0};  // telemetry
  };
  std::array<FxAtomics, 2> fx;
  std::atomic<double> fxBpm{0.0};
  std::atomic<double> samplerQuantize{0.0};
  std::atomic<float> samplerVolumeDb{0.0f};
  std::atomic<int> samplerOutput{-1};
  std::atomic<int> colorFx{0};

  // Telemetry used by the control side (capture needs the deck tempo).
  double deckEffectiveBpm(int d) const { return telemetry_[size_t(d)].effectiveBpm.load(std::memory_order_relaxed); }
  double clockBpm() const { return clockBpm_.load(std::memory_order_relaxed); }
  // Longest capture the per-deck history holds.
  double historySeconds() const { return 8.0; }

  Recorder recorder;

 private:
  void dispatch(const Command& c);
  void dispatchGlobal(const Command& c);  // sampler and macro commands
  int chooseMasterDeck() const;
  BeatClock makeClock(int master, const SyncRef& ref, int frames);
  void capture(int deck, Track* into);

  int sampleRate_;
  int maxBlock_;
  int numDecks_;

  std::array<Deck, 4> decks_;
  std::array<ChannelStrip, 4> strips_;
  std::array<DeckTelemetry, 4> telemetry_;
  Limiter limiter_;
  std::array<FxUnit, 2> fxUnits_;
  Sampler sampler_;
  MacroFx macro_;
  int macroTarget_ = -1;
  double internalBeat_ = 0.0;
  double lastClockBpm_ = 120.0;

  // Per-deck history of the pre-fader signal for sampler capture.
  std::array<std::vector<float>, 4> histL_, histR_;
  std::array<int64_t, 4> histCount_{};
  size_t histMask_ = 0;

  SpscQueue<Command, 1024> commands_;
  SpscQueue<Track*, 64> garbage_;
  Mutex sendMutex_;
  Mutex garbageMutex_;

  // Scratch buffers (allocated once).
  std::vector<float> deckL_, deckR_, mixL_, mixR_, cueL_, cueR_, interleaved_, sampL_, sampR_;

  float xfGainA_ = 0.707f, xfGainB_ = 0.707f;
  float masterGain_ = 1.0f;
  std::atomic<int> masterDeck_{-1};
  std::atomic<float> masterPeakL_{0.0f}, masterPeakR_{0.0f};
  std::atomic<float> limiterGr_{0.0f};
  std::atomic<uint64_t> blocks_{0};
  std::atomic<double> dspLoad_{0.0};
  std::atomic<double> clockBpm_{120.0}, clockBeat_{0.0};
  std::atomic<uint64_t> samplerLoaded_{0}, samplerPlaying_{0};
  std::atomic<int> macroType_{-1}, macroTargetT_{-1};
  std::atomic<double> macroProgress_{0.0}, macroBeatsLeft_{0.0};
};

}  // namespace djn
