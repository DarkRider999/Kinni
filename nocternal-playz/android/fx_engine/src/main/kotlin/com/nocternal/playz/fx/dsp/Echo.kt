package com.nocternal.playz.fx.dsp

/** Multi-tap echo (3 taps, decaying) for stereo interleaved PCM. */
class Echo : AudioProcessor {
    var mix: Float = 0f
    var delayMs: Float = 500f
    var decayFactor: Float = 0.5f

    private var sampleRate = 48000
    private var bufL = FloatArray(0)
    private var bufR = FloatArray(0)
    private var writePos = 0

    override fun prepare(sampleRate: Int) {
        this.sampleRate = sampleRate
        val maxSamples = sampleRate * 3 // 3 s max
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
        val tap1 = (sampleRate * delayMs / 1000f).toInt().coerceIn(1, bufL.size - 1)
        val tap2 = (tap1 * 2).coerceAtMost(bufL.size - 1)
        val tap3 = (tap1 * 3).coerceAtMost(bufL.size - 1)
        for (f in 0 until frames) {
            val dryL = buffer[2 * f]
            val dryR = buffer[2 * f + 1]
            bufL[writePos] = dryL
            bufR[writePos] = dryR
            val echoL = bufL[Math.floorMod(writePos - tap1, bufL.size)] * decayFactor +
                        bufL[Math.floorMod(writePos - tap2, bufL.size)] * decayFactor * decayFactor +
                        bufL[Math.floorMod(writePos - tap3, bufL.size)] * decayFactor * decayFactor * decayFactor
            val echoR = bufR[Math.floorMod(writePos - tap1, bufR.size)] * decayFactor +
                        bufR[Math.floorMod(writePos - tap2, bufR.size)] * decayFactor * decayFactor +
                        bufR[Math.floorMod(writePos - tap3, bufR.size)] * decayFactor * decayFactor * decayFactor
            buffer[2 * f]     = dryL * (1f - mix) + echoL * mix
            buffer[2 * f + 1] = dryR * (1f - mix) + echoR * mix
            writePos = (writePos + 1) % bufL.size
        }
    }
}
