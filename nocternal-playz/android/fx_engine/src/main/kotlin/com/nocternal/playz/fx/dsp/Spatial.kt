package com.nocternal.playz.fx.dsp

/** Mid/side stereo widening. width 0 = mono, 1 = unchanged, 2 = extra wide. Mid is kept at unity. */
class StereoWidener : StereoProcessor {
    var width = 1f
        set(value) { field = value.coerceIn(0f, 2f) }

    override fun prepare(sampleRate: Int) {}
    override fun reset() {}

    override fun process(buffer: FloatArray, frames: Int) {
        if (width == 1f) return
        for (f in 0 until frames) {
            val l = buffer[2 * f]; val r = buffer[2 * f + 1]
            val m = (l + r) * 0.5f
            val s = (l - r) * 0.5f * width
            buffer[2 * f] = m + s; buffer[2 * f + 1] = m - s
        }
    }
}

/**
 * 3D surround virtualizer: widens the side signal, adds a short Haas-delayed high-passed side component
 * and a touch of crosstalk cancellation so phone speakers and earbuds sound less "inside the head".
 */
class Surround3D : StereoProcessor {
    private var fs = 48000
    private var dl = DelayLine(64); private var dr = DelayLine(64)
    private val sideHp = Biquad()
    private var delaySamples = 12f
    var amount = 0f
        set(value) { field = value.coerceIn(0f, 1f) }

    override fun prepare(sampleRate: Int) {
        fs = sampleRate
        delaySamples = sampleRate * 0.00045f
        dl = DelayLine((sampleRate * 0.002f).toInt() + 4); dr = DelayLine((sampleRate * 0.002f).toInt() + 4)
        sideHp.setHighPass(sampleRate.toFloat(), 300f)
    }

    override fun reset() { dl.clear(); dr.clear(); sideHp.reset() }

    override fun process(buffer: FloatArray, frames: Int) {
        if (amount <= 0f) return
        val cancel = 0.25f * amount
        val spread = 0.6f * amount
        for (f in 0 until frames) {
            val l = buffer[2 * f]; val r = buffer[2 * f + 1]
            val side = sideHp.processL((l - r) * 0.5f)
            val pastL = dl.read(delaySamples); val pastR = dr.read(delaySamples)
            dl.push(l); dr.push(r)
            val outL = l + side * spread - pastR * cancel
            val outR = r - side * spread - pastL * cancel
            // Compensate the level lost to cancellation.
            val comp = 1f / (1f - cancel * 0.5f)
            buffer[2 * f] = outL * comp; buffer[2 * f + 1] = outR * comp
        }
    }
}

/**
 * Freeverb-style reverb (8 lowpass-feedback combs + 4 allpasses per channel), tunings scaled from 44.1 kHz.
 */
class Reverb : StereoProcessor {
    private class Comb(size: Int) {
        val buf = FloatArray(size); var idx = 0; var store = 0f
        fun process(x: Float, feedback: Float, damp: Float): Float {
            val out = buf[idx]
            store = out * (1 - damp) + store * damp
            buf[idx] = x + store * feedback
            if (++idx >= buf.size) idx = 0
            return out
        }
        fun clear() { buf.fill(0f); store = 0f }
    }
    private class AllPass(size: Int) {
        val buf = FloatArray(size); var idx = 0
        fun process(x: Float): Float {
            val b = buf[idx]
            buf[idx] = x + b * 0.5f
            if (++idx >= buf.size) idx = 0
            return b - x
        }
        fun clear() = buf.fill(0f)
    }

    private val combTunings = intArrayOf(1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617)
    private val apTunings = intArrayOf(556, 441, 341, 225)
    private val spread = 23
    private var combsL = emptyArray<Comb>(); private var combsR = emptyArray<Comb>()
    private var apsL = emptyArray<AllPass>(); private var apsR = emptyArray<AllPass>()

    var roomSize = 0.5f
    var damping = 0.5f
    var wet = 0f
    var width = 1f

    override fun prepare(sampleRate: Int) {
        val k = sampleRate / 44100f
        combsL = Array(8) { Comb((combTunings[it] * k).toInt()) }
        combsR = Array(8) { Comb(((combTunings[it] + spread) * k).toInt()) }
        apsL = Array(4) { AllPass((apTunings[it] * k).toInt()) }
        apsR = Array(4) { AllPass(((apTunings[it] + spread) * k).toInt()) }
    }

    override fun reset() { combsL.forEach { it.clear() }; combsR.forEach { it.clear() }; apsL.forEach { it.clear() }; apsR.forEach { it.clear() } }

    override fun process(buffer: FloatArray, frames: Int) {
        if (wet <= 0f || combsL.isEmpty()) return
        val feedback = roomSize.coerceIn(0f, 1f) * 0.28f + 0.7f
        val damp = damping.coerceIn(0f, 1f) * 0.4f
        val wet1 = wet * (width / 2 + 0.5f) * 3f
        val wet2 = wet * ((1 - width) / 2) * 3f
        val dry = 1f - wet * 0.5f
        for (f in 0 until frames) {
            val inL = buffer[2 * f]; val inR = buffer[2 * f + 1]
            val input = (inL + inR) * 0.015f
            var outL = 0f; var outR = 0f
            for (i in 0 until 8) { outL += combsL[i].process(input, feedback, damp); outR += combsR[i].process(input, feedback, damp) }
            for (i in 0 until 4) { outL = apsL[i].process(outL); outR = apsR[i].process(outR) }
            buffer[2 * f] = inL * dry + outL * wet1 + outR * wet2
            buffer[2 * f + 1] = inR * dry + outR * wet1 + outL * wet2
        }
    }
}
