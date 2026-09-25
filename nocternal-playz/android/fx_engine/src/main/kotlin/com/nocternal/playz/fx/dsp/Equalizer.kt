package com.nocternal.playz.fx.dsp

import com.nocternal.playz.model.EQ_BAND_FREQUENCIES

/** 10-band graphic EQ (peaking filters, octave spacing) with preamp. */
class TenBandEqualizer : StereoProcessor {
    private var fs = 48000f
    private val bands = Array(EQ_BAND_FREQUENCIES.size) { Biquad() }
    private val gains = FloatArray(EQ_BAND_FREQUENCIES.size)
    private var preamp = 1f

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat(); update(); reset() }

    fun setGains(gainsDb: List<Float>, preampDb: Float) {
        var changed = false
        for (i in gains.indices) {
            val g = gainsDb.getOrElse(i) { 0f }.coerceIn(-12f, 12f)
            if (g != gains[i]) { gains[i] = g; changed = true }
        }
        preamp = dbToGain(preampDb.coerceIn(-12f, 12f))
        if (changed) update()
    }

    private fun update() {
        for (i in bands.indices) bands[i].setPeaking(fs, EQ_BAND_FREQUENCIES[i], 1.41f, gains[i])
    }

    override fun process(buffer: FloatArray, frames: Int) {
        for (f in 0 until frames) {
            var l = buffer[2 * f] * preamp
            var r = buffer[2 * f + 1] * preamp
            for (b in bands) if (!b.isIdentity) { l = b.processL(l); r = b.processR(r) }
            buffer[2 * f] = l; buffer[2 * f + 1] = r
        }
    }

    override fun reset() = bands.forEach { it.reset() }

    /** Combined response in dB at [f] for drawing the EQ curve. */
    fun responseDb(f: Float): Double = bands.sumOf { if (it.isIdentity) 0.0 else it.magnitudeDb(fs, f) } + gainToDb(preamp)
}

/** Bass boost: 80 Hz low shelf (up to +12 dB) with a gentle saturation to keep it punchy instead of boomy. */
class BassBoost : StereoProcessor {
    private var fs = 48000f
    private val shelf = Biquad()
    private var amount = 0f

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat(); set(amount) }
    fun set(amount01: Float) { amount = amount01.coerceIn(0f, 1f); shelf.setLowShelf(fs, 80f, amount * 12f, 0.8f) }

    override fun process(buffer: FloatArray, frames: Int) {
        if (amount <= 0f) return
        val drive = 1f + amount
        for (f in 0 until frames) {
            buffer[2 * f] = softSat(shelf.processL(buffer[2 * f]), drive)
            buffer[2 * f + 1] = softSat(shelf.processR(buffer[2 * f + 1]), drive)
        }
    }

    override fun reset() = shelf.reset()
}

/** Cubic soft clipper; transparent for small signals, rounds peaks. */
internal fun softSat(x: Float, drive: Float): Float {
    val y = (x * drive).coerceIn(-1.5f, 1.5f)
    return (y - y * y * y / 6.75f) / drive
}
