package com.nocternal.playz.fx

import com.nocternal.playz.fx.analysis.BpmDetector
import com.nocternal.playz.fx.analysis.Fft
import com.nocternal.playz.fx.analysis.KeyDetector
import com.nocternal.playz.fx.analysis.LoudnessMeter
import com.nocternal.playz.fx.analysis.LoudnessNormalizer
import com.nocternal.playz.fx.analysis.SpectrumAnalyzer
import com.nocternal.playz.fx.dsp.Biquad
import com.nocternal.playz.fx.dsp.Compressor
import com.nocternal.playz.fx.dsp.Limiter
import com.nocternal.playz.fx.dsp.PitchShifter
import com.nocternal.playz.fx.dsp.TenBandEqualizer
import com.nocternal.playz.fx.dsp.VocalRemover
import com.nocternal.playz.model.MusicalKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin
import kotlin.math.sqrt

class FxEngineTest {
    private val sr = 44100

    private fun sine(freq: Float, seconds: Float, amp: Float = 0.5f, stereo: Boolean = true): FloatArray {
        val n = (sr * seconds).toInt()
        return if (stereo) FloatArray(n * 2) { i -> amp * sin(2 * PI * freq * (i / 2) / sr).toFloat() }
        else FloatArray(n) { i -> amp * sin(2 * PI * freq * i / sr).toFloat() }
    }

    private fun rms(buf: FloatArray, from: Int = 0): Float {
        var s = 0.0; for (i in from until buf.size) s += buf[i] * buf[i]
        return sqrt(s / (buf.size - from)).toFloat()
    }

    @Test fun flatEqIsTransparent() {
        val eq = TenBandEqualizer().apply { prepare(sr); setGains(List(10) { 0f }, 0f) }
        val x = sine(1000f, 0.1f); val y = x.copyOf()
        eq.process(y, y.size / 2)
        for (i in x.indices) assertEquals(x[i], y[i], 1e-6f)
    }

    @Test fun eqBandBoostsItsFrequency() {
        val eq = TenBandEqualizer().apply { prepare(sr); setGains(listOf(0f, 0f, 0f, 0f, 0f, 6f, 0f, 0f, 0f, 0f), 0f) }
        assertEquals(6.0, eq.responseDb(1000f), 0.2)
        assertTrue(abs(eq.responseDb(31f)) < 0.5)
        val y = sine(1000f, 0.5f); eq.process(y, y.size / 2)
        assertEquals(2.0f, rms(y, y.size / 2) / rms(sine(1000f, 0.5f), y.size / 2), 0.05f)
    }

    @Test fun shelvesHitTheirGain() {
        val b = Biquad(); b.setLowShelf(sr.toFloat(), 100f, 9f)
        assertEquals(9.0, b.magnitudeDb(sr.toFloat(), 20f), 0.5)
        assertEquals(0.0, b.magnitudeDb(sr.toFloat(), 5000f), 0.3)
    }

    @Test fun limiterNeverExceedsCeiling() {
        val lim = Limiter().apply { prepare(sr); ceilingDb = -1f }
        val y = sine(80f, 0.5f, amp = 3f); lim.process(y, y.size / 2)
        val ceiling = Math.pow(10.0, -1.0 / 20).toFloat()
        assertTrue(y.all { abs(it) <= ceiling + 1e-6f })
    }

    @Test fun compressorReducesLoudPassages() {
        val c = Compressor().apply { prepare(sr); enabled = true; thresholdDb = -20f; ratio = 4f; makeupDb = 0f; kneeDb = 0f }
        assertEquals(-15f, c.curve(0f), 0.01f)
        val y = sine(440f, 0.5f, amp = 1f); c.process(y, y.size / 2)
        assertTrue(rms(y, y.size / 2) < 0.3f)
    }

    @Test fun vocalRemoverCancelsCentreKeepsSides() {
        val vr = VocalRemover().apply { prepare(sr); amount = 1f }
        val centre = sine(1000f, 0.5f); vr.process(centre, centre.size / 2)
        assertTrue("centre should vanish, rms=${rms(centre, centre.size / 2)}", rms(centre, centre.size / 2) < 0.02f)
        // Hard-left content survives.
        val n = sr / 2
        val left = FloatArray(n * 2) { i -> if (i % 2 == 0) 0.5f * sin(2 * PI * 1000 * (i / 2) / sr).toFloat() else 0f }
        vr.prepare(sr); vr.process(left, n)
        assertTrue(rms(left, n) > 0.1f)
    }

    @Test fun pitchShiftOctaveUpDoublesFrequency() {
        val ps = PitchShifter().apply { prepare(sr); semitones = 12f }
        val y = sine(440f, 1f); ps.process(y, y.size / 2)
        val mono = FloatArray(y.size / 2) { y[2 * it] }
        assertEquals(880f, dominantFrequency(mono), 15f)
    }

    @Test fun fftFindsTone() {
        assertEquals(1000f, dominantFrequency(sine(1000f, 0.2f, stereo = false)), 25f)
    }

    @Test fun chainIsSafeWithEverythingOn() {
        val chain = FxChain().apply { prepare(sr) }
        chain.update(
            FxSettings(
                eqGainsDb = List(10) { 12f }, bassBoost = 1f, surround3d = 1f, loudnessDb = 12f,
                reverb = ReverbParams(true), flanger = FlangerParams(true), phaser = PhaserParams(true),
                compressor = CompressorParams(true), stereoWidth = 2f, pitchSemitones = 3f, vocalRemover = 0.5f,
                noiseReduction = 0.5f, speakerBoost = true, safeMode = true,
            ),
        )
        val y = sine(120f, 1f, amp = 0.9f)
        chain.process(y, y.size / 2)
        val ceiling = Math.pow(10.0, -1.0 / 20).toFloat()
        assertTrue(y.all { it.isFinite() && abs(it) <= ceiling + 1e-6f })
    }

    @Test fun safeModeCapsBoost() {
        val s = FxSettings(loudnessDb = 12f, speakerBoost = true, normalizationGainDb = 4f, safeMode = true)
        assertEquals(6f, s.normalizationDb() + s.boostDb(), 1e-4f)
        assertEquals(12f, s.copy(safeMode = false).let { it.normalizationDb() + it.boostDb() }, 1e-4f)
    }

    @Test fun faderSilencesOutput() {
        val chain = FxChain().apply { prepare(sr) }
        chain.faderLevel = 0f
        val y = sine(440f, 0.5f); chain.process(y, y.size / 2)
        assertTrue(rms(y, y.size / 2) < 1e-4f)
    }

    @Test fun bpmOfClickTrack() {
        for (bpm in listOf(90f, 120f, 128f, 140f)) {
            val seconds = 20f
            val n = (sr * seconds).toInt()
            val x = FloatArray(n)
            val period = sr * 60f / bpm
            var t = 0f
            while (t < n) {
                val start = t.toInt()
                for (i in 0 until 400) if (start + i < n) x[start + i] += (0.8f * sin(2 * PI * 60 * i / sr) * Math.exp(-i / 80.0)).toFloat() + (Math.random().toFloat() - 0.5f) * 0.3f * Math.exp(-i / 40.0).toFloat()
                t += period
            }
            assertEquals("bpm $bpm", bpm, BpmDetector.detect(x, sr)!!, 1.5f)
        }
    }

    @Test fun keyOfCMajorChords() {
        // I–IV–V–I in C major with the tonic reinforced.
        val chords = listOf(listOf(261.63f, 329.63f, 392.0f, 130.81f), listOf(349.23f, 440f, 523.25f, 174.61f), listOf(392f, 493.88f, 587.33f, 196f), listOf(261.63f, 329.63f, 392.0f, 130.81f))
        val per = sr * 2
        val x = FloatArray(per * chords.size)
        chords.forEachIndexed { c, notes -> for (i in 0 until per) x[c * per + i] = notes.sumOf { sin(2 * PI * it * i / sr) }.toFloat() * 0.2f }
        val (key, _) = KeyDetector.detect(x, sr)
        assertEquals(MusicalKey(0, false), key)
        assertEquals("8B", key!!.camelot)
    }

    @Test fun loudnessAndNormalization() {
        val loud = LoudnessMeter.integratedDb(sine(1000f, 3f, amp = 0.5f, stereo = false), sr)
        // 0.5 amplitude sine ≈ -9 dBFS RMS; K-weighting adds a little at 1 kHz.
        assertTrue("loudness $loud", loud in -10f..-4f)
        assertEquals(4f, LoudnessNormalizer.gainDb(replayGainDb = 0f, measuredLoudnessDb = null), 1e-4f)
        assertEquals(-6f, LoudnessNormalizer.gainDb(null, -8f), 1e-4f)
    }

    @Test fun spectrumSeesBassHit() {
        val an = SpectrumAnalyzer(sr)
        an.push(sine(1000f, 0.05f, amp = 0.05f), (sr * 0.05f).toInt())
        repeat(20) { an.compute() }
        val quiet = an.compute().bass
        an.push(sine(60f, 0.05f, amp = 0.9f), (sr * 0.05f).toInt())
        val frame = an.compute()
        assertTrue(frame.bass > quiet + 0.2f)
        assertTrue(frame.beat)
    }

    @Test fun camelotRoundTrip() {
        for (pc in 0 until 12) for (minor in listOf(false, true)) {
            val k = MusicalKey(pc, minor)
            assertEquals(k, MusicalKey.fromCamelot(k.camelot))
        }
        assertEquals("8A", MusicalKey.parse("A minor")!!.camelot)
        assertEquals("3B", MusicalKey.parse("Db")!!.camelot)
        assertEquals("11A", MusicalKey.parse("F#m")!!.camelot)
    }

    private fun dominantFrequency(mono: FloatArray): Float {
        val n = 8192
        val fft = Fft(n); val mags = FloatArray(n / 2)
        fft.magnitudes(mono, (mono.size - n).coerceAtLeast(0) / 2, mags)
        val k = (1 until n / 2).maxBy { mags[it] }
        return k * sr.toFloat() / n
    }
}
