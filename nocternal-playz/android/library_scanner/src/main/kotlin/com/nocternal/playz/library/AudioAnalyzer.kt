package com.nocternal.playz.library

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import com.nocternal.playz.fx.analysis.AnalysisResult
import com.nocternal.playz.fx.analysis.TrackAnalyzer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.ByteOrder

/**
 * Decodes up to [maxSeconds] from the middle of a track with MediaCodec (mono, 16-bit) and runs the shared
 * [TrackAnalyzer] for BPM, key, loudness and energy. Runs in the background after a scan.
 */
class AudioAnalyzer(private val context: Context, private val maxSeconds: Int = 45) {

    suspend fun analyze(uri: String, durationMs: Long): AnalysisResult? = withContext(Dispatchers.Default) {
        runCatching { decode(Uri.parse(uri), durationMs) }.getOrNull()?.let { (pcm, rate) ->
            if (pcm.size < rate * 5) null else TrackAnalyzer.analyze(pcm, rate)
        }
    }

    private fun decode(uri: Uri, durationMs: Long): Pair<FloatArray, Int>? {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, uri, null)
            val trackIndex = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return null
            extractor.selectTrack(trackIndex)
            val format = extractor.getTrackFormat(trackIndex)
            val rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            // Start in the middle third, where the beat is established.
            if (durationMs > maxSeconds * 2000L) extractor.seekTo(durationMs * 1000 / 3, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

            val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
            codec.configure(format, null, null, 0)
            codec.start()
            val target = rate * maxSeconds
            val out = FloatArray(target)
            var written = 0
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            try {
                while (written < target) {
                    if (!inputDone) {
                        val inIdx = codec.dequeueInputBuffer(10_000)
                        if (inIdx >= 0) {
                            val buf = codec.getInputBuffer(inIdx)!!
                            val n = extractor.readSampleData(buf, 0)
                            if (n < 0) { codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true }
                            else { codec.queueInputBuffer(inIdx, 0, n, extractor.sampleTime, 0); extractor.advance() }
                        }
                    }
                    val outIdx = codec.dequeueOutputBuffer(info, 10_000)
                    if (outIdx >= 0) {
                        val buf = codec.getOutputBuffer(outIdx)!!.order(ByteOrder.nativeOrder())
                        buf.position(info.offset); buf.limit(info.offset + info.size)
                        val shorts = buf.asShortBuffer()
                        val frames = shorts.remaining() / channels
                        for (f in 0 until frames) {
                            if (written >= target) break
                            var sum = 0f
                            for (ch in 0 until channels) sum += shorts.get() / 32768f
                            out[written++] = sum / channels
                        }
                        codec.releaseOutputBuffer(outIdx, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                    } else if (inputDone && outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) break
                }
            } finally {
                codec.stop(); codec.release()
            }
            return out.copyOf(written) to rate
        } finally {
            extractor.release()
        }
    }
}
