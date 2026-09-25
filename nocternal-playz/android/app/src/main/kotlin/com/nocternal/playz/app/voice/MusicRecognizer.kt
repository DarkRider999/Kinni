package com.nocternal.playz.app.voice

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder

data class RecognizedSong(val title: String, val artist: String, val album: String?, val link: String?)

/**
 * Music recognition (spec §4/§11.19): records ~8 s from the microphone — so it hears music from any app
 * or speaker nearby — and identifies it with the AudD API (user-supplied token in Settings).
 */
class MusicRecognizer(private val token: () -> String?) {

    @SuppressLint("MissingPermission")
    suspend fun listenAndIdentify(seconds: Int = 8): Result<RecognizedSong?> = withContext(Dispatchers.IO) {
        val key = token() ?: return@withContext Result.failure(IllegalStateException("Add a music-recognition token in Settings → AI"))
        runCatching {
            val rate = 16000
            val minBuf = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val rec = AudioRecord(MediaRecorder.AudioSource.MIC, rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 4)
            val pcm = ByteArrayOutputStream()
            try {
                rec.startRecording()
                val buf = ByteArray(minBuf)
                val target = rate * 2 * seconds
                while (pcm.size() < target) { val n = rec.read(buf, 0, buf.size); if (n > 0) pcm.write(buf, 0, n) else break }
            } finally { rec.stop(); rec.release() }
            identify(wav(pcm.toByteArray(), rate), key)
        }
    }

    private fun identify(wav: ByteArray, key: String): RecognizedSong? {
        val boundary = "----nocternal${System.nanoTime()}"
        val c = URL("https://api.audd.io/").openConnection() as HttpURLConnection
        try {
            c.doOutput = true; c.requestMethod = "POST"; c.connectTimeout = 10000; c.readTimeout = 20000
            c.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            DataOutputStream(c.outputStream).use { out ->
                fun field(name: String, value: String) { out.writeBytes("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n") }
                field("api_token", key); field("return", "spotify")
                out.writeBytes("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"clip.wav\"\r\nContent-Type: audio/wav\r\n\r\n")
                out.write(wav); out.writeBytes("\r\n--$boundary--\r\n")
            }
            val body = c.inputStream.bufferedReader().readText()
            val root = Json.parseToJsonElement(body).jsonObject
            val result = root["result"] as? JsonObject ?: return null
            fun s(k: String) = result[k]?.jsonPrimitive?.contentOrNull
            return RecognizedSong(s("title") ?: return null, s("artist").orEmpty(), s("album"), s("song_link"))
        } finally { c.disconnect() }
    }

    private fun wav(pcm: ByteArray, rate: Int): ByteArray {
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray()); putInt(36 + pcm.size); put("WAVE".toByteArray())
            put("fmt ".toByteArray()); putInt(16); putShort(1); putShort(1); putInt(rate); putInt(rate * 2); putShort(2); putShort(16)
            put("data".toByteArray()); putInt(pcm.size)
        }
        return header.array() + pcm
    }
}
