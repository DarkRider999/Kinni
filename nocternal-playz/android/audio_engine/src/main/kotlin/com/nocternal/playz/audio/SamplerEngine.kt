package com.nocternal.playz.audio

import android.media.AudioAttributes
import android.media.SoundPool
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.sin

/**
 * Generates and plays synthetic one-shot sounds for the 8 DJ sampler pads across 4 named banks.
 *
 * Bank 0 — Festival FX:   KICK, SNARE, HI-HAT, CLAP, BASS DROP, FX1, FX2, LOOP
 * Bank 1 — Air Horns:     HORN 1, HORN 2, FANFARE, STAB, SWEEP UP, SWEEP DN, FOGHORN, SIREN
 * Bank 2 — Crowd Effects: CHEER, CLAP, BOO, WHISTLE, SCREAM, APPLAUSE, ROAR, DROP
 * Bank 3 — Bollywood FX:  DHOL L, DHOL H, TABLA, DHOLAK, TAAN, SHEHNAI, SITAR, DRAMA
 */
class SamplerEngine(private val scope: CoroutineScope) {

    companion object {
        private const val SAMPLE_RATE = 44100
        const val PAD_COUNT = 8
        const val BANK_COUNT = 4
        val BANK_NAMES = arrayOf("Festival FX", "Air Horns", "Crowd Effects", "Bollywood FX")
        val PAD_LABELS = arrayOf(
            arrayOf("KICK", "SNARE", "HI-HAT", "CLAP", "BASS DROP", "FX1", "FX2", "LOOP"),
            arrayOf("HORN 1", "HORN 2", "FANFARE", "STAB", "SWEEP ↑", "SWEEP ↓", "FOGHORN", "SIREN"),
            arrayOf("CHEER", "CLAP", "BOO", "WHISTLE", "SCREAM", "APPLAUSE", "ROAR", "DROP"),
            arrayOf("DHOL L", "DHOL H", "TABLA", "DHOLAK", "TAAN", "SHEHNAI", "SITAR", "DRAMA"),
        )
    }

    private val pool: SoundPool = SoundPool.Builder()
        .setMaxStreams(PAD_COUNT * BANK_COUNT)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        )
        .build()

    // soundIds[bank][pad] — loaded at startup
    private val soundIds = Array(BANK_COUNT) { IntArray(PAD_COUNT) { -1 } }

    init {
        scope.launch { runCatching { loadAllBanks() }.onFailure { e -> android.util.Log.e("NocternalDB", "DB write failed", e) } }
    }

    private fun loadAllBanks() {
        // Bank 0: Festival FX
        soundIds[0][0] = loadRaw(synthesizeKick())
        soundIds[0][1] = loadRaw(synthesizeSnare())
        soundIds[0][2] = loadRaw(synthesizeHiHat())
        soundIds[0][3] = loadRaw(synthesizeClap())
        soundIds[0][4] = loadRaw(synthesizeBassDrop())
        soundIds[0][5] = loadRaw(synthesizeFx1())
        soundIds[0][6] = loadRaw(synthesizeFx2())
        soundIds[0][7] = loadRaw(synthesizeLoop())
        // Bank 1: Air Horns
        soundIds[1][0] = loadRaw(synthesizeHorn1())
        soundIds[1][1] = loadRaw(synthesizeHorn2())
        soundIds[1][2] = loadRaw(synthesizeFanfare())
        soundIds[1][3] = loadRaw(synthesizeHornStab())
        soundIds[1][4] = loadRaw(synthesizeHornSweepUp())
        soundIds[1][5] = loadRaw(synthesizeHornSweepDn())
        soundIds[1][6] = loadRaw(synthesizeFoghorn())
        soundIds[1][7] = loadRaw(synthesizeSiren())
        // Bank 2: Crowd Effects
        soundIds[2][0] = loadRaw(synthesizeCheer())
        soundIds[2][1] = loadRaw(synthesizeCrowdClap())
        soundIds[2][2] = loadRaw(synthesizeBoo())
        soundIds[2][3] = loadRaw(synthesizeWhistle())
        soundIds[2][4] = loadRaw(synthesizeScream())
        soundIds[2][5] = loadRaw(synthesizeApplause())
        soundIds[2][6] = loadRaw(synthesizeRoar())
        soundIds[2][7] = loadRaw(synthesizeCrowdDrop())
        // Bank 3: Bollywood FX
        soundIds[3][0] = loadRaw(synthesizeDholLow())
        soundIds[3][1] = loadRaw(synthesizeDholHigh())
        soundIds[3][2] = loadRaw(synthesizeTabla())
        soundIds[3][3] = loadRaw(synthesizeDholak())
        soundIds[3][4] = loadRaw(synthesizeTaan())
        soundIds[3][5] = loadRaw(synthesizeShehnai())
        soundIds[3][6] = loadRaw(synthesizeSitar())
        soundIds[3][7] = loadRaw(synthesizeDrama())
    }

    /** Trigger pad [index] in [bank]. No-op if sound not ready or indices out of range. */
    fun trigger(bank: Int, index: Int) {
        if (bank !in 0 until BANK_COUNT || index !in 0 until PAD_COUNT) return
        val id = soundIds[bank][index]
        if (id > 0) pool.play(id, 1f, 1f, 1, 0, 1f)
    }

    fun release() {
        pool.release()
    }

    // ---- WAV helpers ------------------------------------------------------------------

    private fun loadRaw(pcm: ShortArray): Int {
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
        buf.write("RIFF".toByteArray())
        buf.write((36 + dataSize).toLeBytes(4))
        buf.write("WAVE".toByteArray())
        buf.write("fmt ".toByteArray())
        buf.write(16.toLeBytes(4))
        buf.write(1.toLeBytes(2))
        buf.write(1.toLeBytes(2))
        buf.write(sampleRate.toLeBytes(4))
        buf.write((sampleRate * 2).toLeBytes(4))
        buf.write(2.toLeBytes(2))
        buf.write(16.toLeBytes(2))
        buf.write("data".toByteArray())
        buf.write(dataSize.toLeBytes(4))
        for (s in pcm) {
            buf.write(s.toInt() and 0xFF)
            buf.write((s.toInt() shr 8) and 0xFF)
        }
        return buf.toByteArray()
    }

    private fun samples(durationMs: Int) = SAMPLE_RATE * durationMs / 1000

    private fun short(v: Float): Short = (v.coerceIn(-1f, 1f) * 32767f).toInt().toShort()

    // ---- Bank 0: Festival FX ----------------------------------------------------------

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
        val n = samples(300)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.1) t / 0.1 else exp(-(t - 0.1) * 10.0)
            val freq = 300.0 + 2000.0 * (t / 0.3)
            short((env * sin(2.0 * PI * freq * t) * 0.7).toFloat())
        }
    }

    private fun synthesizeFx2(): ShortArray {
        val n = samples(250)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 8.0)
            val freq = 2000.0 * exp(-t * 6.0) + 200.0
            short((env * sin(2.0 * PI * freq * t) * 0.7).toFloat())
        }
    }

    private fun synthesizeLoop(): ShortArray {
        val beatSamples = (SAMPLE_RATE * 60.0 / 128.0).toInt()
        val n = beatSamples * 4
        val buf = FloatArray(n)
        val rng = java.util.Random(13)
        for (beat in 0..3) {
            val offset = beat * beatSamples
            for (i in 0 until 1000) {
                val t = i.toDouble() / SAMPLE_RATE
                buf[offset + i] += (rng.nextDouble() * 2.0 - 1.0).toFloat() * exp(-t * 60.0).toFloat() * 0.5f
            }
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

    // ---- Bank 1: Air Horns ------------------------------------------------------------

    private fun sawtooth(freq: Double, t: Double, harmonics: Int = 6): Double {
        var v = 0.0
        for (h in 1..harmonics) v += sin(2.0 * PI * freq * h * t) / h
        return v * (2.0 / PI)
    }

    private fun synthesizeHorn1(): ShortArray {
        val n = samples(800)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val attack = if (t < 0.05) t / 0.05 else 1.0
            val release = if (t > 0.65) exp(-(t - 0.65) * 20.0) else 1.0
            short((sawtooth(220.0, t) * attack * release * 0.6).toFloat())
        }
    }

    private fun synthesizeHorn2(): ShortArray {
        val n = samples(600)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val attack = if (t < 0.03) t / 0.03 else 1.0
            val release = if (t > 0.5) exp(-(t - 0.5) * 25.0) else 1.0
            short((sawtooth(330.0, t) * attack * release * 0.6).toFloat())
        }
    }

    private fun synthesizeFanfare(): ShortArray {
        val notes = listOf(261.63, 329.63, 392.0, 523.25)
        val noteDurMs = 120
        val n = samples(noteDurMs * notes.size + 50)
        val buf = FloatArray(n)
        notes.forEachIndexed { idx, freq ->
            val offset = samples(noteDurMs * idx)
            val noteN = minOf(samples(noteDurMs), n - offset)
            for (i in 0 until noteN) {
                val t = i.toDouble() / SAMPLE_RATE
                val env = if (t < 0.01) t / 0.01 else exp(-(t - 0.01) * 15.0)
                buf[offset + i] += (sawtooth(freq, t) * env * 0.5).toFloat()
            }
        }
        return ShortArray(n) { short(buf[it]) }
    }

    private fun synthesizeHornStab(): ShortArray {
        val n = samples(300)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.02) t / 0.02 else exp(-(t - 0.02) * 18.0)
            short((sawtooth(277.18, t) * env * 0.7).toFloat())
        }
    }

    private fun synthesizeHornSweepUp(): ShortArray {
        val n = samples(500)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val freq = 150.0 + 450.0 * (t / 0.5)
            val env = if (t < 0.03) t / 0.03 else if (t > 0.45) exp(-(t - 0.45) * 20.0) else 1.0
            short((sawtooth(freq, t) * env * 0.55).toFloat())
        }
    }

    private fun synthesizeHornSweepDn(): ShortArray {
        val n = samples(500)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val freq = 600.0 - 450.0 * (t / 0.5)
            val env = if (t < 0.03) t / 0.03 else if (t > 0.45) exp(-(t - 0.45) * 20.0) else 1.0
            short((sawtooth(freq, t) * env * 0.55).toFloat())
        }
    }

    private fun synthesizeFoghorn(): ShortArray {
        val n = samples(1200)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val attack = if (t < 0.1) t / 0.1 else 1.0
            val release = if (t > 1.0) exp(-(t - 1.0) * 15.0) else 1.0
            val vibrato = 1.0 + 0.01 * sin(2.0 * PI * 5.0 * t)
            short((sawtooth(110.0 * vibrato, t) * attack * release * 0.65).toFloat())
        }
    }

    private fun synthesizeSiren(): ShortArray {
        val n = samples(1000)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val freq = 600.0 + 200.0 * sin(2.0 * PI * 1.5 * t)
            val env = if (t < 0.05) t / 0.05 else if (t > 0.9) exp(-(t - 0.9) * 20.0) else 1.0
            short((sin(2.0 * PI * freq * t) * env * 0.7).toFloat())
        }
    }

    // ---- Bank 2: Crowd Effects --------------------------------------------------------

    private fun synthesizeCheer(): ShortArray {
        val n = samples(1200)
        val rng = java.util.Random(101)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val rise = (t / 0.4).coerceIn(0.0, 1.0)
            val fall = if (t > 0.8) exp(-(t - 0.8) * 4.0) else 1.0
            val noise = rng.nextDouble() * 2.0 - 1.0
            val hi = sin(2.0 * PI * 1200.0 * t + noise) * 0.3
            val mid = sin(2.0 * PI * 400.0 * t + noise * 0.5) * 0.4
            short(((noise * 0.3 + hi + mid) * rise * fall * 0.7).toFloat())
        }
    }

    private fun synthesizeCrowdClap(): ShortArray {
        val beatSamples = (SAMPLE_RATE * 60.0 / 120.0).toInt()
        val n = beatSamples * 4
        val buf = FloatArray(n)
        val rng = java.util.Random(55)
        for (beat in 0..3) {
            val offset = beat * beatSamples
            for (i in 0 until minOf(samples(80), n - offset)) {
                val t = i.toDouble() / SAMPLE_RATE
                val env = exp(-t * 35.0)
                val noise = rng.nextDouble() * 2.0 - 1.0
                buf[offset + i] += (noise * env * 0.8).toFloat()
            }
        }
        return ShortArray(n) { short(buf[it]) }
    }

    private fun synthesizeBoo(): ShortArray {
        val n = samples(1000)
        val rng = java.util.Random(77)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.1) t / 0.1 else if (t > 0.8) exp(-(t - 0.8) * 10.0) else 1.0
            val noise = rng.nextDouble() * 2.0 - 1.0
            val vowel = sin(2.0 * PI * 180.0 * t) * 0.5 + sin(2.0 * PI * 360.0 * t) * 0.3
            short(((noise * 0.2 + vowel) * env * 0.6).toFloat())
        }
    }

    private fun synthesizeWhistle(): ShortArray {
        val n = samples(600)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.05) t / 0.05 else if (t > 0.5) exp(-(t - 0.5) * 20.0) else 1.0
            val vibrato = 1.0 + 0.03 * sin(2.0 * PI * 8.0 * t)
            short((sin(2.0 * PI * 2500.0 * vibrato * t) * env * 0.7).toFloat())
        }
    }

    private fun synthesizeScream(): ShortArray {
        val n = samples(500)
        val rng = java.util.Random(33)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.03) t / 0.03 else exp(-(t - 0.03) * 8.0)
            val noise = rng.nextDouble() * 2.0 - 1.0
            val pitch = sin(2.0 * PI * 800.0 * t) * 0.4
            short(((noise * 0.6 + pitch) * env * 0.75).toFloat())
        }
    }

    private fun synthesizeApplause(): ShortArray {
        val n = samples(1500)
        val rng = java.util.Random(88)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val attack = (t / 0.3).coerceIn(0.0, 1.0)
            val release = if (t > 1.2) exp(-(t - 1.2) * 5.0) else 1.0
            val flutter = 0.5 + 0.5 * abs(sin(2.0 * PI * 6.0 * t))
            val noise = rng.nextDouble() * 2.0 - 1.0
            short((noise * flutter * attack * release * 0.6).toFloat())
        }
    }

    private fun synthesizeRoar(): ShortArray {
        val n = samples(2000)
        val rng = java.util.Random(44)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.5) t / 0.5 else if (t > 1.5) exp(-(t - 1.5) * 5.0) else 1.0
            val noise = rng.nextDouble() * 2.0 - 1.0
            val low = sin(2.0 * PI * 100.0 * t) * 0.3
            short(((noise * 0.5 + low) * env * 0.65).toFloat())
        }
    }

    private fun synthesizeCrowdDrop(): ShortArray {
        val n = samples(1000)
        val rng = java.util.Random(22)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 4.0)
            val noise = rng.nextDouble() * 2.0 - 1.0
            short((noise * env * 0.6).toFloat())
        }
    }

    // ---- Bank 3: Bollywood FX --------------------------------------------------------

    private fun synthesizeDholLow(): ShortArray {
        val n = samples(500)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 10.0)
            val freq = 80.0 * exp(-t * 5.0) + 50.0
            short((env * sin(2.0 * PI * freq * t) * 0.9).toFloat())
        }
    }

    private fun synthesizeDholHigh(): ShortArray {
        val n = samples(250)
        val rng = java.util.Random(61)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 25.0)
            val tone = sin(2.0 * PI * 300.0 * t) * 0.6
            val noise = (rng.nextDouble() * 2.0 - 1.0) * 0.4
            short(((tone + noise) * env).toFloat())
        }
    }

    private fun synthesizeTabla(): ShortArray {
        val n = samples(400)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 15.0)
            val fundamental = sin(2.0 * PI * 200.0 * t)
            val h2 = sin(2.0 * PI * 400.0 * t) * 0.3
            val h3 = sin(2.0 * PI * 580.0 * t) * 0.15
            short(((fundamental + h2 + h3) * env * 0.7).toFloat())
        }
    }

    private fun synthesizeDholak(): ShortArray {
        val n = samples(450)
        val rng = java.util.Random(71)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 12.0)
            val tone = sin(2.0 * PI * 150.0 * t) * 0.7 + sin(2.0 * PI * 300.0 * t) * 0.2
            val noise = (rng.nextDouble() * 2.0 - 1.0) * 0.1
            short(((tone + noise) * env).toFloat())
        }
    }

    private fun synthesizeTaan(): ShortArray {
        val n = samples(400)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = if (t < 0.05) t / 0.05 else exp(-(t - 0.05) * 8.0)
            val freq = 500.0 + 700.0 * (t / 0.4)
            short((sin(2.0 * PI * freq * t) * env * 0.65).toFloat())
        }
    }

    private fun synthesizeShehnai(): ShortArray {
        val n = samples(600)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val attack = if (t < 0.04) t / 0.04 else 1.0
            val release = if (t > 0.5) exp(-(t - 0.5) * 20.0) else 1.0
            val env = attack * release
            val v = sin(2.0 * PI * 523.0 * t) +
                    sin(2.0 * PI * 1046.0 * t) * 0.5 +
                    sin(2.0 * PI * 1569.0 * t) * 0.35 +
                    sin(2.0 * PI * 2092.0 * t) * 0.2
            short((v * env * 0.3).toFloat())
        }
    }

    private fun synthesizeSitar(): ShortArray {
        val n = samples(700)
        val rng = java.util.Random(91)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 8.0)
            val pluck = sin(2.0 * PI * 220.0 * t) + sin(2.0 * PI * 440.0 * t) * 0.4
            val buzz = (rng.nextDouble() * 2.0 - 1.0) * exp(-t * 30.0) * 0.3
            short(((pluck + buzz) * env * 0.5).toFloat())
        }
    }

    private fun synthesizeDrama(): ShortArray {
        val n = samples(800)
        val rng = java.util.Random(17)
        return ShortArray(n) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = exp(-t * 7.0)
            val freq = 220.0 * exp(-t * 3.0) + 60.0
            val chord = sin(2.0 * PI * freq * t) +
                        sin(2.0 * PI * freq * 1.25 * t) * 0.6 +
                        sin(2.0 * PI * freq * 1.5 * t) * 0.4
            val thump = sin(2.0 * PI * 60.0 * exp(-t * 20.0) * t) * exp(-t * 15.0) * 0.8
            val noise = (rng.nextDouble() * 2.0 - 1.0) * exp(-t * 40.0) * 0.2
            short(((chord + thump + noise) * env * 0.35).toFloat())
        }
    }
}
