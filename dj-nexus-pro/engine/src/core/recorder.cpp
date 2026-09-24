#include "recorder.h"

#include <chrono>
#include <cmath>
#include <cstring>
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

namespace djn {

std::FILE* openFileUtf8(const char* path, const char* mode) {
#ifdef _WIN32
  wchar_t wpath[4096], wmode[16];
  if (!MultiByteToWideChar(CP_UTF8, 0, path, -1, wpath, 4096)) return nullptr;
  if (!MultiByteToWideChar(CP_UTF8, 0, mode, -1, wmode, 16)) return nullptr;
  return _wfopen(wpath, wmode);
#else
  return std::fopen(path, mode);
#endif
}

namespace {

// ~22 s of stereo audio at 48 kHz: plenty of slack for slow storage.
#if defined(DJN_NO_THREADS)
constexpr size_t kRingSamples = 16;  // recording is unavailable without a writer thread
#else
constexpr size_t kRingSamples = size_t(1) << 21;
#endif

void put16(std::FILE* f, uint16_t v) {
  const uint8_t b[2] = {uint8_t(v), uint8_t(v >> 8)};
  std::fwrite(b, 1, 2, f);
}
void put32(std::FILE* f, uint32_t v) {
  const uint8_t b[4] = {uint8_t(v), uint8_t(v >> 8), uint8_t(v >> 16), uint8_t(v >> 24)};
  std::fwrite(b, 1, 4, f);
}

}  // namespace

Recorder::Recorder() : ring_(kRingSamples) {}

Recorder::~Recorder() { stop(); }

void Recorder::writeHeader(uint32_t dataBytes) {
  const bool isFloat = format_ == kWavFloat;
  const uint16_t bits = format_ == kWav16 ? 16 : (format_ == kWav24 ? 24 : 32);
  const uint16_t channels = 2;
  const uint16_t blockAlign = uint16_t(channels * bits / 8);
  const uint32_t fmtSize = isFloat ? 18 : 16;
  std::fseek(file_, 0, SEEK_SET);
  std::fwrite("RIFF", 1, 4, file_);
  put32(file_, 4 + (8 + fmtSize) + 8 + dataBytes);
  std::fwrite("WAVEfmt ", 1, 8, file_);
  put32(file_, fmtSize);
  put16(file_, isFloat ? 3 : 1);
  put16(file_, channels);
  put32(file_, uint32_t(sampleRate_));
  put32(file_, uint32_t(sampleRate_) * blockAlign);
  put16(file_, blockAlign);
  put16(file_, bits);
  if (isFloat) put16(file_, 0);  // cbSize
  std::fwrite("data", 1, 4, file_);
  put32(file_, dataBytes);
}

bool Recorder::start(const char* utf8Path, Format format, int sampleRate) {
#if defined(DJN_NO_THREADS)
  (void)utf8Path; (void)format; (void)sampleRate;
  return false;  // no disk writer thread in single-threaded (web) builds
#else
  if (active_.load() || !utf8Path) return false;
  if (thread_.joinable()) thread_.join();
  file_ = openFileUtf8(utf8Path, "wb");
  if (!file_) return false;
  format_ = format;
  sampleRate_ = sampleRate;
  dataBytes_ = 0;
  writeHeader(0);
  ring_.reset();
  frames_.store(0);
  overflows_.store(0);
  stopRequested_.store(false);
  thread_ = std::thread([this] { writerLoop(); });
  active_.store(true, std::memory_order_release);
  return true;
#endif
}

void Recorder::stop() {
#if defined(DJN_NO_THREADS)
  return;
#else
  if (!thread_.joinable()) return;
  active_.store(false, std::memory_order_release);
  stopRequested_.store(true, std::memory_order_release);
  thread_.join();
#endif
}

void Recorder::write(const float* interleaved, int frames) {
  if (!active_.load(std::memory_order_acquire)) return;
  const size_t want = size_t(frames) * 2;
  const size_t wrote = ring_.write(interleaved, want);
  if (wrote < want) overflows_.fetch_add(1, std::memory_order_relaxed);
  frames_.fetch_add(wrote / 2, std::memory_order_relaxed);
}

void Recorder::writerLoop() {
  std::vector<float> buf(8192);
  std::vector<uint8_t> bytes(buf.size() * 4);
  // WAV data is limited to 4 GiB; stop cleanly before that.
  const uint64_t maxBytes = 0xFFFFFFFFull - 64;
  for (;;) {
    const size_t got = ring_.read(buf.data(), buf.size());
    if (got == 0) {
      if (stopRequested_.load(std::memory_order_acquire)) break;
#if !defined(DJN_NO_THREADS)
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
#endif
      continue;
    }
    size_t nb = 0;
    for (size_t i = 0; i < got; ++i) {
      float x = buf[i];
      x = x > 1.0f ? 1.0f : (x < -1.0f ? -1.0f : x);
      if (format_ == kWav16) {
        // TPDF dither: sum of two uniform random values, +-1 LSB.
        dither_ = dither_ * 1664525u + 1013904223u;
        const float r1 = float(dither_ >> 8) / 16777216.0f;
        dither_ = dither_ * 1664525u + 1013904223u;
        const float r2 = float(dither_ >> 8) / 16777216.0f;
        long v = std::lround(double(x) * 32767.0 + double(r1 - r2));
        v = v > 32767 ? 32767 : (v < -32768 ? -32768 : v);
        bytes[nb++] = uint8_t(v);
        bytes[nb++] = uint8_t(v >> 8);
      } else if (format_ == kWav24) {
        long v = std::lround(double(x) * 8388607.0);
        bytes[nb++] = uint8_t(v);
        bytes[nb++] = uint8_t(v >> 8);
        bytes[nb++] = uint8_t(v >> 16);
      } else {
        std::memcpy(&bytes[nb], &x, 4);  // little-endian on every supported target
        nb += 4;
      }
    }
    if (dataBytes_ + nb > maxBytes) break;
    std::fwrite(bytes.data(), 1, nb, file_);
    dataBytes_ += nb;
  }
  writeHeader(uint32_t(dataBytes_));
  std::fclose(file_);
  file_ = nullptr;
  active_.store(false, std::memory_order_release);
}

}  // namespace djn
