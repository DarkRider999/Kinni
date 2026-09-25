package com.nocternal.playz.designsystem

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import com.nocternal.playz.model.BackgroundStyle
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/** Full-screen animated background for the active theme's [BackgroundStyle]. */
@Composable
fun NeonBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val p = Neon.palette
    val t = rememberInfiniteTransition(label = "bg")
    val phase by t.animateFloat(0f, 1f, infiniteRepeatable(tween(24_000, easing = LinearEasing), RepeatMode.Restart), label = "phase")
    val stars = remember { List(90) { Triple(Random.nextFloat(), Random.nextFloat(), Random.nextFloat()) } }
    Box(modifier.fillMaxSize().background(p.background)) {
        Canvas(Modifier.fillMaxSize()) {
            when (p.backgroundStyle) {
                BackgroundStyle.AMOLED_BLACK -> Unit
                BackgroundStyle.DEEP_SPACE -> glowBlob(p.accent.copy(alpha = 0.10f), Offset(size.width * 0.2f, size.height * 0.15f), size.minDimension)
                BackgroundStyle.NEBULA -> {
                    glowBlob(p.accent.copy(alpha = 0.18f), Offset(size.width * (0.3f + 0.1f * sin(phase * 2 * PI).toFloat()), size.height * 0.25f), size.minDimension * 1.1f)
                    glowBlob(p.secondary.copy(alpha = 0.16f), Offset(size.width * 0.8f, size.height * (0.7f + 0.05f * cos(phase * 2 * PI).toFloat())), size.minDimension)
                }
                BackgroundStyle.STARFIELD -> stars.forEach { (x, y, z) ->
                    val yy = (y + phase * (0.2f + z)) % 1f
                    drawCircle(Color.White.copy(alpha = 0.3f + 0.5f * z), 0.8f + z * 1.8f, Offset(x * size.width, yy * size.height))
                }
                BackgroundStyle.AURORA_HAZE -> for (i in 0 until 3) {
                    val y = size.height * (0.2f + i * 0.12f) + 30f * sin((phase * 2 * PI + i).toFloat())
                    drawRect(Brush.verticalGradient(listOf(Color.Transparent, (if (i % 2 == 0) p.accent else p.secondary).copy(alpha = 0.10f), Color.Transparent), y - 120f, y + 120f), Offset(0f, y - 120f), androidx.compose.ui.geometry.Size(size.width, 240f))
                }
                BackgroundStyle.GRID_HORIZON -> gridHorizon(p.accent, p.secondary, phase)
                BackgroundStyle.SOFT_GLOW -> glowBlob(p.accent.copy(alpha = 0.14f), center, size.maxDimension * 0.8f)
                BackgroundStyle.SACRED_MANDALA -> {
                    val c = Offset(size.width / 2, size.height * 0.35f)
                    for (ring in 1..6) for (k in 0 until 12) {
                        val a = (k / 12f + phase * 0.1f * if (ring % 2 == 0) 1 else -1) * 2 * PI
                        drawCircle(p.accent.copy(alpha = 0.06f), ring * 34f, Offset(c.x + cos(a).toFloat() * ring * 22f, c.y + sin(a).toFloat() * ring * 22f), style = Stroke(1.2f))
                    }
                }
                BackgroundStyle.RAIN_GLASS -> stars.forEach { (x, y, z) ->
                    val yy = (y + phase * (1f + z) * 3f) % 1f
                    drawLine(p.accent.copy(alpha = 0.08f + 0.12f * z), Offset(x * size.width, yy * size.height), Offset(x * size.width, yy * size.height + 18f + z * 30f), 1.5f)
                }
            }
        }
        content()
    }
}

private fun DrawScope.glowBlob(color: Color, c: Offset, radius: Float) =
    drawCircle(Brush.radialGradient(listOf(color, Color.Transparent), c, radius), radius, c)

private fun DrawScope.gridHorizon(a: Color, b: Color, phase: Float) {
    val horizon = size.height * 0.55f
    drawRect(Brush.verticalGradient(listOf(Color.Transparent, b.copy(alpha = 0.15f)), 0f, horizon), size = androidx.compose.ui.geometry.Size(size.width, horizon))
    val lines = 14
    for (i in 0..lines) {
        val t = ((i + phase * 4) % lines) / lines
        val y = horizon + (size.height - horizon) * t * t
        drawLine(a.copy(alpha = 0.08f + 0.25f * t), Offset(0f, y), Offset(size.width, y), 1.5f)
    }
    for (i in -10..10) {
        val x = size.width / 2 + i * size.width / 10
        drawLine(a.copy(alpha = 0.18f), Offset(size.width / 2 + i * 12f, horizon), Offset(x * 1f + i * size.width / 6, size.height), 1.2f)
    }
}
