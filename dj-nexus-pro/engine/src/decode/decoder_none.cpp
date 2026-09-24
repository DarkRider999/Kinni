// Used when the library is built with DJN_WITH_DECODER=OFF: the app decodes
// files itself (MediaCodec / AVAudioFile) and calls djn_deck_load_pcm().
#include "decoder.h"

#include "djnexus/djnexus.h"

namespace djn {

int decodeFile(const char*, DecodedAudio&) { return DJN_ERR_UNSUPPORTED; }

}  // namespace djn
