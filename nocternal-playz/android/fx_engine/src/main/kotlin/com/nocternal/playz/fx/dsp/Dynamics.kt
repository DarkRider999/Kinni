package com.nocternal.playz.fx.dsp

import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max

/** Stereo-linked feed-forward compressor with soft knee, attack/release smoothing and makeup gain. */
class Compressor : StereoProcessor {
    private var fs = 48000f
    private var grDb = 0f
    var enabled = false
    var thresholdDb = -18f
    var ratio = 3f
    var kneeDb = 6f
    var attackMs = 10f
    var releaseMs = 120f
    var makeupDb = 0f

    /** Last gain reduction in dB (≤ 0), for the UI meter. */
    val gainReductionDb: Float get() = -grDb

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat() }
    override fun reset() { grDb = 0f }

    /** Static curve: output level for an input level (dB). */
    fun curve(inDb: Float): Float {
        val over = inDb - thresholdDb
        val r = ratio.coerceAtLeast(1f)
        return when {
            2 * over < -kneeDb -> inDb
            2 * abs(over) <= kneeDb && kneeDb > 0 -> inDb + (1 / r - 1) * (over + kneeDb / 2) * (over + kneeDb / 2) / (2 * kneeDb)
            else -> thresholdDb + over / r
        }
    }

    override fun process(buffer: FloatArray, frames: Int) {
        if (!enabled) return
        val atk = exp(-1f / (attackMs.coerceAtLeast(0.1f) * 0.001f * fs))
        val rel = exp(-1f / (releaseMs.coerceAtLeast(1f) * 0.001f * fs))
        val makeup = dbToGain(makeupDb)
        for (f in 0 until frames) {
            val l = buffer[2 * f]; val r = buffer[2 * f + 1]
            val peak = max(abs(l), abs(r))
            val inDb = gainToDb(peak)
            val target = inDb - curve(inDb) // positive dB of reduction
            val coeff = if (target > grDb) atk else rel
            grDb = target + (grDb - target) * coeff
            val g = dbToGain(-grDb) * makeup
            buffer[2 * f] = l * g; buffer[2 * f + 1] = r * g
        }
    }
}

/**
 * Brick-wall peak limiter with instant attack and smooth release. Output never exceeds [ceilingDb].
 * Always last in the chain; safe mode lowers the ceiling.
 */
class Limiter : StereoProcessor {
    private var fs = 48000f
    private var env = 0f
    var ceilingDb = -0.3f

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat() }
    override fun reset() { env = 0f }

    override fun process(buffer: FloatArray, frames: Int) {
        val ceiling = dbToGain(ceilingDb)
        val rel = exp(-1f / (0.08f * fs))
        for (f in 0 until frames) {
            val l = buffer[2 * f]; val r = buffer[2 * f + 1]
            val peak = max(abs(l), abs(r))
            env = if (peak > env) peak else peak + (env - peak) * rel
            val g = if (env > ceiling) ceiling / env else 1f
            buffer[2 * f] = (l * g).coerceIn(-ceiling, ceiling)
            buffer[2 * f + 1] = (r * g).coerceIn(-ceiling, ceiling)
        }
    }
}

/**
 * Noise reducer used by the AI Song Enhancer: rumble high-pass, hiss high-shelf cut and a downward expander
 * that pushes low-level noise between phrases further down.
 */
class NoiseReducer : StereoProcessor {
    private var fs = 48000f
    private val rumble = Biquad(); private val hiss = Biquad()
    private var env = 0f
    private var gain = 1f
    var amount = 0f
        set(value) { field = value.coerceIn(0f, 1f); configure() }

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat(); configure() }
    override fun reset() { rumble.reset(); hiss.reset(); env = 0f; gain = 1f }

    private fun configure() {
        rumble.setHighPass(fs, 20f + 40f * amount)
        hiss.setHighShelf(fs, 7000f, -8f * amount)
    }

    override fun process(buffer: FloatArray, frames: Int) {
        if (amount <= 0f) return
        val thresh = dbToGain(-55f + 15f * amount)
        val envRel = exp(-1f / (0.05f * fs)); val gAtk = exp(-1f / (0.002f * fs)); val gRel = exp(-1f / (0.1f * fs))
        for (f in 0 until frames) {
            var l = hiss.processL(rumble.processL(buffer[2 * f]))
            var r = hiss.processR(rumble.processR(buffer[2 * f + 1]))
            val p = max(abs(l), abs(r))
            env = if (p > env) p else p + (env - p) * envRel
            // 1:3 downward expansion below the threshold.
            val target = if (env >= thresh || env <= 0f) 1f else (env / thresh).let { it * it }
            gain = target + (gain - target) * (if (target > gain) gAtk else gRel)
            l *= gain; r *= gain
            buffer[2 * f] = l; buffer[2 * f + 1] = r
        }
    }
}

/**
 * Vocal remover (karaoke): removes centre-panned content above ~150 Hz using mid/side, keeping the
 * centred bass and kick intact. amount 0..1 blends between original and full removal.
 * The "AI" mode in the app can swap this for an on-device source-separation model via the plugin API.
 */
class VocalRemover : StereoProcessor {
    private var fs = 48000f
    private val lp = Biquad()
    var amount = 0f
        set(value) { field = value.coerceIn(0f, 1f) }

    override fun prepare(sampleRate: Int) { fs = sampleRate.toFloat(); lp.setLowPass(fs, 150f) }
    override fun reset() = lp.reset()

    override fun process(buffer: FloatArray, frames: Int) {
        if (amount <= 0f) return
        for (f in 0 until frames) {
            val l = buffer[2 * f]; val r = buffer[2 * f + 1]
            val lowL = lp.processL(l); val lowR = lp.processR(r)
            val hl = l - lowL; val hr = r - lowR
            val mid = (hl + hr) * 0.5f * (1f - amount)
            val side = (hl - hr) * 0.5f
            // Side-only material is quieter; lift it slightly as the mid disappears.
            val lift = 1f + 0.4f * amount
            buffer[2 * f] = lowL + mid + side * lift
            buffer[2 * f + 1] = lowR + mid - side * lift
        }
    }
}

/** Smoothed gain stage for normalization, loudness enhancer, speaker boost and fades. */
class SmoothGain : StereoProcessor {
    private var current = 1f
    private var step = 0f
    var target = 1f

    override fun prepare(sampleRate: Int) { step = 1f / (0.02f * sampleRate) }
    override fun reset() { current = target }

    override fun process(buffer: FloatArray, frames: Int) {
        if (current == target && current == 1f) return
        for (f in 0 until frames) {
            if (current != target) {
                val d = target - current
                current = if (abs(d) <= step * max(1f, abs(target))) target else current + step * max(1f, abs(target)) * if (d > 0) 1 else -1
            }
            buffer[2 * f] *= current; buffer[2 * f + 1] *= current
        }
    }
}
