package com.nocternal.playz.fx.dsp

/** Biquad-based variable low/high-pass filter for stereo interleaved PCM. */
class Filter : StereoProcessor {
    var mix: Float = 0f
    var cutoffHz: Float = 1000f
    var resonance: Float = 0.7f
    var highPass: Boolean = false

    private var sampleRate = 48000
    private val biquad = Biquad()

    override fun prepare(sampleRate: Int) {
        this.sampleRate = sampleRate
        updateCoefficients()
    }

    override fun reset() { biquad.reset() }

    override fun process(buffer: FloatArray, frames: Int) {
        if (mix == 0f || cutoffHz <= 0f) return
        for (f in 0 until frames) {
            val dryL = buffer[2 * f]
            val dryR = buffer[2 * f + 1]
            val wetL = biquad.processL(dryL)
            val wetR = biquad.processR(dryR)
            buffer[2 * f]     = dryL * (1f - mix) + wetL * mix
            buffer[2 * f + 1] = dryR * (1f - mix) + wetR * mix
        }
    }

    fun updateCoefficients() {
        if (cutoffHz <= 0f) { biquad.setIdentity(); return }
        if (highPass) biquad.setHighPass(sampleRate.toFloat(), cutoffHz, resonance)
        else biquad.setLowPass(sampleRate.toFloat(), cutoffHz, resonance)
    }
}
