package com.nocternal.playz.fx.dsp

/** Single-tap feedback delay line for stereo interleaved PCM. */
class Delay : AudioProcessor {
    var mix: Float = 0f       // 0 = dry, 1 = fully wet
    var delayMs: Float = 375f
    var feedback: Float = 0.4f

    private var sampleRate = 48000
    private var bufL = FloatArray(0)
    private var bufR = FloatArray(0)
    private var writePos = 0

    override fun prepare(sampleRate: Int) {
        this.sampleRate = sampleRate
        val maxSamples = sampleRate * 2 // 2 s max
        bufL = FloatArray(maxSamples)
        bufR = FloatArray(maxSamples)
        writePos = 0
    }

    override fun reset() {
        bufL.fill(0f)
        bufR.fill(0f)
        writePos = 0
    }

    override fun process(buffer: FloatArray, frames: Int) {
        if (mix == 0f) return
        val delaySamples = (sampleRate * delayMs / 1000f).toInt().coerceIn(1, bufL.size - 1)
        for (f in 0 until frames) {
            val readPos = Math.floorMod(writePos - delaySamples, bufL.size)
            val delayedL = bufL[readPos]
            val delayedR = bufR[readPos]
            val dryL = buffer[2 * f]
            val dryR = buffer[2 * f + 1]
            bufL[writePos] = dryL + delayedL * feedback
            bufR[writePos] = dryR + delayedR * feedback
            buffer[2 * f]     = dryL * (1f - mix) + delayedL * mix
            buffer[2 * f + 1] = dryR * (1f - mix) + delayedR * mix
            writePos = (writePos + 1) % bufL.size
        }
    }
}
