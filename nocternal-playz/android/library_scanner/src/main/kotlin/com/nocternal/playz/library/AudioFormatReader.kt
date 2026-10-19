package com.nocternal.playz.library

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Container/codec facts read straight off the file - no decode, no DSP. Any field can be unavailable. */
data class AudioFormatInfo(
    val codec: String?,
    val bitrateKbps: Int?,
    val sampleRateHz: Int?,
    val channels: Int?,
)

/**
 * Audio Inspector (spec #11): reads bitrate/codec/sample rate/channel count straight from the
 * container via [MediaExtractor] - metadata only, the same API [AudioAnalyzer] already uses to read
 * the format before decoding, just without the decode step. Bit depth and dynamic range aren't
 * included: most mobile formats (MP3/AAC) don't carry a meaningful bit depth, and dynamic range
 * needs a full-track decode pass this reader deliberately doesn't do.
 */
class AudioFormatReader(private val context: Context) {
    suspend fun read(uri: String): AudioFormatInfo? = withContext(Dispatchers.IO) {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, Uri.parse(uri), null)
            val trackIndex = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return@withContext null
            val format = extractor.getTrackFormat(trackIndex)
            fun intOrNull(key: String) = if (format.containsKey(key)) format.getInteger(key) else null
            AudioFormatInfo(
                codec = codecLabel(format.getString(MediaFormat.KEY_MIME)),
                bitrateKbps = intOrNull(MediaFormat.KEY_BIT_RATE)?.let { it / 1000 },
                sampleRateHz = intOrNull(MediaFormat.KEY_SAMPLE_RATE),
                channels = intOrNull(MediaFormat.KEY_CHANNEL_COUNT),
            )
        } catch (e: Exception) {
            null
        } finally {
            extractor.release()
        }
    }

    private fun codecLabel(mime: String?): String? = when (mime) {
        "audio/mpeg" -> "MP3"
        "audio/mp4a-latm" -> "AAC"
        "audio/flac" -> "FLAC"
        "audio/x-wav", "audio/wav", "audio/x-wav-pcm" -> "WAV (PCM)"
        "audio/vorbis" -> "Ogg Vorbis"
        "audio/opus" -> "Opus"
        "audio/x-ms-wma" -> "WMA"
        null -> null
        else -> mime.removePrefix("audio/")
    }
}
