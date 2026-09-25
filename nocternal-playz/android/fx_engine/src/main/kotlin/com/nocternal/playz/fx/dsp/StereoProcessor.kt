package com.nocternal.playz.fx.dsp

/** A stereo effect working in place on interleaved L/R float samples in -1..1. */
interface StereoProcessor {
    fun prepare(sampleRate: Int)
    fun process(buffer: FloatArray, frames: Int)
    fun reset()
}

/** Fixed-size delay line with fractional (linear) reads. */
internal class DelayLine(capacity: Int) {
    private val buf = FloatArray(capacity.coerceAtLeast(2))
    private var w = 0
    val size get() = buf.size

    fun push(x: Float) { buf[w] = x; w = (w + 1) % buf.size }

    /** Sample written [delay] samples ago (1 = previous sample). */
    fun read(delay: Float): Float {
        val d = delay.coerceIn(1f, (buf.size - 2).toFloat())
        val pos = w - d
        val i = kotlin.math.floor(pos).toInt()
        val frac = pos - i
        val i0 = ((i % buf.size) + buf.size) % buf.size
        val i1 = (i0 + 1) % buf.size
        return buf[i0] + (buf[i1] - buf[i0]) * frac
    }

    fun clear() { buf.fill(0f) }
}
