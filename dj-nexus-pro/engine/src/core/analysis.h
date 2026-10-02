// Offline track analysis: BPM/beat-grid and musical key detection.
//
// Unlike everything else in src/core, this is NOT real-time safe: it allocates
// and is meant to run once per track, off the audio thread, before the result
// is handed to djn_deck_set_grid() (BPM) or shown in the library UI (key).
#pragma once

#include <cstdint>
#include <string>

namespace djn {

struct AnalysisResult {
  // 0 when no clear periodicity was found (e.g. silence, spoken word).
  double bpm = 0.0;
  // Confidence in `bpm`, 0..1 (relative strength of the winning autocorrelation
  // peak versus the runner-up). Below ~0.15 the estimate is a guess.
  double bpm_confidence = 0.0;
  // Position of the first detected beat, for djn_deck_set_grid's first_beat_sec.
  double first_beat_sec = 0.0;

  // -1 when no tonal center was found (e.g. a pure drum loop).
  int key_pitch_class = -1;  // 0=C, 1=C#/Db, 2=D, ... 11=B
  bool key_is_minor = false;
  // Correlation of the winning profile, 0..1 (negative correlations clamp to 0).
  double key_confidence = 0.0;

  // Three structural landmarks from the track's 1-second energy envelope, for
  // auto-setting hot cues on load (the "auto 3 cue point" feature): where the
  // intro gives way to the main section, the single highest-energy moment
  // (a reasonable proxy for "the drop" in a lot of club music), and where
  // the energy falls off again toward the end. -1 when undeterminable (e.g.
  // silence, or a track too short to have a meaningful envelope shape) --
  // these are heuristics over loudness, not real structural segmentation, so
  // treat them as a starting point a DJ can drag to taste, not ground truth.
  double intro_end_sec = -1.0;
  double drop_sec = -1.0;
  double outro_start_sec = -1.0;
};

// Analyzes an already-decoded buffer (same shape djn_deck_load_pcm takes).
// `channels` is 1 or 2; stereo is downmixed to mono for analysis.
AnalysisResult analyzeTrack(const float* interleaved, int64_t frames, int32_t channels,
                            int32_t sampleRate);

// The two-character Camelot wheel code for a key, e.g. "8B" (C major) or
// "8A" (A minor). Returns "" for pitchClass outside 0..11.
std::string camelotCode(int pitchClass, bool isMinor);

// The Camelot wheel position (number 1..12, letter 'A' minor / 'B' major)
// behind camelotCode(), for callers (e.g. the advisor) that need to measure
// distance on the wheel rather than just print it. Returns false for
// pitchClass outside 0..11, leaving outNumber/outLetter unset.
bool camelotOf(int pitchClass, bool isMinor, int& outNumber, char& outLetter);

}  // namespace djn
