// One playback deck: transport, cues, loops, tempo, key lock, sync, slip,
// reverse and jog. Renders pre-fader stereo audio. All methods except setup()
// run on the audio thread (commands are dispatched there by the engine).
#pragma once

#include <array>
#include <atomic>
#include <cstdint>
#include <vector>

#include "stretcher.h"
#include "track.h"

namespace djn {

// Tempo/phase reference from the sync master, sampled at the start of a block.
struct SyncRef {
  bool valid = false;     // a master with a beat grid exists
  bool playing = false;
  double bpm = 0.0;       // master's current tempo (without nudges)
  double phase = 0.0;     // master's beat phase 0..1
};

// Values the UI reads. Written by the audio thread once per block.
struct DeckTelemetry {
  std::atomic<int> loaded{0}, playing{0}, keyLock{0}, sync{0}, slip{0}, reverse{0}, looping{0};
  std::atomic<double> position{0}, duration{0}, slipPosition{0}, trackBpm{0}, effectiveBpm{0}, rate{0};
  std::atomic<double> beatPhase{-1}, loopStart{0}, loopEnd{0}, cue{0};
  std::atomic<int64_t> beatIndex{0};
};

class Deck {
 public:
  void setup(int sampleRate, int maxBlock);

  // Returns the previous track so the engine can hand it back for freeing.
  Track* load(Track* track);
  Track* unload();

  void play();
  void pause();
  void togglePlay() { playing_ ? pause() : play(); }
  void cue();
  void seekSeconds(double s);
  void hotCueSet(int slot);
  void hotCueSetAt(int slot, double seconds);
  void hotCueTrigger(int slot);
  void hotCueClear(int slot);
  void loopIn();
  void loopOut();
  void loopBeats(double beats);
  void loopExit();
  void loopHalve();
  void loopDouble();
  void setPitch(double p);
  void setKeyLock(bool on) { keyLock_ = on; }
  void setQuantize(bool on) { quantize_ = on; }
  void setSlip(bool on);
  void setReverse(bool on) { reverse_ = on; }
  void setSync(bool on);
  void jog(bool touched, double rate);

  // Renders n frames of pre-fader audio (always writes n frames).
  void render(float* outL, float* outR, int n, const SyncRef& ref, bool isMaster);

  void publish(DeckTelemetry& t) const;

  bool loaded() const { return track_ != nullptr; }
  bool playing() const { return playing_; }
  bool synced() const { return sync_; }
  bool hasGrid() const { return track_ && track_->bpm > 0; }
  double trackBpm() const { return track_ ? track_->bpm : 0.0; }
  // Tempo multiplier without nudges or phase corrections.
  double tempoRate() const { return tempoRate_; }
  double beatPhase() const;
  double position() const { return pos_; }

 private:
  static constexpr int kXfadeLen = 256;  // ~5 ms seamless crossfade for jumps

  void jumpTo(double newPos);
  double snapToBeat(double p) const;
  double phasePreservingTarget(double target) const;
  bool inExcursion() const { return looping_ || reverse_ || touched_; }
  inline float readCubic(const float* ch, double p) const;
  void setLoopActive(bool on);

  int sampleRate_ = 48000;
  Track* track_ = nullptr;
  Stretcher stretcher_;

  // Transport
  bool playing_ = false;
  double pos_ = 0.0;          // playhead in frames
  double cuePoint_ = 0.0;
  std::array<double, 16> hotCues_{};
  std::array<bool, 16> hotCueSet_{};
  float playGain_ = 0.0f;     // de-click ramp for play/pause

  // Tempo
  double pitch_ = 0.0;
  double tempoRate_ = 1.0;    // 1 + pitch, or the sync-derived rate
  double lastRate_ = 0.0;     // rate at the end of the previous block
  bool keyLock_ = false;
  bool stretching_ = false;   // whether the stretcher produced the last block
  bool quantize_ = true;
  bool sync_ = false;
  bool pendingPhaseSnap_ = false;
  bool reverse_ = false;
  bool touched_ = false;
  double jogRate_ = 0.0;
  double nudge_ = 0.0;

  // Loops
  bool looping_ = false;
  double loopStart_ = 0.0, loopEnd_ = 0.0;
  double pendingLoopIn_ = -1.0;

  // Slip
  bool slip_ = false;
  double slipPos_ = 0.0;
  bool wasExcursion_ = false;

  // Seamless-jump crossfade: the old stream keeps playing and fades out.
  double xfadePos_ = 0.0;
  int xfadeRemaining_ = 0;
};

}  // namespace djn
