package com.nocternal.playz.lighting

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import com.nocternal.playz.designsystem.toColor
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.SpectrumFrame
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

/** Inputs for one animation frame. [time] is seconds since start; [beatPulse] decays 1→0 after each beat. */
data class LightFrame(
    val time: Float,
    val spectrum: SpectrumFrame,
    val beatPulse: Float,
    val primary: Color,
    val secondary: Color,
    val intensity: Float,
)

/** Particle state for Starfall; owned by the composable, mutated per frame. */
class StarField(count: Int = 70) {
    val x = FloatArray(count) { Random.nextFloat() }
    val y = FloatArray(count) { Random.nextFloat() }
    val speed = FloatArray(count) { 0.05f + Random.nextFloat() * 0.2f }
    val bright = FloatArray(count) { Random.nextFloat() }
}

/**
 * The ten lighting animations (spec §6). Each is a pure DrawScope function of [LightFrame], so the same
 * code draws the light bar strip, the edge overlay and the full-screen visualizer.
 */
object LightingAnimations {
    fun draw(scope: DrawScope, animation: LightingAnimation, f: LightFrame, stars: StarField) = with(scope) {
        when (animation) {
            LightingAnimation.PULSE_WAVE_SPECTRUM -> pulseWave(f)
            LightingAnimation.HYPERBEAM_EDGE_FLOW -> hyperBeam(f)
            LightingAnimation.AURORA_RIBBON -> aurora(f)
            LightingAnimation.BASS_SHOCK_FLASH -> bassShock(f)
            LightingAnimation.PRISM_CYCLE -> prism(f)
            LightingAnimation.VORTEX_SPIRAL -> vortex(f)
            LightingAnimation.EQ_BAR_MIRAGE -> eqMirage(f)
            LightingAnimation.STARFALL_REACTIVE -> starfall(f, stars)
            LightingAnimation.CRYSTAL_GRID -> crystalGrid(f)
            LightingAnimation.INFINITY_LOOP -> infinity(f)
        }
    }

    private fun DrawScope.pulseWave(f: LightFrame) {
        val c = center
        val maxR = size.maxDimension * 0.6f
        for (i in 0 until 6) {
            val t = ((f.time * 0.35f + i / 6f) % 1f)
            val band = f.spectrum.bands[(i * 5).coerceAtMost(f.spectrum.bands.size - 1)]
            val r = maxR * t * (0.7f + 0.5f * band)
            drawCircle(f.primary.lerpTo(f.secondary, t).copy(alpha = (1 - t) * (0.3f + 0.7f * band) * f.intensity), r, c, style = Stroke(2f + 10f * band * (1 - t)))
        }
        drawCircle(Brush.radialGradient(listOf(f.primary.copy(alpha = 0.6f * f.intensity * (0.3f + f.spectrum.bass)), Color.Transparent), c, maxR * 0.25f), maxR * 0.25f, c)
    }

    private fun DrawScope.hyperBeam(f: LightFrame) {
        val perimeter = 2 * (size.width + size.height)
        val speed = 0.25f + f.spectrum.level * 0.8f
        for (beam in 0 until 3) {
            val head = ((f.time * speed + beam / 3f) % 1f) * perimeter
            val tail = 0.18f * perimeter * (0.5f + f.spectrum.mid)
            for (k in 0 until 24) {
                val d = head - tail * k / 24f
                val p = pointOnPerimeter(((d % perimeter) + perimeter) % perimeter)
                val a = (1f - k / 24f) * f.intensity
                drawCircle((if (beam % 2 == 0) f.primary else f.secondary).copy(alpha = a), 3f + 5f * (1 - k / 24f) * (0.5f + f.spectrum.bass), p)
            }
        }
    }

    private fun DrawScope.aurora(f: LightFrame) {
        for (ribbon in 0 until 3) {
            val path = Path()
            val base = size.height * (0.35f + ribbon * 0.15f)
            val amp = size.height * (0.06f + 0.18f * f.spectrum.mid) * (1f - ribbon * 0.2f)
            val steps = 48
            for (s in 0..steps) {
                val x = size.width * s / steps
                val y = base + amp * sin(s / steps.toFloat() * 2f * PI.toFloat() * 1.5f + f.time * (0.6f + ribbon * 0.2f) + ribbon)
                if (s == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            val color = if (ribbon % 2 == 0) f.primary else f.secondary
            drawPath(path, Brush.horizontalGradient(listOf(Color.Transparent, color.copy(alpha = 0.7f * f.intensity), Color.Transparent)), style = Stroke(18f + 30f * f.spectrum.mid, cap = StrokeCap.Round))
            drawPath(path, color.copy(alpha = 0.9f * f.intensity), style = Stroke(2f))
        }
    }

    private fun DrawScope.bassShock(f: LightFrame) {
        drawRect(f.primary.copy(alpha = 0.45f * f.beatPulse * f.intensity), blendMode = BlendMode.Plus)
        val r = size.maxDimension * (1.1f - f.beatPulse) * 0.7f
        drawCircle(f.secondary.copy(alpha = f.beatPulse * f.intensity), r, center, style = Stroke(6f + 24f * f.beatPulse))
        drawCircle(Brush.radialGradient(listOf(f.primary.copy(alpha = f.spectrum.bass * f.intensity), Color.Transparent), center, size.minDimension * 0.4f), size.minDimension * 0.4f, center)
    }

    private fun DrawScope.prism(f: LightFrame) {
        val hue = (f.time * (20f + 120f * f.spectrum.level)) % 360f
        val colors = List(7) { NeonColor.hsv(hue + it * 51.4f, 1f, 1f).toColor().copy(alpha = 0.55f * f.intensity) }
        drawRect(Brush.sweepGradient(colors + colors.first(), center))
        drawCircle(Color.Black.copy(alpha = 0.55f), size.minDimension * (0.35f - 0.1f * f.spectrum.bass), center)
    }

    private fun DrawScope.vortex(f: LightFrame) {
        val arms = 5
        val twist = 3f + 4f * f.spectrum.mid
        val rot = f.time * (40f + 200f * f.spectrum.level)
        rotate(rot) {
            for (a in 0 until arms) {
                val path = Path()
                for (s in 0..60) {
                    val t = s / 60f
                    val ang = a * 2 * PI.toFloat() / arms + t * twist
                    val r = t * size.maxDimension * 0.55f
                    val p = Offset(center.x + cos(ang) * r, center.y + sin(ang) * r)
                    if (s == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
                }
                drawPath(path, Brush.sweepGradient(listOf(f.primary, f.secondary, f.primary), center), alpha = f.intensity, style = Stroke(3f + 8f * f.spectrum.bass, cap = StrokeCap.Round))
            }
        }
    }

    private fun DrawScope.eqMirage(f: LightFrame) {
        val n = f.spectrum.bands.size
        val w = size.width / n
        val mid = size.height * 0.6f
        for (i in 0 until n) {
            val v = f.spectrum.bands[i]
            val h = mid * 0.9f * v
            val color = f.primary.lerpTo(f.secondary, i / n.toFloat())
            drawRect(Brush.verticalGradient(listOf(color.copy(alpha = f.intensity), color.copy(alpha = 0.2f * f.intensity)), mid - h, mid), Offset(i * w + w * 0.15f, mid - h), Size(w * 0.7f, h))
            // Mirage reflection with a heat-haze wobble.
            val wobble = sin(f.time * 6f + i) * 3f
            drawRect(color.copy(alpha = 0.18f * f.intensity), Offset(i * w + w * 0.15f + wobble, mid + 4f), Size(w * 0.7f, h * 0.5f))
        }
    }

    private fun DrawScope.starfall(f: LightFrame, s: StarField) {
        val spawn = f.spectrum.treble > 0.45f
        for (i in s.x.indices) {
            s.y[i] += s.speed[i] * (0.02f + 0.06f * f.spectrum.level)
            if (s.y[i] > 1f || (spawn && Random.nextFloat() < 0.02f)) { s.y[i] = 0f; s.x[i] = Random.nextFloat(); s.bright[i] = 1f }
            s.bright[i] = max(0.2f, s.bright[i] * 0.985f)
            val p = Offset(s.x[i] * size.width, s.y[i] * size.height)
            val trail = 30f * s.speed[i] * 5f
            drawLine(Brush.verticalGradient(listOf(Color.Transparent, f.primary.copy(alpha = s.bright[i] * f.intensity)), p.y - trail, p.y), Offset(p.x, p.y - trail), p, 2f)
            drawCircle(Color.White.copy(alpha = s.bright[i] * f.intensity), 2f + 2f * s.bright[i], p)
        }
    }

    private fun DrawScope.crystalGrid(f: LightFrame) {
        val cols = 8; val rows = 8
        val horizon = size.height * 0.3f
        for (r in 0..rows) for (c in 0..cols) {
            val depth = r / rows.toFloat()
            val y = horizon + (size.height - horizon) * depth * depth
            val spread = 0.3f + 0.7f * depth
            val x = size.width / 2 + (c - cols / 2f) / cols * size.width * spread * 1.4f
            val band = f.spectrum.bands[((c + r * cols) % f.spectrum.bands.size)]
            val color = f.primary.lerpTo(f.secondary, band)
            drawCircle(color.copy(alpha = (0.2f + 0.8f * band) * f.intensity), 2f + 8f * band * depth, Offset(x, y))
            if (c < cols) {
                val nx = size.width / 2 + (c + 1 - cols / 2f) / cols * size.width * spread * 1.4f
                drawLine(color.copy(alpha = 0.25f * f.intensity), Offset(x, y), Offset(nx, y), 1f)
            }
        }
    }

    private fun DrawScope.infinity(f: LightFrame) {
        val a = size.minDimension * (0.32f + 0.08f * f.spectrum.level)
        val breathe = 1f + 0.15f * sin(f.time * 1.2f) + 0.2f * f.spectrum.bass
        val head = f.time * 0.8f
        for (k in 0 until 80) {
            val t = head - k * 0.03f
            // Lemniscate of Bernoulli.
            val d = 1 + sin(t) * sin(t)
            val p = Offset(center.x + a * breathe * cos(t) / d, center.y + a * breathe * sin(t) * cos(t) / d)
            val fade = 1f - k / 80f
            drawCircle(f.primary.lerpTo(f.secondary, k / 80f).copy(alpha = fade * f.intensity), 2f + 6f * fade, p)
        }
    }

    private fun DrawScope.pointOnPerimeter(d: Float): Offset {
        val w = size.width; val h = size.height
        return when {
            d < w -> Offset(d, 0f)
            d < w + h -> Offset(w, d - w)
            d < 2 * w + h -> Offset(w - (d - w - h), h)
            else -> Offset(0f, h - (d - 2 * w - h))
        }
    }

    private fun Color.lerpTo(other: Color, t: Float): Color = androidx.compose.ui.graphics.lerp(this, other, abs(t).coerceIn(0f, 1f))
}
