package com.nocternal.playz.fx.analysis

import com.nocternal.playz.model.MusicalKey
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt

/** Offline analysis of decoded mono PCM: tempo, key, loudness and energy. Used by the library scanner. */
data class AnalysisResult(
    val bpm: Float?,
    val key: MusicalKey?,
    val keyConfidence: Float,
    /** Integrated loudness estimate (dB, roughly LUFS-scaled). */
    val loudnessDb: Float,
    /** 0..1 */
    val energy: Float,
    /** 0..1 brightness (spectral centroid, normalised). */
    val brightness: Float,
)

object TrackAnalyzer {
    fun analyze(mono: FloatArray, sampleRate: Int): AnalysisResult {
        val bpm = BpmDetector.detect(mono, sampleRate)
        val (key, conf) = KeyDetector.detect(mono, sampleRate)
        val loud = LoudnessMeter.integratedDb(mono, sampleRate)
        val energy = ((loud + 40f) / 32f).coerceIn(0f, 1f) * 0.6f + onsetDensity(mono, sampleRate) * 0.4f
        return AnalysisResult(bpm, key, conf, loud, energy.coerceIn(0f, 1f), brightness(mono, sampleRate))
    }

    private fun onsetDensity(mono: FloatArray, sr: Int): Float {
        val env = BpmDetector.onsetEnvelope(mono, sr)
        if (env.isEmpty()) return 0f
        val mean = env.average().toFloat()
        val peaks = (1 until env.size - 1).count { env[it] > env[it - 1] && env[it] >= env[it + 1] && env[it] > mean * 2 }
        val seconds = mono.size.toFloat() / sr
        return (peaks / seconds / 6f).coerceIn(0f, 1f)
    }

    private fun brightness(mono: FloatArray, sr: Int): Float {
        val fft = Fft(2048); val mags = FloatArray(1024)
        var num = 0.0; var den = 0.0
        var off = 0
        while (off + 2048 <= mono.size) {
            fft.magnitudes(mono, off, mags)
            for (k in mags.indices) { num += k * mags[k]; den += mags[k] }
            off += 2048 * 4
        }
        if (den <= 0) return 0f
        val centroidHz = num / den * sr / 2048
        return (ln(centroidHz.coerceAtLeast(100.0) / 100.0) / ln(80.0)).toFloat().coerceIn(0f, 1f)
    }
}

/** Tempo from a spectral-flux onset envelope + autocorrelation with a mild preference for 90–140 BPM. */
object BpmDetector {
    private const val FFT = 1024
    private const val HOP = 512

    fun onsetEnvelope(mono: FloatArray, sr: Int): FloatArray {
        if (mono.size < FFT * 2) return FloatArray(0)
        val fft = Fft(FFT)
        val frames = (mono.size - FFT) / HOP
        val prev = FloatArray(FFT / 2); val cur = FloatArray(FFT / 2)
        val re = FloatArray(FFT); val im = FloatArray(FFT)
        val env = FloatArray(frames)
        for (i in 0 until frames) {
            fft.magnitudes(mono, i * HOP, cur, re, im)
            var flux = 0f
            for (k in 1 until FFT / 2) {
                val d = ln(1 + 100 * cur[k]) - ln(1 + 100 * prev[k])
                if (d > 0) flux += d
            }
            env[i] = flux
            cur.copyInto(prev)
        }
        // Remove slow trend so autocorrelation sees only onsets.
        val out = FloatArray(frames)
        var avg = env.firstOrNull() ?: 0f
        for (i in env.indices) { avg = avg * 0.9f + env[i] * 0.1f; out[i] = max(0f, env[i] - avg) }
        return out
    }

    fun detect(mono: FloatArray, sr: Int, minBpm: Float = 60f, maxBpm: Float = 200f): Float? {
        val env = onsetEnvelope(mono, sr)
        if (env.size < 64) return null
        val fps = sr.toFloat() / HOP
        val minLag = (fps * 60f / maxBpm).toInt().coerceAtLeast(1)
        val maxLag = (fps * 60f / minBpm).toInt().coerceAtMost(env.size - 1)
        if (maxLag <= minLag) return null
        val ac = FloatArray(maxLag + 2)
        for (lag in minLag..maxLag + 1) {
            if (lag >= env.size) break
            var s = 0f
            for (i in 0 until env.size - lag) s += env[i] * env[i + lag]
            ac[lag] = s / (env.size - lag)
        }
        var best = -1; var bestScore = 0f
        for (lag in minLag..maxLag) {
            val bpm = 60f * fps / lag
            // Log-Gaussian tempo prior centred at 120 BPM.
            val prior = exp(-0.5 * (log2(bpm / 120.0) / 0.9).let { it * it }).toFloat()
            // Reward lags whose double also correlates (true beat period rather than a sub-division).
            val harmonic = if (2 * lag < ac.size) ac[2 * lag] * 0.5f else 0f
            val score = (ac[lag] + harmonic) * prior
            if (score > bestScore) { bestScore = score; best = lag }
        }
        if (best <= 0 || bestScore <= 0f) return null
        // Parabolic interpolation around the peak for sub-frame precision.
        val y0 = ac[best - 1]; val y1 = ac[best]; val y2 = ac[best + 1]
        val denom = y0 - 2 * y1 + y2
        val shift = if (abs(denom) > 1e-12f) (0.5f * (y0 - y2) / denom).coerceIn(-0.5f, 0.5f) else 0f
        return 60f * fps / (best + shift)
    }

    private fun log2(x: Double) = ln(x) / ln(2.0)
}

/** Key via chroma (55 Hz–2 kHz) correlated against Krumhansl–Kessler major/minor profiles. */
object KeyDetector {
    private val MAJOR = floatArrayOf(6.35f, 2.23f, 3.48f, 2.33f, 4.38f, 4.09f, 2.52f, 5.19f, 2.39f, 3.66f, 2.29f, 2.88f)
    private val MINOR = floatArrayOf(6.33f, 2.68f, 3.52f, 5.38f, 2.60f, 3.53f, 2.54f, 4.75f, 3.98f, 2.69f, 3.34f, 3.17f)

    fun chroma(mono: FloatArray, sr: Int): FloatArray {
        val n = 8192
        val fft = Fft(n)
        val mags = FloatArray(n / 2); val re = FloatArray(n); val im = FloatArray(n)
        val chroma = FloatArray(12)
        val binHz = sr.toFloat() / n
        val lo = (55f / binHz).toInt().coerceAtLeast(1); val hi = (2000f / binHz).toInt().coerceAtMost(n / 2 - 1)
        val pcOfBin = IntArray(n / 2) { k ->
            if (k < lo || k > hi) -1 else {
                val midi = 69 + 12 * log10(k * binHz / 440.0) / log10(2.0)
                ((Math.round(midi).toInt() % 12) + 12) % 12
            }
        }
        var off = 0
        while (off + n <= mono.size) {
            fft.magnitudes(mono, off, mags, re, im)
            for (k in lo..hi) { val pc = pcOfBin[k]; if (pc >= 0) chroma[pc] += mags[k] * mags[k] }
            off += n / 2
        }
        return chroma
    }

    /** Returns the best key and a 0..1 confidence (margin over the runner-up). */
    fun detect(mono: FloatArray, sr: Int): Pair<MusicalKey?, Float> {
        val c = chroma(mono, sr)
        if (c.sum() <= 0f) return null to 0f
        val scores = ArrayList<Pair<MusicalKey, Float>>(24)
        for (tonic in 0 until 12) {
            scores += MusicalKey(tonic, false) to correlate(c, MAJOR, tonic)
            scores += MusicalKey(tonic, true) to correlate(c, MINOR, tonic)
        }
        scores.sortByDescending { it.second }
        val (best, s1) = scores[0]
        val s2 = scores[1].second
        return best to ((s1 - s2) * 4f).coerceIn(0f, 1f).let { if (s1 <= 0f) 0f else max(it, 0.1f) }
    }

    private fun correlate(chroma: FloatArray, profile: FloatArray, tonic: Int): Float {
        val cm = chroma.average(); val pm = profile.average()
        var num = 0.0; var dc = 0.0; var dp = 0.0
        for (i in 0 until 12) {
            val a = chroma[(i + tonic) % 12] - cm
            val b = profile[i] - pm
            num += a * b; dc += a * a; dp += b * b
        }
        return if (dc <= 0 || dp <= 0) 0f else (num / sqrt(dc * dp)).toFloat()
    }
}

/** Simplified integrated loudness: K-weighting approximation + 400 ms gated blocks (like EBU R128, not certified). */
object LoudnessMeter {
    fun integratedDb(mono: FloatArray, sr: Int): Float {
        if (mono.isEmpty()) return -70f
        val hp = com.nocternal.playz.fx.dsp.Biquad().apply { setHighPass(sr.toFloat(), 60f, 0.5f) }
        val shelf = com.nocternal.playz.fx.dsp.Biquad().apply { setHighShelf(sr.toFloat(), 1500f, 4f) }
        val block = (0.4f * sr).toInt().coerceAtLeast(1)
        val blocks = ArrayList<Double>()
        var acc = 0.0; var count = 0
        for (x in mono) {
            val y = shelf.processL(hp.processL(x))
            acc += y * y; count++
            if (count == block) { blocks += acc / count; acc = 0.0; count = 0 }
        }
        if (count > 0) blocks += acc / count
        val absGated = blocks.filter { 10 * log10(it + 1e-12) - 0.691 > -70 }
        if (absGated.isEmpty()) return -70f
        val rel = 10 * log10(absGated.average() + 1e-12) - 0.691 - 10
        val gated = absGated.filter { 10 * log10(it + 1e-12) - 0.691 > rel }.ifEmpty { absGated }
        // Mono content is summed into both channels on playback: +3 dB.
        return (10 * log10(gated.average() + 1e-12) - 0.691 + 3.0).toFloat()
    }
}

/** Smart audio normalization: gain that brings a track to the target loudness (default −14 LUFS, streaming standard). */
object LoudnessNormalizer {
    const val DEFAULT_TARGET_DB = -14f
    /** ReplayGain 2.0 reference level. */
    private const val REPLAYGAIN_REFERENCE_DB = -18f

    fun gainDb(replayGainDb: Float?, measuredLoudnessDb: Float?, targetDb: Float = DEFAULT_TARGET_DB): Float = when {
        replayGainDb != null -> replayGainDb + (targetDb - REPLAYGAIN_REFERENCE_DB)
        measuredLoudnessDb != null -> targetDb - measuredLoudnessDb
        else -> 0f
    }.coerceIn(-12f, 12f)
}
