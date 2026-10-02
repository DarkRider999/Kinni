package com.nocternal.playz.ui.player

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode as AnimRepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate as rotateModifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import com.nocternal.playz.ai.ArtShape
import com.nocternal.playz.ai.NeonArtSpec
import com.nocternal.playz.designsystem.toColor
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/** Draws AI-generated neon album art from a [NeonArtSpec] (spec §4 smart album art generator). */
@Composable
fun NeonArtView(spec: NeonArtSpec, modifier: Modifier = Modifier) {
    Canvas(modifier.background(spec.background.toColor())) {
        spec.layers.forEach { layer ->
            val c = spec.palette[layer.colorIndex % spec.palette.size].toColor()
            val center = Offset(size.width * layer.x, size.height * layer.y)
            val r = size.minDimension * layer.size / 2
            rotate(layer.rotation, center) { drawShape(layer.shape, center, r, c, layer.glow, spec.seed) }
        }
    }
}

private fun DrawScope.drawShape(shape: ArtShape, c: Offset, r: Float, color: Color, glow: Float, seed: Long) {
    val glowStroke = Stroke(r * 0.08f)
    when (shape) {
        ArtShape.RING -> { drawCircle(color.copy(alpha = 0.25f * glow), r * 1.1f, c, style = Stroke(r * 0.25f)); drawCircle(color, r, c, style = glowStroke) }
        ArtShape.SUN -> {
            drawCircle(Brush.verticalGradient(listOf(color, color.copy(alpha = 0.2f)), c.y - r, c.y + r), r, c)
            for (i in 0 until 5) drawRect(Color.Black, Offset(c.x - r, c.y + r * (0.1f + i * 0.18f)), androidx.compose.ui.geometry.Size(r * 2, r * 0.06f * (i + 1)))
        }
        ArtShape.GRID_HORIZON -> for (i in 0..10) {
            val y = size.height * (0.6f + 0.04f * i * i / 10f)
            drawLine(color.copy(alpha = 0.6f), Offset(0f, y), Offset(size.width, y), 2f)
            drawLine(color.copy(alpha = 0.5f), Offset(size.width / 2, size.height * 0.6f), Offset(size.width * i / 10f, size.height), 2f)
        }
        ArtShape.MOUNTAINS -> {
            val p = Path().apply { moveTo(0f, size.height * 0.75f); lineTo(size.width * 0.3f, size.height * 0.5f); lineTo(size.width * 0.55f, size.height * 0.7f); lineTo(size.width * 0.8f, size.height * 0.45f); lineTo(size.width, size.height * 0.7f); lineTo(size.width, size.height); lineTo(0f, size.height); close() }
            drawPath(p, Color.Black); drawPath(p, color, style = Stroke(3f))
        }
        ArtShape.WAVE -> {
            val p = Path()
            for (s in 0..60) { val x = size.width * s / 60; val y = c.y + sin(s / 60f * 4 * PI).toFloat() * r * 0.4f; if (s == 0) p.moveTo(x, y) else p.lineTo(x, y) }
            drawPath(p, color, style = glowStroke)
        }
        ArtShape.TRIANGLE -> {
            val p = Path().apply { for (k in 0..3) { val a = -PI / 2 + k * 2 * PI / 3; val pt = Offset(c.x + cos(a).toFloat() * r, c.y + sin(a).toFloat() * r); if (k == 0) moveTo(pt.x, pt.y) else lineTo(pt.x, pt.y) } }
            drawPath(p, color.copy(alpha = 0.3f * glow), style = Stroke(r * 0.2f)); drawPath(p, color, style = glowStroke)
        }
        ArtShape.ORB -> drawCircle(Brush.radialGradient(listOf(color, color.copy(alpha = 0.3f), Color.Transparent), c, r), r, c)
        ArtShape.STARS -> { val rnd = Random(seed); repeat(60) { drawCircle(Color.White.copy(alpha = rnd.nextFloat()), 1f + rnd.nextFloat() * 2f, Offset(rnd.nextFloat() * size.width, rnd.nextFloat() * size.height)) } }
        ArtShape.MANDALA -> for (k in 0 until 12) { val a = k * PI / 6; drawCircle(color.copy(alpha = 0.7f), r * 0.5f, Offset(c.x + cos(a).toFloat() * r * 0.5f, c.y + sin(a).toFloat() * r * 0.5f), style = Stroke(2f)) }
        ArtShape.WAVEFORM -> { val rnd = Random(seed); val n = 32; for (i in 0 until n) { val h = r * (0.2f + rnd.nextFloat()); val x = c.x - r + 2 * r * i / n; drawLine(color, Offset(x, c.y - h / 2), Offset(x, c.y + h / 2), r * 0.03f) } }
    }
}

/** Album art: the track's own artwork if available, else generated neon art. */
@Composable
fun AlbumArt(artworkUri: String?, fallback: NeonArtSpec?, modifier: Modifier = Modifier) {
    if (artworkUri == null) { fallback?.let { NeonArtView(it, modifier) }; return }
    SubcomposeAsyncImage(
        model = artworkUri,
        contentDescription = "Album art",
        contentScale = ContentScale.Crop,
        modifier = modifier,
        error = { if (fallback != null) NeonArtView(fallback, Modifier.fillMaxSize()) else Box(Modifier.fillMaxSize().background(Color.Black)) },
    )
}

/** Album art as a real-looking spinning vinyl record: black disc with grooves and a glossy rim, the track's
 * artwork as the round center label, and a tonearm that swings onto the record when [spinning] (playback is
 * on) and lifts away when it isn't — like a real turntable. */
@Composable
fun SpinningAlbumArt(artworkUri: String?, fallback: NeonArtSpec?, spinning: Boolean, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "vinyl-spin")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(9000, easing = LinearEasing), repeatMode = AnimRepeatMode.Restart),
        label = "vinyl-angle",
    )
    val armAngle by animateFloatAsState(if (spinning) 1f else 0f, animationSpec = tween(600), label = "tonearm")

    Box(modifier, contentAlignment = Alignment.Center) {
        // The record itself, sized to leave room in the top-right corner for the tonearm.
        Box(Modifier.fillMaxSize(0.88f).align(Alignment.Center)) {
            Box(Modifier.fillMaxSize().rotateModifier(if (spinning) angle else 0f)) {
                Canvas(Modifier.fillMaxSize()) {
                    val r = size.minDimension / 2f
                    val c = Offset(size.width / 2f, size.height / 2f)
                    drawCircle(Brush.radialGradient(listOf(Color(0xFF2B2B2E), Color(0xFF0A0A0B)), c, r), r, c)
                    var groove = r * 0.4f
                    while (groove < r * 0.98f) {
                        drawCircle(Color.White.copy(alpha = 0.05f), groove, c, style = Stroke(1.1f))
                        groove += r * 0.045f
                    }
                    drawCircle(Color.White.copy(alpha = 0.3f), r * 0.995f, c, style = Stroke(1.5f))
                }
                // Round center label: the track's own artwork, else generated neon art.
                Box(
                    Modifier.fillMaxSize(0.38f).align(Alignment.Center).clip(CircleShape)
                        .border(1.dp, Color.White.copy(alpha = 0.3f), CircleShape),
                ) { AlbumArt(artworkUri, fallback, Modifier.fillMaxSize()) }
                // Spindle hole.
                Box(Modifier.fillMaxSize(0.035f).align(Alignment.Center).clip(CircleShape).background(Color.Black))
            }
        }
        // Tonearm: pivots from the top-right corner, swinging onto the record while playing.
        Canvas(Modifier.fillMaxSize()) {
            val pivot = Offset(size.width * 0.96f, size.height * 0.04f)
            val armLen = size.minDimension * 0.46f
            val deg = -2f + armAngle * 42f
            val rad = deg * (PI.toFloat() / 180f)
            val tip = Offset(pivot.x - cos(rad) * armLen, pivot.y + sin(rad) * armLen)
            drawLine(Color(0xFFD8D8D8), pivot, tip, strokeWidth = size.minDimension * 0.012f, cap = StrokeCap.Round)
            drawCircle(Color(0xFF9A9A9A), size.minDimension * 0.022f, pivot)
            drawCircle(Color(0xFF3A3A3A), size.minDimension * 0.012f, pivot)
            val perp = Offset(-sin(rad), -cos(rad))
            val half = size.minDimension * 0.028f
            drawLine(Color.Black, Offset(tip.x - perp.x * half, tip.y - perp.y * half), Offset(tip.x + perp.x * half, tip.y + perp.y * half), strokeWidth = size.minDimension * 0.02f, cap = StrokeCap.Round)
        }
    }
}
