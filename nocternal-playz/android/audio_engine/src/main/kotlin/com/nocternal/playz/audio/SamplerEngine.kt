package com.nocternal.playz.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.SoundPool
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

/**
 * Generates and plays synthetic percussive one-shot sounds for the 8 DJ sampler pads.
 * No audio assets are needed — all waveforms are synthesized at startup.
 *
 * Pad index mapping (matches DjHubScreen pad order):
 *   0=KICK, 1=SNARE, 2=HI-HAT, 3=CLAP, 4=BASS DROP, 5=FX1, 6=FX2, 7=LOOP
 */
class SamplerEngine(private val scope: CoroutineScope) {

    companion object {
        private const val SAMPLE_RATE = 44100
        private const val PAD_COUNT = 8
    }

    private val pool: SoundPool = SoundPool.Builder()
        .setMaxStreams(PAD_COUNT)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        )
        .build()

    // SoundPool sound IDs for each pad — loaded at startup
    private val soundIds = IntArray(PAD_COUNT) { -1 }

    init {
        scope.launch {
            loadAll()
        }
    }

    private fun loadAll() {
        soundIds[0] = loadRaw(synthesizeKick())
        soundIds[1] = loadRaw(synthesizeSnare())
        soundIds[2] = loadRaw(synthesizeHiHat())
        soundIds[3] = loadRaw(synthesizeClap())
        soundIds[4] = loadRaw(synthesizeBassDrop())
        soundIds[5] = loadRaw(synthesizeFx1())
        soundIds[6] = loadRaw(synthesizeFx2())
        soundIds[7] = loadRaw(synthesizeLoop())
    }

    /** Trigger pad at [index] (0-7). No-op if sound not ready. */
    fun trigger(index: Int) {
        if (index !in 0 until PAD_COUNT) return
        val id = soundIds[index]
        if (id > 0) pool.play(id, 1f, 1f, 1, 0, 1f)
    }

    fun release() {
        pool.release()
    }

    // ---- Synthesis helpers ----------------------------------------------------------------

    /** Loads raw 16-bit PCM shorts into SoundPool via a temporary AudioTrack write. */
    private fun loadRaw(pcm: ShortArray): Int {
        // SoundPool.load(AssetFileDescriptor) is the standard API; for programmatic PCM we
        // create a WAV in-memory and load it via a temporary file in the app's cache dir.
        // We use the internal trick: write through an AudioTrack to a ByteArray then wrap it.
        val wavBytes = pcmToWav(pcm, SAMPLE_RATE)
        val tmp = java.io.File.createTempFile("pad_", ".wav")
        tmp.writeBytes(wavBytes)
        val id = pool.load(tmp.absolutePath, 1)
        tmp.delete()
        return id
    }

    private fun pcmToWav(pcm: ShortArray, sampleRate: Int): ByteArray {
        val dataSize = pcm.size * 2
        val buf = java.io.ByteArrayOutputStream(44 + dataSize)
        val le = java.nio.ByteOrder.LITTLE_ENDIAN
        fun Int.toLeBytes(n: Int) = java.nio.ByteBuffer.allocate(n).order(le).also {
            if (n == 4) it.putInt(this) else it.putShort(this.toShort())
        }.array()

        // RIFF header
        buf.write("RIFF".toByteArray())
        buf.write((36 + dataSize).toLeBytes(4))
        buf.write("WAVE".toByteArray())
        buf.write("fmt ".toByteArray())
        buf.write(16.toLeBytes(4))         // chunk size
        buf.write(1.toLeBytes(2))           // PCM
        buf.write(1.toLeBytes(2))           // mono
        buf.write(sampleRate.toLeBytes(4))
        buf.write((sampleRate * 2).toLeBytes(4)) // byte rate
        buf.write(2.toLeBytes(2))           // block align
        buf.write(16.toLeBytes(2))          // bits/sample
        buf.write("data".toByteArray())
        buf.write(dataSize.toLeBytes(4))
        for (s in pcm) {
            buf.write(s.toInt() and 0xFF)
            buf.write((s.toInt() shr 8) and 0xFF)
        }
        return buf.toByteArray()
    }

    private fun samples(durationMs: Int) = (SAMPLE_RATE * durationMs / 1000)

    private fun short(v: Float): Short = (v.coerceIn(-1f, 1f) * 32767f).toInt().toShort()

    // ---- Percussive waveform generators --------------------------------------------------

    private fun synthesizeKick(): ShortArray {
        val n = samples(400)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 15.0)
            val freq = 60.0 * exp(-t * 20.0) + 30.0
            short((env * sin(2.0 * PI * freq * t)).toFloat())
        }
    }

    private fun synthesizeSnare(): ShortArray {
        val n = samples(200)
        val rng = java.util.Random(42)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 20.0)
            val tone = sin(2.0 * PI * 200.0 * t) * 0.4
            val noise = (rng.nextDouble() * 2.0 - 1.0) * 0.6
            short(((tone + noise) * env).toFloat())
        }
    }

    private fun synthesizeHiHat(): ShortArray {
        val n = samples(80)
        val rng = java.util.Random(99)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 60.0)
            val noise = rng.nextDouble() * 2.0 - 1.0
            short((noise * env * 0.8).toFloat())
        }
    }

    private fun synthesizeClap(): ShortArray {
        val n = samples(150)
        val rng = java.util.Random(7)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 30.0)
            val noise = rng.nextDouble() * 2.0 - 1.0
            val tone = sin(2.0 * PI * 1000.0 * t) * 0.2
            short(((noise * 0.8 + tone) * env).toFloat())
        }
    }

    private fun synthesizeBassDrop(): ShortArray {
        val n = samples(600)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 8.0)
            val freq = 40.0 + 80.0 * exp(-t * 5.0)
            short((env * sin(2.0 * PI * freq * t)).toFloat())
        }
    }

    private fun synthesizeFx1(): ShortArray {
        // Rising sweep
        val n = samples(300)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.1) t / 0.1 else exp(-(t - 0.1) * 10.0)
            val freq = 300.0 + 2000.0 * (t / 0.3)
            short((env * sin(2.0 * PI * freq * t) * 0.7).toFloat())
        }
    }

    private fun synthesizeFx2(): ShortArray {
        // Descending laser
        val n = samples(250)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 8.0)
            val freq = 2000.0 * exp(-t * 6.0) + 200.0
            short((env * sin(2.0 * PI * freq * t) * 0.7).toFloat())
        }
    }

    private fun synthesizeLoop(): ShortArray {
        // 4-beat rhythmic loop at 128 BPM: kick on beat 1 & 3, hi-hat on all 4
        val beatSamples = (SAMPLE_RATE * 60.0 / 128.0).toInt()
        val n = beatSamples * 4
        val buf = FloatArray(n)
        val rng = java.util.Random(13)
        for (beat in 0..3) {
            val offset = beat * beatSamples
            // hi-hat on every beat
            for (i in 0 until 1000) {
                val t = i.toDouble() / SAMPLE_RATE
                buf[offset + i] += (rng.nextDouble() * 2.0 - 1.0).toFloat() * exp(-t * 60.0).toFloat() * 0.5f
            }
            // kick on beats 0 and 2
            if (beat == 0 || beat == 2) {
                for (i in 0 until minOf(samples(400), n - offset)) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val env = exp(-t * 15.0)
                    val freq = 60.0 * exp(-t * 20.0) + 30.0
                    buf[offset + i] += (env * sin(2.0 * PI * freq * t)).toFloat()
                }
            }
        }
        return ShortArray(n) { short(buf[it]) }
    }
}
