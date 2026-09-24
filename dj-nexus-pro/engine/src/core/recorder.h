// Records the master bus to a WAV file. The audio thread only copies samples
// into a lock-free ring; a background thread converts and writes to disk.
#pragma once

#include <atomic>
#include <cstdint>
#include <cstdio>
#include <string>
#include <thread>

#include "spsc_queue.h"

namespace djn {

std::FILE* openFileUtf8(const char* path, const char* mode);

class Recorder {
 public:
  enum Format { kWav16 = 0, kWav24 = 1, kWavFloat = 2 };

  Recorder();
  ~Recorder();

  // Control thread.
  bool start(const char* utf8Path, Format format, int sampleRate);
  void stop();

  // Audio thread: interleaved stereo.
  void write(const float* interleaved, int frames);

  bool recording() const { return active_.load(std::memory_order_acquire); }
  uint64_t framesWritten() const { return frames_.load(std::memory_order_relaxed); }
  uint64_t overflows() const { return overflows_.load(std::memory_order_relaxed); }

 private:
  void writerLoop();
  void writeHeader(uint32_t dataBytes);

  SampleRing ring_;
  std::thread thread_;
  std::FILE* file_ = nullptr;
  Format format_ = kWav16;
  int sampleRate_ = 48000;
  uint64_t dataBytes_ = 0;
  uint32_t dither_ = 22222;
  std::atomic<bool> active_{false};
  std::atomic<bool> stopRequested_{false};
  std::atomic<uint64_t> frames_{0};
  std::atomic<uint64_t> overflows_{0};
};

}  // namespace djn
