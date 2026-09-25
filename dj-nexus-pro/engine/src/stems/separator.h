// Stem separation without trained models: drums, bass and vocals from a
// stereo mix ("other" is the mix minus those three).
//
// Two-stage harmonic/percussive separation (Tachibana et al.): with long
// frames, sustained tones (bass, chords, pads) separate from everything that
// fluctuates (drums, and voices, whose pitch moves); with short frames, the
// voice in that second part looks steady and separates from the drums.
// Bass is the sustained part below ~200 Hz, and vocals are also weighted
// towards the centre of the stereo image and the voice band.
//
// This is a baseline: fast, dependency-free and licence-free, but clearly
// below neural separators (Demucs-class models). It sits behind this function
// so a model can replace it (docs/dj-nexus-pro/AI_TRAINING_BLUEPRINT.md, C3).
#pragma once

#include <cstdint>
#include <functional>

namespace djn {
namespace stems {

// `in` is interleaved (1 or 2 channels); each output is interleaved with the
// same layout and length. `progress(0..1)` may return false to cancel.
// Returns 0, or a djn_result error code.
int separate(const float* in, int64_t frames, int channels, int sampleRate, float* drums, float* bass, float* vocals,
             const std::function<bool(float)>& progress);

}  // namespace stems
}  // namespace djn
