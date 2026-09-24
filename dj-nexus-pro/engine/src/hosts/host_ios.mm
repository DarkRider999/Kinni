// iOS audio host: RemoteIO audio unit plus an AVAudioSession configured for
// low-latency music playback. Handles interruptions (calls, Siri) and route
// changes (headphones or a USB interface plugged in or out).
#import <AVFoundation/AVFoundation.h>
#include <AudioToolbox/AudioToolbox.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <vector>

#include "djnexus/djnexus.h"

struct djn_host {
  djn_engine* engine = nullptr;
  djn_host_config cfg{};
  AudioUnit unit = nullptr;
  int32_t channels = 2;
  int32_t maxBlock = 256;
  std::vector<float> interleaved;  // preallocated for the largest slice
  id interruptionObserver = nil;
  id resetObserver = nil;
};

namespace {

constexpr UInt32 kMaxFramesPerSlice = 4096;

OSStatus renderCallback(void* ref, AudioUnitRenderActionFlags* flags, const AudioTimeStamp* /*ts*/,
                        UInt32 /*bus*/, UInt32 frames, AudioBufferList* io) {
  auto* host = static_cast<djn_host*>(ref);
  const int32_t ch = host->channels;
  if (frames > kMaxFramesPerSlice || io->mNumberBuffers < UInt32(ch)) {
    for (UInt32 b = 0; b < io->mNumberBuffers; ++b) std::memset(io->mBuffers[b].mData, 0, io->mBuffers[b].mDataByteSize);
    *flags |= kAudioUnitRenderAction_OutputIsSilence;
    return noErr;
  }
  float* inter = host->interleaved.data();
  UInt32 done = 0;
  while (done < frames) {
    const UInt32 n = std::min<UInt32>(frames - done, UInt32(host->maxBlock));
    if (djn_engine_process(host->engine, inter + size_t(done) * ch, int32_t(n), ch) != DJN_OK) {
      std::memset(inter + size_t(done) * ch, 0, size_t(n) * ch * sizeof(float));
    }
    done += n;
  }
  // RemoteIO is configured non-interleaved: one buffer per channel.
  for (int32_t c = 0; c < ch; ++c) {
    float* dst = static_cast<float*>(io->mBuffers[c].mData);
    for (UInt32 i = 0; i < frames; ++i) dst[i] = inter[size_t(i) * ch + c];
  }
  return noErr;
}

bool configureSession(djn_host* host, double sampleRate) {
  AVAudioSession* session = [AVAudioSession sharedInstance];
  NSError* err = nil;
  // Playback: audio continues with the silent switch on and in the background
  // (requires the "audio" UIBackgroundModes entry in Info.plist).
  if (![session setCategory:AVAudioSessionCategoryPlayback
                        mode:AVAudioSessionModeDefault
                     options:0
                       error:&err]) {
    NSLog(@"DJNexus: setCategory failed: %@", err);
    return false;
  }
  [session setPreferredSampleRate:sampleRate error:nil];
  const double frames = host->cfg.buffer_frames > 0 ? host->cfg.buffer_frames : 128;
  [session setPreferredIOBufferDuration:frames / sampleRate error:nil];
  if (![session setActive:YES error:&err]) {
    NSLog(@"DJNexus: setActive failed: %@", err);
    return false;
  }
  // Master + headphone cue on a 4-channel USB interface when available.
  host->channels = 2;
  if (host->cfg.output_channels == 4 && session.maximumOutputNumberOfChannels >= 4) {
    if ([session setPreferredOutputNumberOfChannels:4 error:nil] && session.outputNumberOfChannels >= 4) {
      host->channels = 4;
    }
  }
  return true;
}

bool createUnit(djn_host* host) {
  AudioComponentDescription desc{};
  desc.componentType = kAudioUnitType_Output;
  desc.componentSubType = kAudioUnitSubType_RemoteIO;
  desc.componentManufacturer = kAudioUnitManufacturer_Apple;
  AudioComponent comp = AudioComponentFindNext(nullptr, &desc);
  if (!comp || AudioComponentInstanceNew(comp, &host->unit) != noErr) return false;

  AudioStreamBasicDescription fmt{};
  fmt.mSampleRate = djn_engine_sample_rate(host->engine);
  fmt.mFormatID = kAudioFormatLinearPCM;
  fmt.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked | kAudioFormatFlagIsNonInterleaved;
  fmt.mBytesPerPacket = sizeof(float);
  fmt.mFramesPerPacket = 1;
  fmt.mBytesPerFrame = sizeof(float);
  fmt.mChannelsPerFrame = UInt32(host->channels);
  fmt.mBitsPerChannel = 32;
  // Input scope of the output element (bus 0) = the format we feed it.
  // RemoteIO converts to the hardware rate if the session rate differs.
  OSStatus st = AudioUnitSetProperty(host->unit, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 0, &fmt,
                                     sizeof(fmt));
  if (st != noErr) return false;

  UInt32 maxFrames = kMaxFramesPerSlice;
  AudioUnitSetProperty(host->unit, kAudioUnitProperty_MaximumFramesPerSlice, kAudioUnitScope_Global, 0, &maxFrames,
                       sizeof(maxFrames));

  AURenderCallbackStruct cb{renderCallback, host};
  st = AudioUnitSetProperty(host->unit, kAudioUnitProperty_SetRenderCallback, kAudioUnitScope_Input, 0, &cb,
                            sizeof(cb));
  if (st != noErr) return false;
  if (AudioUnitInitialize(host->unit) != noErr) return false;
  return AudioOutputUnitStart(host->unit) == noErr;
}

void destroyUnit(djn_host* host) {
  if (!host->unit) return;
  AudioOutputUnitStop(host->unit);
  AudioUnitUninitialize(host->unit);
  AudioComponentInstanceDispose(host->unit);
  host->unit = nullptr;
}

}  // namespace

extern "C" {

DJN_API int32_t djn_host_preferred_sample_rate(void) {
  AVAudioSession* session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayback error:nil];
  [session setActive:YES error:nil];
  const double rate = session.sampleRate;
  return rate > 0 ? int32_t(rate) : 48000;
}

DJN_API djn_host* djn_host_start(djn_engine* engine, const djn_host_config* config) {
  if (!engine) return nullptr;
  auto* host = new djn_host();
  host->engine = engine;
  if (config) host->cfg = *config;
  host->maxBlock = djn_engine_max_block_frames(engine);
  host->interleaved.assign(size_t(kMaxFramesPerSlice) * 4, 0.0f);

  if (!configureSession(host, djn_engine_sample_rate(engine)) || !createUnit(host)) {
    destroyUnit(host);
    delete host;
    return nullptr;
  }

  NSNotificationCenter* nc = [NSNotificationCenter defaultCenter];
  // Phone call / Siri: stop on begin, reactivate and restart on end.
  host->interruptionObserver = [nc
      addObserverForName:AVAudioSessionInterruptionNotification
                  object:nil
                   queue:[NSOperationQueue mainQueue]
              usingBlock:^(NSNotification* note) {
                const auto type = AVAudioSessionInterruptionType(
                    [note.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue]);
                if (type == AVAudioSessionInterruptionTypeBegan) {
                  if (host->unit) AudioOutputUnitStop(host->unit);
                } else {
                  [[AVAudioSession sharedInstance] setActive:YES error:nil];
                  if (host->unit) AudioOutputUnitStart(host->unit);
                }
              }];
  // The media server crashed: every audio object is invalid; rebuild.
  host->resetObserver = [nc addObserverForName:AVAudioSessionMediaServicesWereResetNotification
                                        object:nil
                                         queue:[NSOperationQueue mainQueue]
                                    usingBlock:^(NSNotification*) {
                                      destroyUnit(host);
                                      if (configureSession(host, djn_engine_sample_rate(host->engine))) {
                                        createUnit(host);
                                      }
                                    }];
  return host;
}

DJN_API void djn_host_stop(djn_host* host) {
  if (!host) return;
  NSNotificationCenter* nc = [NSNotificationCenter defaultCenter];
  if (host->interruptionObserver) [nc removeObserver:host->interruptionObserver];
  if (host->resetObserver) [nc removeObserver:host->resetObserver];
  destroyUnit(host);
  [[AVAudioSession sharedInstance] setActive:NO
                                 withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                       error:nil];
  delete host;
}

DJN_API int djn_host_get_info(const djn_host* host, djn_host_info* out) {
  if (!host || !out) return DJN_ERR_INVALID_ARG;
  std::memset(out, 0, sizeof(*out));
  AVAudioSession* session = [AVAudioSession sharedInstance];
  out->sample_rate = int32_t(session.sampleRate);
  out->buffer_frames = int32_t(session.IOBufferDuration * session.sampleRate + 0.5);
  out->output_channels = host->channels;
  out->output_latency_ms = 1000.0 * (session.outputLatency + session.IOBufferDuration);
  std::snprintf(out->backend, sizeof(out->backend), "remoteio");
  return DJN_OK;
}

}  // extern "C"
