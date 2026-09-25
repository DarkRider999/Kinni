// C API for stem separation (djn_separate_stems).
#include <functional>
#include <new>

#include "djnexus/djnexus.h"
#include "platform.h"
#include "separator.h"

DJN_API int djn_separate_stems(const float* interleaved, int64_t frames, int32_t channels, int32_t sample_rate,
                               float* drums, float* bass, float* vocals, djn_progress_fn progress, void* user) {
  int r = DJN_OK;
  bool cancelled = false;
  DJN_TRY {
    r = djn::stems::separate(interleaved, frames, channels, sample_rate, drums, bass, vocals, [&](float p) {
      if (progress && progress(user, p) != 0) cancelled = true;
      return !cancelled;
    });
  }
  DJN_CATCH_BAD_ALLOC(return DJN_ERR_NO_MEMORY)
  return cancelled ? DJN_ERR_CANCELLED : r;
}
