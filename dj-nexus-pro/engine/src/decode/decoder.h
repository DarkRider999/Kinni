// Audio file decoding into interleaved float PCM.
#pragma once

#include <cstdint>
#include <vector>

namespace djn {

struct DecodedAudio {
  std::vector<float> samples;  // interleaved
  int64_t frames = 0;
  int channels = 0;
  int sampleRate = 0;
};

// Returns 0 on success, or a djn_result error code.
int decodeFile(const char* utf8Path, DecodedAudio& out);

}  // namespace djn
