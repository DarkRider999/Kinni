package com.nocternal.playz.fx.dsp

import kotlin.math.PI
import kotlin.math.sin
import kotlin.math.tan

/** Flanger: short modulated delay with feedback. Right channel LFO is 90° ahead for stereo movement. */
class Flanger : StereoProcessor {
    private var fs = 48000f
    private var dl = DelayLine(1024); private var dr = DelayLine(1024)
    private var phase = 0.0
    var rateHz = 0.25f
    var depthMs = 2.5f
    var feedback = 0.5f
    var mix = 0f

    override fun prepare(sampleRate: Int) {
        fs = sampleRate.toFloat()
        val cap = (sampleRate * 0.025f).toInt()
        dl = DelayLine(cap); dr = DelayLine(cap)
    }

    override fun reset() { dl.clear(); dr.clear(); phase = 0.0 }

    override fun process(buffer: FloatArray, frames: Int) {
        if (mix <= 0f) return
        val base = 0.001f * fs
        val depth = depthMs.coerceIn(0.1f, 10f) * 0.001f * fs
        val inc = 2 * PI * rateHz / fs
        val fb = feedback.coerceIn(-0.95f, 0.95f)
        for (f in 0 until frames) {
            val lfoL = 0.5f + 0.5f * sin(phase).toFloat()
            val lfoR = 0.5f + 0.5f * sin(phase + PI / 2).toFloat()
            phase += inc; if (phase > 2 * PI) phase -= 2 * PI
            val xl = buffer[2 * f]; val xr = buffer[2 * f + 1]
            val yl = dl.read(base + depth * lfoL); val yr = dr.read(base + depth * lfoR)
            dl.push(xl + yl * fb); dr.push(xr + yr * fb)
            buffer[2 * f] = xl + (yl - xl) * mix * 0.5f
            buffer[2 * f + 1] = xr + (yr - xr) * mix * 0.5f
        }
    }
}

/** Phaser: cascade of first-order allpasses swept between 200 Hz and 2 kHz by an LFO, with feedback. */
class Phaser : StereoProcessor {
    private var fs = 48000f
    private val maxStages = 12
    private val zl = FloatArray(maxStages); private val zr = FloatArray(maxStages)
    private var lastL = 0f; private var lastR = 0f
    private var phase = 0.0
    private var coefL = 0f; private var coefR = 0f
    var rateHz = 0.5f
    var depth = 0.8f
    var feedback = 0.4f
    var stages = 6
    var mix = 0f

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat() }
    override fun reset() { zl.fill(0f); zr.fill(0f); lastL = 0f; lastR = 0f }

    private fun coef(freq: Float): Float { val t = tan(PI * freq / fs).toFloat(); return (t - 1f) / (t + 1f) }

    override fun process(buffer: FloatArray, frames: Int) {
        if (mix <= 0f) return
        val n = stages.coerceIn(2, maxStages)
        val inc = 2 * PI * rateHz / fs
        val fb = feedback.coerceIn(-0.9f, 0.9f)
        for (f in 0 until frames) {
            if (f % 32 == 0) {
                val sweepL = 0.5f + 0.5f * sin(phase).toFloat() * depth
                val sweepR = 0.5f + 0.5f * sin(phase + PI / 3).toFloat() * depth
                coefL = coef(200f * Math.pow(10.0, sweepL.toDouble()).toFloat())
                coefR = coef(200f * Math.pow(10.0, sweepR.toDouble()).toFloat())
            }
            phase += inc; if (phase > 2 * PI) phase -= 2 * PI
            val xl = buffer[2 * f]; val xr = buffer[2 * f + 1]
            var yl = xl + lastL * fb; var yr = xr + lastR * fb
            for (s in 0 until n) {
                val ol = coefL * yl + zl[s]; zl[s] = yl - coefL * ol; yl = ol
                val or = coefR * yr + zr[s]; zr[s] = yr - coefR * or; yr = or
            }
            lastL = yl; lastR = yr
            buffer[2 * f] = xl + (yl - xl) * mix * 0.5f
            buffer[2 * f + 1] = xr + (yr - xr) * mix * 0.5f
        }
    }
}

/**
 * Real-time pitch shifter (±12 semitones) using two crossfaded read taps sweeping a delay line — the
 * classic "rotating tape head" method. Tempo is unchanged.
 */
class PitchShifter : StereoProcessor {
    private var window = 2048f
    private var dl = DelayLine(4096); private var dr = DelayLine(4096)
    private var pos = 0f
    var semitones = 0f
        set(value) { field = value.coerceIn(-12f, 12f) }

    override fun prepare(sampleRate: Int) {
        window = sampleRate * 0.05f
        dl = DelayLine(window.toInt() * 2 + 8); dr = DelayLine(window.toInt() * 2 + 8)
    }

    override fun reset() { dl.clear(); dr.clear(); pos = 0f }

    override fun process(buffer: FloatArray, frames: Int) {
        if (semitones == 0f) return
        val ratio = Math.pow(2.0, semitones / 12.0).toFloat()
        val slope = 1f - ratio
        for (f in 0 until frames) {
            dl.push(buffer[2 * f]); dr.push(buffer[2 * f + 1])
            pos += slope
            while (pos < 0) pos += window
            while (pos >= window) pos -= window
            val d1 = pos + 1f
            val d2 = (pos + window / 2) % window + 1f
            // Triangular crossfade: a tap is silent when its delay wraps.
            val g1 = 1f - kotlin.math.abs(2f * pos / window - 1f)
            val g2 = 1f - g1
            buffer[2 * f] = dl.read(d1) * g1 + dl.read(d2) * g2
            buffer[2 * f + 1] = dr.read(d1) * g1 + dr.read(d2) * g2
        }
    }
}
