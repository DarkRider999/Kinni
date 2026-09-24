// Single include point for miniaudio so every translation unit sees the same
// configuration. DJN_WITH_DEVICE_IO is set by CMake for desktop builds, where
// miniaudio also drives the audio device.
#pragma once

#if !defined(DJN_WITH_DEVICE_IO)
#define MA_NO_DEVICE_IO  // mobile builds use Oboe / RemoteIO for playback
#endif
#define MA_NO_ENCODING
#define MA_NO_GENERATION
#define MA_NO_RESOURCE_MANAGER
#define MA_NO_NODE_GRAPH
#define MA_NO_ENGINE

#include "miniaudio.h"
