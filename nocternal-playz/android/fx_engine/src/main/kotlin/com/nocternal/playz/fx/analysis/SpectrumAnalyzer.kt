package com.nocternal.playz.fx.analysis

import com.nocternal.playz.model.SpectrumFrame
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow

/**
 * Real-time spectrum for the lighting engine. Feed post-FX stereo audio with [push] (audio thread, no
 * allocation) and call [compute] from the UI/animation thread ~60 times a second.
 */
class SpectrumAnalyzer(private val sampleRate: Int, fftSize: Int = 1024, private val bandCount: Int = SpectrumFrame.BAND_COUNT) {
    private val fft = Fft(fftSize)
    private val ring = FloatArray(fftSize * 2)
    @Volatile private var writePos = 0
    private val snapshot = FloatArray(fftSize)
    private val mags = FloatArray(fftSize / 2)
    private val re = FloatArray(fftSize); private val im = FloatArray(fftSize)
    private val smooth = FloatArray(bandCount)
    private val bandEdges: IntArray
    private var bassAvg = 0f
    private var lastBass = 0f
    private var beatHold = 0

    init {
        val binHz = sampleRate.toFloat() / fftSize
        val lo = 30f; val hi = minOf(16000f, sampleRate / 2f - binHz)
        bandEdges = IntArray(bandCount + 1) { i ->
            val f = lo * (hi / lo).pow(i.toFloat() / bandCount)
            (f / binHz).toInt().coerceIn(1, fftSize / 2 - 1)
        }
        for (i in 1..bandCount) if (bandEdges[i] <= bandEdges[i - 1]) bandEdges[i] = bandEdges[i - 1] + 1
    }

    /** Adds interleaved stereo samples (mixed to mono). */
    fun push(interleaved: FloatArray, frames: Int) {
        var w = writePos
        for (f in 0 until frames) {
            ring[w] = (interleaved[2 * f] + interleaved[2 * f + 1]) * 0.5f
            w = (w + 1) % ring.size
        }
        writePos = w
    }

    fun compute(timestampMs: Long = 0): SpectrumFrame {
        val n = snapshot.size
        val end = writePos
        for (i in 0 until n) snapshot[i] = ring[((end - n + i) % ring.size + ring.size) % ring.size]
        fft.magnitudes(snapshot, 0, mags, re, im)
        val bands = FloatArray(bandCount)
        var sum = 0f
        for (b in 0 until bandCount) {
            var peak = 0f
            for (k in bandEdges[b] until max(bandEdges[b + 1], bandEdges[b] + 1).coerceAtMost(mags.size)) peak = max(peak, mags[k])
            // Magnitude → dB (-70..0) → 0..1, with a slight tilt so highs are visible.
            val db = 20 * log10(peak / (n / 4f) + 1e-9f) + b * 0.25f
            val v = ((db + 70f) / 70f).coerceIn(0f, 1f)
            smooth[b] = if (v > smooth[b]) v else smooth[b] * 0.85f + v * 0.15f
            bands[b] = smooth[b]
            sum += smooth[b]
        }
        val third = bandCount / 3
        val bass = bands.copyOfRange(0, third / 2 + 2).average().toFloat()
        val mid = bands.copyOfRange(third, 2 * third).average().toFloat()
        val treble = bands.copyOfRange(2 * third, bandCount).average().toFloat()
        bassAvg = bassAvg * 0.95f + bass * 0.05f
        val flux = bass - lastBass
        lastBass = bass
        val beat = beatHold == 0 && flux > 0.04f && bass > bassAvg * 1.15f && bass > 0.3f
        beatHold = if (beat) 6 else max(0, beatHold - 1)
        return SpectrumFrame(bands, bass, mid, treble, sum / bandCount, beat, timestampMs)
    }
}
