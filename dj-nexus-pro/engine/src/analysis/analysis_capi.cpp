// C API for track analysis (djn_analyze_*).
#include <cstring>
#include <new>
#include <string>

#include "analysis.h"
#include "decode/decoder.h"
#include "djnexus/djnexus.h"
#include "platform.h"
#include "track.h"

namespace {

void copyText(char* dst, size_t size, const std::string& s) {
  const size_t n = std::min(size - 1, s.size());
  std::memcpy(dst, s.data(), n);
  dst[n] = '\0';
}

}  // namespace

DJN_API void djn_analysis_default_options(djn_analysis_options* o) {
  if (!o) return;
  o->min_bpm = 78.0;
  o->max_bpm = 180.0;
  o->flags = DJN_ANALYZE_TEMPO | DJN_ANALYZE_KEY;
}

DJN_API int djn_analyze_pcm(const float* interleaved, int64_t frames, int32_t channels, int32_t sample_rate,
                            const djn_analysis_options* options, djn_analysis* out) {
  if (!out) return DJN_ERR_INVALID_ARG;
  std::memset(out, 0, sizeof(*out));
  out->key = -1;
  if (!interleaved || frames <= 0 || channels <= 0 || channels > 8 || sample_rate < 8000) return DJN_ERR_INVALID_ARG;
  djn_analysis_options opt;
  djn_analysis_default_options(&opt);
  if (options) {
    if (options->min_bpm > 0) opt.min_bpm = options->min_bpm;
    if (options->max_bpm > 0) opt.max_bpm = options->max_bpm;
    if (options->flags) opt.flags = options->flags;
  }
  if (opt.max_bpm < opt.min_bpm) return DJN_ERR_INVALID_ARG;
  djn::analysis::Options o;
  o.minBpm = opt.min_bpm;
  o.maxBpm = opt.max_bpm;
  DJN_TRY {
    const std::vector<float> mono =
        djn::analysis::monoAt(interleaved, frames, channels, sample_rate, djn::analysis::kTempoRate);
    if (opt.flags & DJN_ANALYZE_TEMPO) {
      const djn::analysis::TempoResult t = djn::analysis::analyzeTempo(mono, djn::analysis::kTempoRate, o);
      out->bpm = t.bpm;
      out->first_beat_sec = t.firstBeat;
      out->bpm_confidence = t.confidence;
      out->downbeat_confidence = t.downbeatConfidence;
      out->tempo_stable = t.stable ? 1 : 0;
    }
    if (opt.flags & DJN_ANALYZE_KEY) {
      std::vector<float> half(mono.size() / 2);
      if (!half.empty()) djn::resampleChannel(mono.data(), int64_t(mono.size()), 0.5, half.data(), int64_t(half.size()));
      const djn::analysis::KeyResult k = djn::analysis::analyzeKey(half, djn::analysis::kKeyRate);
      out->key = k.key;
      out->key_confidence = k.confidence;
      out->tuning_cents = k.tuningCents;
      copyText(out->key_name, sizeof(out->key_name), djn::analysis::keyName(k.key));
      copyText(out->camelot, sizeof(out->camelot), djn::analysis::camelot(k.key));
      copyText(out->open_key, sizeof(out->open_key), djn::analysis::openKey(k.key));
    }
  }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  return DJN_OK;
}

DJN_API int djn_analyze_file(const char* utf8_path, const djn_analysis_options* options, djn_analysis* out) {
  if (!utf8_path || !out) return DJN_ERR_INVALID_ARG;
  djn::DecodedAudio audio;
  int r;
  DJN_TRY {
    r = djn::decodeFile(utf8_path, audio);
  }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  if (r != DJN_OK) {
    std::memset(out, 0, sizeof(*out));
    out->key = -1;
    return r;
  }
  return djn_analyze_pcm(audio.samples.data(), audio.frames, audio.channels, audio.sampleRate, options, out);
}
