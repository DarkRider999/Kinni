// Android audio host on Oboe: AAudio on Android 8.1+ (MMAP / exclusive mode
// where the device supports it), OpenSL ES on older devices.
#include <algorithm>
#include <atomic>
#include <cstdio>
#include <cstring>  // before Oboe.h: FullDuplexStream.h uses memset without including it
#include <memory>
#include <mutex>

#include <android/log.h>
#include <oboe/Oboe.h>

#include "djnexus/djnexus.h"

#define DJN_LOG(...) __android_log_print(ANDROID_LOG_INFO, "DJNexusEngine", __VA_ARGS__)

namespace {

class OboeHost : public oboe::AudioStreamDataCallback, public oboe::AudioStreamErrorCallback {
 public:
  OboeHost(djn_engine* engine, const djn_host_config& cfg) : engine_(engine), cfg_(cfg) {
    maxBlock_ = djn_engine_max_block_frames(engine);
  }

  bool open() {
    std::lock_guard<std::mutex> lock(mutex_);
    return openLocked();
  }

  void close() {
    std::lock_guard<std::mutex> lock(mutex_);
    closing_ = true;
    if (stream_) {
      stream_->stop();
      stream_->close();
      stream_.reset();
    }
  }

  oboe::DataCallbackResult onAudioReady(oboe::AudioStream* stream, void* audioData, int32_t numFrames) override {
    float* out = static_cast<float*>(audioData);
    const int32_t ch = stream->getChannelCount();
    int32_t done = 0;
    while (done < numFrames) {
      const int32_t n = std::min(numFrames - done, maxBlock_);
      if (djn_engine_process(engine_, out + size_t(done) * size_t(ch), n, ch) != DJN_OK) {
        std::memset(out + size_t(done) * size_t(ch), 0, size_t(n) * size_t(ch) * sizeof(float));
      }
      done += n;
    }
    return oboe::DataCallbackResult::Continue;
  }

  // Called on a separate thread after the stream has been closed, e.g. when
  // headphones or a USB interface are unplugged. Reopen on the new default device.
  void onErrorAfterClose(oboe::AudioStream* /*stream*/, oboe::Result error) override {
    DJN_LOG("stream closed: %s", oboe::convertToText(error));
    if (error != oboe::Result::ErrorDisconnected) return;
    std::lock_guard<std::mutex> lock(mutex_);
    if (closing_) return;
    stream_.reset();
    openLocked();
  }

  int info(djn_host_info* out) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::memset(out, 0, sizeof(*out));
    if (!stream_) return DJN_ERR_DEVICE;
    out->sample_rate = stream_->getSampleRate();
    out->buffer_frames = stream_->getBufferSizeInFrames();
    out->output_channels = stream_->getChannelCount();
    auto latency = stream_->calculateLatencyMillis();
    out->output_latency_ms = latency ? latency.value()
                                     : 1000.0 * stream_->getBufferSizeInFrames() / stream_->getSampleRate();
    std::snprintf(out->backend, sizeof(out->backend), "%s",
                  stream_->getAudioApi() == oboe::AudioApi::AAudio ? "aaudio" : "opensles");
    return DJN_OK;
  }

 private:
  bool openLocked() {
    const int32_t wanted = cfg_.output_channels == 4 ? 4 : 2;
    // 4 channels (master + headphone cue) needs a multi-channel USB interface;
    // fall back to stereo when the device refuses.
    for (int32_t ch : {wanted, int32_t(2)}) {
      oboe::AudioStreamBuilder b;
      b.setDirection(oboe::Direction::Output)
          ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
          ->setSharingMode(oboe::SharingMode::Exclusive)
          ->setUsage(oboe::Usage::Media)
          ->setContentType(oboe::ContentType::Music)
          ->setFormat(oboe::AudioFormat::Float)
          ->setFormatConversionAllowed(true)
          ->setChannelCount(ch)
          ->setChannelConversionAllowed(true)
          ->setSampleRate(djn_engine_sample_rate(engine_))
          ->setSampleRateConversionQuality(oboe::SampleRateConversionQuality::Medium)
          ->setDataCallback(this)
          ->setErrorCallback(this);
      if (b.openStream(stream_) == oboe::Result::OK && stream_->getChannelCount() == ch) break;
      if (stream_) {
        stream_->close();
        stream_.reset();
      }
    }
    if (!stream_) return false;

    // Two bursts is the usual low-latency sweet spot; the app can raise it
    // (buffer_frames) on devices that glitch.
    const int32_t burst = stream_->getFramesPerBurst();
    const int32_t target = cfg_.buffer_frames > 0 ? cfg_.buffer_frames : burst * 2;
    stream_->setBufferSizeInFrames(std::max(burst, target));

    if (stream_->requestStart() != oboe::Result::OK) {
      stream_->close();
      stream_.reset();
      return false;
    }
    DJN_LOG("started: %d Hz, %d ch, burst %d, buffer %d, %s", stream_->getSampleRate(), stream_->getChannelCount(),
            burst, stream_->getBufferSizeInFrames(),
            stream_->getAudioApi() == oboe::AudioApi::AAudio ? "AAudio" : "OpenSL ES");
    return true;
  }

  djn_engine* engine_;
  djn_host_config cfg_;
  int32_t maxBlock_ = 256;
  mutable std::mutex mutex_;
  std::shared_ptr<oboe::AudioStream> stream_;
  bool closing_ = false;
};

}  // namespace

struct djn_host {
  std::unique_ptr<OboeHost> impl;
};

extern "C" {

DJN_API int32_t djn_host_preferred_sample_rate(void) {
  // Open a throwaway stream without a rate to learn the native one (usually 48 kHz).
  oboe::AudioStreamBuilder b;
  b.setDirection(oboe::Direction::Output)
      ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
      ->setFormat(oboe::AudioFormat::Float)
      ->setChannelCount(2);
  std::shared_ptr<oboe::AudioStream> s;
  int32_t rate = 48000;
  if (b.openStream(s) == oboe::Result::OK) {
    rate = s->getSampleRate();
    s->close();
  }
  return rate;
}

DJN_API djn_host* djn_host_start(djn_engine* engine, const djn_host_config* config) {
  if (!engine) return nullptr;
  djn_host_config cfg{};
  if (config) cfg = *config;
  auto host = std::make_unique<djn_host>();
  host->impl = std::make_unique<OboeHost>(engine, cfg);
  if (!host->impl->open()) return nullptr;
  return host.release();
}

DJN_API void djn_host_stop(djn_host* host) {
  if (!host) return;
  host->impl->close();
  delete host;
}

DJN_API int djn_host_get_info(const djn_host* host, djn_host_info* out) {
  if (!host || !out) return DJN_ERR_INVALID_ARG;
  return host->impl->info(out);
}

}  // extern "C"
