package com.nocternal.playz.automix

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

enum class CrossfadeCurve { LINEAR, EQUAL_POWER, S_CURVE }

/** Gains for the outgoing and incoming track at progress t (0..1). */
data class FadeGains(val outgoing: Float, val incoming: Float)

object Crossfade {
    fun gains(t: Float, curve: CrossfadeCurve): FadeGains {
        val x = t.coerceIn(0f, 1f)
        return when (curve) {
            CrossfadeCurve.LINEAR -> FadeGains(1 - x, x)
            CrossfadeCurve.EQUAL_POWER -> FadeGains(cos(x * PI / 2).toFloat(), sin(x * PI / 2).toFloat())
            CrossfadeCurve.S_CURVE -> { val s = (0.5 - 0.5 * cos(PI * x)).toFloat(); FadeGains(1 - s, s) }
        }
    }
}

/**
 * Auto-fader: fade the current track out over [fadeOutMs] before its end, then fade the next track in over
 * [fadeInMs] (spec default 3 s + 3 s). Pure function of positions so the player can call it every tick.
 */
class AutoFader(var fadeOutMs: Long = 3000, var fadeInMs: Long = 3000) {
    /** Volume 0..1 for a track at [positionMs] of [durationMs]. */
    fun volumeAt(positionMs: Long, durationMs: Long): Float {
        if (durationMs <= 0) return 1f
        val fadeIn = if (fadeInMs > 0 && positionMs < fadeInMs) positionMs.toFloat() / fadeInMs else 1f
        val remaining = durationMs - positionMs
        val fadeOut = if (fadeOutMs > 0 && remaining < fadeOutMs) remaining.toFloat() / fadeOutMs else 1f
        return minOf(fadeIn, fadeOut).coerceIn(0f, 1f)
    }
}
