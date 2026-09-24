// Desktop audio host (Windows, macOS, Linux) on miniaudio.
// Backends in priority order: WASAPI (Windows), CoreAudio (macOS),
// PulseAudio / ALSA / JACK (Linux).
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "../miniaudio/ma.h"
#include "djnexus/djnexus.h"

struct djn_host {
  djn_engine* engine = nullptr;
  ma_context context;
  ma_device device;
  int32_t channels = 2;
  int32_t maxBlock = 0;
};

namespace {

void dataCallback(ma_device* dev, void* output, const void* /*input*/, ma_uint32 frameCount) {
  auto* host = static_cast<djn_host*>(dev->pUserData);
  float* out = static_cast<float*>(output);
  ma_uint32 done = 0;
  while (done < frameCount) {
    const ma_uint32 n = std::min<ma_uint32>(frameCount - done, ma_uint32(host->maxBlock));
    if (djn_engine_process(host->engine, out + size_t(done) * size_t(host->channels), int32_t(n), host->channels) !=
        DJN_OK) {
      std::memset(out + size_t(done) * size_t(host->channels), 0, size_t(n) * size_t(host->channels) * sizeof(float));
    }
    done += n;
  }
}

const char* backendName(ma_backend b) {
  switch (b) {
    case ma_backend_wasapi: return "wasapi";
    case ma_backend_dsound: return "dsound";
    case ma_backend_winmm: return "winmm";
    case ma_backend_coreaudio: return "coreaudio";
    case ma_backend_pulseaudio: return "pulseaudio";
    case ma_backend_alsa: return "alsa";
    case ma_backend_jack: return "jack";
    case ma_backend_null: return "null";
    default: return "other";
  }
}

// Finds a playback device whose name contains `wanted` (case-sensitive).
bool findDevice(ma_context* ctx, const char* wanted, ma_device_id* id) {
  ma_device_info* infos = nullptr;
  ma_uint32 count = 0;
  if (ma_context_get_devices(ctx, &infos, &count, nullptr, nullptr) != MA_SUCCESS) return false;
  for (ma_uint32 i = 0; i < count; ++i) {
    if (std::strstr(infos[i].name, wanted)) {
      *id = infos[i].id;
      return true;
    }
  }
  return false;
}

// DJN_AUDIO_BACKEND=wasapi|dsound|coreaudio|pulseaudio|alsa|jack|null forces
// one backend (e.g. JACK on a studio Linux box, or "null" for headless tests).
ma_result initContext(ma_context* ctx) {
  const char* env = std::getenv("DJN_AUDIO_BACKEND");
  if (env && *env) {
    struct { const char* name; ma_backend backend; } table[] = {
        {"wasapi", ma_backend_wasapi}, {"dsound", ma_backend_dsound}, {"winmm", ma_backend_winmm},
        {"coreaudio", ma_backend_coreaudio}, {"pulseaudio", ma_backend_pulseaudio}, {"alsa", ma_backend_alsa},
        {"jack", ma_backend_jack}, {"null", ma_backend_null}};
    for (const auto& t : table) {
      if (std::strcmp(env, t.name) == 0) return ma_context_init(&t.backend, 1, nullptr, ctx);
    }
  }
  return ma_context_init(nullptr, 0, nullptr, ctx);
}

}  // namespace

extern "C" {

DJN_API int32_t djn_host_preferred_sample_rate(void) {
  ma_context ctx;
  if (initContext(&ctx) != MA_SUCCESS) return 48000;
  ma_device_info* infos = nullptr;
  ma_uint32 count = 0;
  int32_t rate = 48000;
  if (ma_context_get_devices(&ctx, &infos, &count, nullptr, nullptr) == MA_SUCCESS) {
    for (ma_uint32 i = 0; i < count; ++i) {
      if (!infos[i].isDefault) continue;
      ma_device_info full;
      if (ma_context_get_device_info(&ctx, ma_device_type_playback, &infos[i].id, &full) == MA_SUCCESS &&
          full.nativeDataFormatCount > 0 && full.nativeDataFormats[0].sampleRate > 0) {
        rate = int32_t(full.nativeDataFormats[0].sampleRate);
      }
      break;
    }
  }
  ma_context_uninit(&ctx);
  return rate;
}

DJN_API djn_host* djn_host_start(djn_engine* engine, const djn_host_config* config) {
  if (!engine) return nullptr;
  djn_host_config cfg{};
  if (config) cfg = *config;
  auto* host = new djn_host();
  host->engine = engine;
  host->channels = cfg.output_channels == 4 ? 4 : 2;
  // Device periods larger than the engine's block are rendered in chunks.
  host->maxBlock = djn_engine_max_block_frames(engine);

  if (initContext(&host->context) != MA_SUCCESS) {
    delete host;
    return nullptr;
  }

  ma_device_id id;
  const bool haveId = cfg.device_name && findDevice(&host->context, cfg.device_name, &id);

  ma_device_config dc = ma_device_config_init(ma_device_type_playback);
  dc.playback.format = ma_format_f32;
  dc.playback.channels = ma_uint32(host->channels);
  dc.playback.pDeviceID = haveId ? &id : nullptr;
  dc.playback.shareMode = ma_share_mode_shared;
  dc.sampleRate = ma_uint32(djn_engine_sample_rate(engine));
  dc.periodSizeInFrames = cfg.buffer_frames > 0 ? ma_uint32(cfg.buffer_frames) : 256;
  dc.periods = 2;
  dc.performanceProfile = ma_performance_profile_low_latency;
  dc.noPreSilencedOutputBuffer = MA_TRUE;  // the engine writes every sample
  dc.noClip = MA_TRUE;                     // the limiter already handles this
  dc.dataCallback = dataCallback;
  dc.pUserData = host;

  if (ma_device_init(&host->context, &dc, &host->device) != MA_SUCCESS) {
    ma_context_uninit(&host->context);
    delete host;
    return nullptr;
  }
  if (ma_device_start(&host->device) != MA_SUCCESS) {
    ma_device_uninit(&host->device);
    ma_context_uninit(&host->context);
    delete host;
    return nullptr;
  }
  return host;
}

DJN_API void djn_host_stop(djn_host* host) {
  if (!host) return;
  ma_device_uninit(&host->device);  // stops and waits for the callback to finish
  ma_context_uninit(&host->context);
  delete host;
}

DJN_API int djn_host_get_info(const djn_host* host, djn_host_info* out) {
  if (!host || !out) return DJN_ERR_INVALID_ARG;
  std::memset(out, 0, sizeof(*out));
  const ma_device& d = host->device;
  out->sample_rate = int32_t(d.sampleRate);
  out->buffer_frames = int32_t(d.playback.internalPeriodSizeInFrames);
  out->output_channels = int32_t(d.playback.channels);
  out->output_latency_ms =
      1000.0 * double(d.playback.internalPeriodSizeInFrames) * double(d.playback.internalPeriods) /
      double(d.playback.internalSampleRate ? d.playback.internalSampleRate : d.sampleRate);
  std::snprintf(out->backend, sizeof(out->backend), "%s", backendName(host->context.backend));
  return DJN_OK;
}

}  // extern "C"
