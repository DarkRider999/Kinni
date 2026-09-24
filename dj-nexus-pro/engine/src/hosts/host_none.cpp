// Headless builds (tests, servers, offline rendering): no audio device.
// The app calls djn_engine_process() itself.
#include "djnexus/djnexus.h"

extern "C" {

DJN_API int32_t djn_host_preferred_sample_rate(void) { return 48000; }
DJN_API djn_host* djn_host_start(djn_engine*, const djn_host_config*) { return nullptr; }
DJN_API void djn_host_stop(djn_host*) {}
DJN_API int djn_host_get_info(const djn_host*, djn_host_info*) { return DJN_ERR_UNSUPPORTED; }

}  // extern "C"
