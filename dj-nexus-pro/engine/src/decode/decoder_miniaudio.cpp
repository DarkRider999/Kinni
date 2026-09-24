// File decoding via miniaudio's built-in WAV / FLAC / MP3 decoders.
#include "decoder.h"

#include <vector>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

#include "djnexus/djnexus.h"

#include "../miniaudio/ma.h"

namespace djn {

int decodeFile(const char* utf8Path, DecodedAudio& out) {
  if (!utf8Path) return DJN_ERR_INVALID_ARG;
  // Stereo float at the file's own rate; the engine does its own high-quality
  // resampling to the device rate.
  ma_decoder_config cfg = ma_decoder_config_init(ma_format_f32, 2, 0);
  ma_decoder dec;
#ifdef _WIN32
  // Narrow paths use the ANSI code page on Windows; convert UTF-8 to UTF-16.
  wchar_t wpath[4096];
  if (!MultiByteToWideChar(CP_UTF8, 0, utf8Path, -1, wpath, 4096)) return DJN_ERR_INVALID_ARG;
  if (ma_decoder_init_file_w(wpath, &cfg, &dec) != MA_SUCCESS) return DJN_ERR_IO;
#else
  if (ma_decoder_init_file(utf8Path, &cfg, &dec) != MA_SUCCESS) return DJN_ERR_IO;
#endif

  out.channels = int(dec.outputChannels);
  out.sampleRate = int(dec.outputSampleRate);
  ma_uint64 total = 0;
  if (ma_decoder_get_length_in_pcm_frames(&dec, &total) != MA_SUCCESS) total = 0;

  out.samples.clear();
  out.samples.reserve(size_t(total ? total : 48000 * 60) * size_t(out.channels));
  const ma_uint64 chunk = 16384;
  std::vector<float> buf(size_t(chunk) * size_t(out.channels));
  for (;;) {
    ma_uint64 got = 0;
    const ma_result r = ma_decoder_read_pcm_frames(&dec, buf.data(), chunk, &got);
    out.samples.insert(out.samples.end(), buf.begin(), buf.begin() + ptrdiff_t(got * ma_uint64(out.channels)));
    if (r != MA_SUCCESS || got < chunk) break;
  }
  ma_decoder_uninit(&dec);
  out.frames = int64_t(out.samples.size() / size_t(out.channels));
  return out.frames > 0 ? DJN_OK : DJN_ERR_IO;
}

}  // namespace djn
