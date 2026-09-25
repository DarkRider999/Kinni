// Splits audio files into drums, bass, vocals and other stems (WAV files).
//
//   djnexus_stems track.mp3 [out_prefix]   ->  out_prefix.drums.wav, .bass.wav, .vocals.wav, .other.wav
#include <chrono>
#include <cstdio>
#include <cstdint>
#include <string>
#include <vector>

#include "djnexus/djnexus.h"
#include "utf8_args.h"

namespace {

// 16-bit PCM WAV.
bool writeWav(const std::string& path, const float* x, int64_t frames, int channels, int rate) {
  FILE* f = std::fopen(path.c_str(), "wb");
  if (!f) return false;
  const uint32_t dataBytes = uint32_t(frames * channels * 2);
  auto u32 = [&](uint32_t v) { std::fwrite(&v, 4, 1, f); };
  auto u16 = [&](uint16_t v) { std::fwrite(&v, 2, 1, f); };
  std::fwrite("RIFF", 1, 4, f);
  u32(36 + dataBytes);
  std::fwrite("WAVEfmt ", 1, 8, f);
  u32(16);
  u16(1);
  u16(uint16_t(channels));
  u32(uint32_t(rate));
  u32(uint32_t(rate * channels * 2));
  u16(uint16_t(channels * 2));
  u16(16);
  std::fwrite("data", 1, 4, f);
  u32(dataBytes);
  std::vector<int16_t> buf(size_t(frames * channels));
  for (size_t i = 0; i < buf.size(); ++i) {
    const float v = x[i] > 1.0f ? 1.0f : (x[i] < -1.0f ? -1.0f : x[i]);
    buf[i] = int16_t(v * 32767.0f);
  }
  const bool ok = std::fwrite(buf.data(), 2, buf.size(), f) == buf.size();
  return std::fclose(f) == 0 && ok;
}

int progress(void*, float p) {
  std::fprintf(stderr, "\r  %3d%%", int(p * 100.0f + 0.5f));
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  argv = utf8Argv(argc, argv);
  if (argc < 2) {
    std::fprintf(stderr, "usage: %s track.(wav|flac|mp3) [out_prefix]\n", argv[0]);
    return 2;
  }
  const std::string in = argv[1];
  std::string prefix = argc > 2 ? argv[2] : in.substr(0, in.find_last_of('.'));
  float* pcm = nullptr;
  int64_t frames = 0;
  int32_t channels = 0, rate = 0;
  if (djn_decode_file(in.c_str(), &pcm, &frames, &channels, &rate) != DJN_OK) {
    std::fprintf(stderr, "%s: could not read\n", in.c_str());
    return 1;
  }
  if (channels > 2) {
    std::fprintf(stderr, "%s: only mono and stereo are supported\n", in.c_str());
    djn_free_audio(pcm);
    return 1;
  }
  const size_t n = size_t(frames * channels);
  std::vector<float> drums(n), bass(n), vocals(n), other(n);
  const auto t0 = std::chrono::steady_clock::now();
  const int r = djn_separate_stems(pcm, frames, channels, rate, drums.data(), bass.data(), vocals.data(), progress, nullptr);
  const double s = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
  std::fprintf(stderr, "\n");
  if (r != DJN_OK) {
    std::fprintf(stderr, "separation failed (%d)\n", r);
    djn_free_audio(pcm);
    return 1;
  }
  for (size_t i = 0; i < n; ++i) other[i] = pcm[i] - drums[i] - bass[i] - vocals[i];
  const char* names[4] = {"drums", "bass", "vocals", "other"};
  const std::vector<float>* parts[4] = {&drums, &bass, &vocals, &other};
  double total = 0.0;
  for (size_t i = 0; i < n; ++i) total += double(pcm[i]) * pcm[i];
  for (int k = 0; k < 4; ++k) {
    const std::string path = prefix + "." + names[k] + ".wav";
    double e = 0.0;
    for (float v : *parts[k]) e += double(v) * v;
    if (!writeWav(path, parts[k]->data(), frames, channels, rate)) std::fprintf(stderr, "could not write %s\n", path.c_str());
    std::printf("%-7s %s  (%4.1f%% of the energy)\n", names[k], path.c_str(), total > 0 ? 100.0 * e / total : 0.0);
  }
  std::printf("separated %.1f s of audio in %.1f s\n", double(frames) / rate, s);
  djn_free_audio(pcm);
  return 0;
}
