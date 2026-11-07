package com.nocternal.playz.library

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import com.nocternal.playz.fx.analysis.WaveformPeaks
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.ByteOrder

/**
 * Builds a waveform preview spanning the WHOLE track (unlike [AudioAnalyzer], which only samples the middle
 * third for BPM/key). Rather than decoding every sample, it seeks to [bins] evenly spaced points and decodes a
 * short burst at each one, keeping total decode time bounded regardless of track length.
 */
class WaveformExtractor(private val context: Context, private val bins: Int = 120, private val burstMs: Int = 120) {

    suspend fun extract(uri: String, durationMs: Long): List<Float>? = withContext(Dispatchers.Default) {
        if (durationMs <= 0L) return@withContext null
        runCatching {
            val raw = FloatArray(bins)
            for (i in 0 until bins) {
                val atMs = (durationMs * i / bins).coerceIn(0, (durationMs - 1).coerceAtLeast(0))
                raw[i] = peakAt(Uri.parse(uri), atMs) ?: 0f
            }
            WaveformPeaks.normalize(raw)
        }.getOrNull()
    }

    private fun peakAt(uri: Uri, atMs: Long): Float? {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, uri, null)
            val trackIndex = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return null
            extractor.selectTrack(trackIndex)
            val format = extractor.getTrackFormat(trackIndex)
            val channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            extractor.seekTo(atMs * 1000, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

            val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
            codec.configure(format, null, null, 0)
            codec.start()
            val targetFrames = (format.getInteger(MediaFormat.KEY_SAMPLE_RATE) * burstMs / 1000)
            var peak = 0f
            var framesSeen = 0
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            try {
                while (framesSeen < targetFrames) {
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
                            var sum = 0f
                            for (ch in 0 until channels) sum += kotlin.math.abs(shorts.get() / 32768f)
                            peak = maxOf(peak, sum / channels)
                            framesSeen++
                        }
                        codec.releaseOutputBuffer(outIdx, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                    } else if (inputDone && outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) break
                }
            } finally {
                codec.stop(); codec.release()
            }
            return peak
        } finally {
            extractor.release()
        }
    }
}
