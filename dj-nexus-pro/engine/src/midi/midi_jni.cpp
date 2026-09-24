// JNI entry points for android/com/djnexus/engine/DjnMidi.kt, which receives
// MIDI from android.media.midi and passes the bytes to the engine.
#include <jni.h>

#include <cstdint>

#include "djnexus/djnexus.h"

namespace {
djn_midi* fromHandle(jlong handle) { return reinterpret_cast<djn_midi*>(static_cast<intptr_t>(handle)); }
}  // namespace

extern "C" JNIEXPORT void JNICALL Java_com_djnexus_engine_DjnMidi_nativeFeed(JNIEnv* env, jclass, jlong handle,
                                                                            jbyteArray data, jint offset, jint count) {
  djn_midi* m = fromHandle(handle);
  if (!m || !data || offset < 0 || count <= 0 || offset + count > env->GetArrayLength(data)) return;
  jbyte* bytes = env->GetByteArrayElements(data, nullptr);
  if (!bytes) return;
  djn_midi_feed(m, reinterpret_cast<const uint8_t*>(bytes + offset), count);
  env->ReleaseByteArrayElements(data, bytes, JNI_ABORT);  // read-only: nothing to copy back
}

extern "C" JNIEXPORT jint JNICALL Java_com_djnexus_engine_DjnMidi_nativeReadOutput(JNIEnv* env, jclass, jlong handle,
                                                                                  jbyteArray buffer) {
  djn_midi* m = fromHandle(handle);
  if (!m || !buffer) return 0;
  const jsize size = env->GetArrayLength(buffer);
  jbyte* bytes = env->GetByteArrayElements(buffer, nullptr);
  if (!bytes) return 0;
  const int32_t n = djn_midi_read_output(m, reinterpret_cast<uint8_t*>(bytes), size);
  env->ReleaseByteArrayElements(buffer, bytes, 0);
  return n;
}
