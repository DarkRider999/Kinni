package com.nocternal.playz.fx.dsp

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/** Stereo RBJ-cookbook biquad in transposed direct form II. Coefficient setters never allocate. */
class Biquad {
    private var b0 = 1.0; private var b1 = 0.0; private var b2 = 0.0
    private var a1 = 0.0; private var a2 = 0.0
    private var z1L = 0.0; private var z2L = 0.0
    private var z1R = 0.0; private var z2R = 0.0

    var isIdentity = true
        private set

    fun reset() { z1L = 0.0; z2L = 0.0; z1R = 0.0; z2R = 0.0 }

    fun setIdentity() { set(1.0, 0.0, 0.0, 1.0, 0.0, 0.0); isIdentity = true }

    fun setPeaking(fs: Float, f0: Float, q: Float, gainDb: Float) {
        if (gainDb == 0f) { setIdentity(); return }
        val a = 10.0.pow(gainDb / 40.0)
        val w = 2 * PI * f0.clampFreq(fs) / fs
        val alpha = sin(w) / (2 * q)
        set(1 + alpha * a, -2 * cos(w), 1 - alpha * a, 1 + alpha / a, -2 * cos(w), 1 - alpha / a)
    }

    fun setLowShelf(fs: Float, f0: Float, gainDb: Float, slope: Float = 1f) {
        if (gainDb == 0f) { setIdentity(); return }
        val a = 10.0.pow(gainDb / 40.0)
        val w = 2 * PI * f0.clampFreq(fs) / fs
        val alpha = sin(w) / 2 * sqrt((a + 1 / a) * (1 / slope - 1) + 2)
        val c = cos(w); val s = 2 * sqrt(a) * alpha
        set(
            a * ((a + 1) - (a - 1) * c + s), 2 * a * ((a - 1) - (a + 1) * c), a * ((a + 1) - (a - 1) * c - s),
            (a + 1) + (a - 1) * c + s, -2 * ((a - 1) + (a + 1) * c), (a + 1) + (a - 1) * c - s,
        )
    }

    fun setHighShelf(fs: Float, f0: Float, gainDb: Float, slope: Float = 1f) {
        if (gainDb == 0f) { setIdentity(); return }
        val a = 10.0.pow(gainDb / 40.0)
        val w = 2 * PI * f0.clampFreq(fs) / fs
        val alpha = sin(w) / 2 * sqrt((a + 1 / a) * (1 / slope - 1) + 2)
        val c = cos(w); val s = 2 * sqrt(a) * alpha
        set(
            a * ((a + 1) + (a - 1) * c + s), -2 * a * ((a - 1) + (a + 1) * c), a * ((a + 1) + (a - 1) * c - s),
            (a + 1) - (a - 1) * c + s, 2 * ((a - 1) - (a + 1) * c), (a + 1) - (a - 1) * c - s,
        )
    }

    fun setLowPass(fs: Float, f0: Float, q: Float = 0.7071f) {
        val w = 2 * PI * f0.clampFreq(fs) / fs
        val alpha = sin(w) / (2 * q); val c = cos(w)
        set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha)
    }

    fun setHighPass(fs: Float, f0: Float, q: Float = 0.7071f) {
        val w = 2 * PI * f0.clampFreq(fs) / fs
        val alpha = sin(w) / (2 * q); val c = cos(w)
        set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha)
    }

    private fun set(nb0: Double, nb1: Double, nb2: Double, na0: Double, na1: Double, na2: Double) {
        b0 = nb0 / na0; b1 = nb1 / na0; b2 = nb2 / na0; a1 = na1 / na0; a2 = na2 / na0
        isIdentity = false
    }

    fun processL(x: Float): Float {
        val y = b0 * x + z1L
        z1L = b1 * x - a1 * y + z2L
        z2L = b2 * x - a2 * y
        return y.toFloat()
    }

    fun processR(x: Float): Float {
        val y = b0 * x + z1R
        z1R = b1 * x - a1 * y + z2R
        z2R = b2 * x - a2 * y
        return y.toFloat()
    }

    /** Magnitude response in dB at [f]; used by the EQ screen curve and tests. */
    fun magnitudeDb(fs: Float, f: Float): Double {
        val w = 2 * PI * f / fs
        val cw = cos(w); val c2w = cos(2 * w); val sw = sin(w); val s2w = sin(2 * w)
        val nr = b0 + b1 * cw + b2 * c2w; val ni = -(b1 * sw + b2 * s2w)
        val dr = 1 + a1 * cw + a2 * c2w; val di = -(a1 * sw + a2 * s2w)
        return 10 * kotlin.math.log10((nr * nr + ni * ni) / (dr * dr + di * di))
    }

    private fun Float.clampFreq(fs: Float) = coerceIn(10f, fs * 0.45f)
}

internal fun dbToGain(db: Float): Float = 10f.pow(db / 20f)
internal fun gainToDb(g: Float): Float = if (g <= 1e-9f) -180f else 20f * kotlin.math.log10(g)
