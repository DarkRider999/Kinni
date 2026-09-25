package com.nocternal.playz.model

import kotlinx.serialization.Serializable

/** Platform-neutral ARGB colour (0xAARRGGBB). UI layers convert it to their own colour type. */
@Serializable
@JvmInline
value class NeonColor(val argb: Long) {
    val alpha: Float get() = ((argb shr 24) and 0xFF) / 255f
    val red: Float get() = ((argb shr 16) and 0xFF) / 255f
    val green: Float get() = ((argb shr 8) and 0xFF) / 255f
    val blue: Float get() = (argb and 0xFF) / 255f

    fun withAlpha(a: Float): NeonColor =
        NeonColor(((a.coerceIn(0f, 1f) * 255).toLong() shl 24) or (argb and 0xFFFFFF))

    /** Linear blend towards [other]; t = 0 keeps this colour, t = 1 gives [other]. */
    fun lerp(other: NeonColor, t: Float): NeonColor {
        val k = t.coerceIn(0f, 1f)
        fun ch(a: Float, b: Float) = ((a + (b - a) * k) * 255f + 0.5f).toLong().coerceIn(0, 255)
        return NeonColor(
            (ch(alpha, other.alpha) shl 24) or (ch(red, other.red) shl 16) or
                (ch(green, other.green) shl 8) or ch(blue, other.blue),
        )
    }

    fun toHex(): String = "#%06X".format(argb and 0xFFFFFF)

    companion object {
        /** Parses "#RRGGBB" or "#AARRGGBB". */
        fun hex(value: String): NeonColor {
            val s = value.removePrefix("#")
            require(s.length == 6 || s.length == 8) { "Bad colour: $value" }
            val v = s.toLong(16)
            return NeonColor(if (s.length == 6) 0xFF000000L or v else v)
        }

        /** HSV (h in degrees, s/v in 0..1) to colour; used by Prism Cycle and colour pickers. */
        fun hsv(h: Float, s: Float, v: Float): NeonColor {
            val hh = ((h % 360f) + 360f) % 360f / 60f
            val c = v * s
            val x = c * (1 - kotlin.math.abs(hh % 2 - 1))
            val (r, g, b) = when (hh.toInt()) {
                0 -> Triple(c, x, 0f); 1 -> Triple(x, c, 0f); 2 -> Triple(0f, c, x)
                3 -> Triple(0f, x, c); 4 -> Triple(x, 0f, c); else -> Triple(c, 0f, x)
            }
            val m = v - c
            fun ch(f: Float) = ((f + m) * 255f + 0.5f).toLong().coerceIn(0, 255)
            return NeonColor(0xFF000000L or (ch(r) shl 16) or (ch(g) shl 8) or ch(b))
        }

        val AmoledBlack = NeonColor(0xFF000000)
        val DeepSpace = NeonColor(0xFF0A0A0F)
    }
}
