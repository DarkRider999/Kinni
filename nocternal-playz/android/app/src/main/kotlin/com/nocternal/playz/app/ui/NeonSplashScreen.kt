package com.nocternal.playz.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val NeonCyan = Color(0xFF00F0FF)
private val NeonMagenta = Color(0xFFFF00E5)
private val NeonViolet = Color(0xFF8F00FF)

/**
 * Animated neon splash: a pulsing reactor ring with a sweeping sheen and a staggered wordmark
 * reveal, then [onFinished]. Self-contained (own palette) so it can run before the app theme exists.
 */
@Composable
fun NeonSplashScreen(onFinished: () -> Unit, holdMs: Long = 1400L) {
    val t = rememberInfiniteTransition(label = "splash")
    val pulse by t.animateFloat(
        0.86f, 1.14f,
        infiniteRepeatable(tween(1100, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "pulse",
    )
    val sweep by t.animateFloat(
        0f, 1f,
        infiniteRepeatable(tween(1700, easing = LinearEasing), RepeatMode.Restart),
        label = "sweep",
    )
    val appear = remember { Animatable(0f) }
    val wordIn = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        appear.animateTo(1f, tween(700, easing = FastOutSlowInEasing))
        wordIn.animateTo(1f, tween(650, easing = FastOutSlowInEasing))
        delay(holdMs)
        onFinished()
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF03030A)), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize().alpha(appear.value)) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val r = size.minDimension * 0.22f * pulse
            val strokeW = 7.dp.toPx()

            // outer bloom
            drawCircle(
                Brush.radialGradient(
                    listOf(NeonCyan.copy(alpha = 0.38f), NeonViolet.copy(alpha = 0.16f), Color.Transparent),
                    center = Offset(cx, cy), radius = r * 2.5f,
                ),
                radius = r * 2.5f, center = Offset(cx, cy),
            )
            // counter-rotating neon rings
            drawCircle(Brush.sweepGradient(listOf(NeonCyan, NeonMagenta, NeonViolet, NeonCyan), center = Offset(cx, cy)),
                radius = r, center = Offset(cx, cy), style = Stroke(width = strokeW))
            drawCircle(Brush.sweepGradient(listOf(NeonMagenta, NeonViolet, NeonCyan, NeonMagenta), center = Offset(cx, cy)),
                radius = r * 0.66f, center = Offset(cx, cy), style = Stroke(width = strokeW * 0.55f))
            // sweeping sheen arc
            val a0 = sweep * 360f
            drawArc(
                brush = Brush.sweepGradient(listOf(Color.Transparent, NeonCyan, Color.Transparent), center = Offset(cx, cy)),
                startAngle = a0, sweepAngle = 90f, useCenter = false,
                topLeft = Offset(cx - r * 1.35f, cy - r * 1.35f),
                size = androidx.compose.ui.geometry.Size(r * 2.7f, r * 2.7f),
                style = Stroke(width = strokeW * 0.5f),
            )
            // core glow
            drawCircle(Brush.radialGradient(listOf(Color.White.copy(alpha = 0.85f), NeonCyan.copy(alpha = 0.35f), Color.Transparent)),
                radius = r * 0.42f, center = Offset(cx, cy))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(top = 260.dp)) {
            Text(
                "NOCTERNAL PLAY",
                style = TextStyle(
                    fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black,
                    fontSize = 26.sp, letterSpacing = 5.sp,
                    brush = Brush.horizontalGradient(listOf(NeonCyan, NeonMagenta, NeonCyan)),
                ),
                modifier = Modifier.alpha(wordIn.value),
            )
            Text(
                "by SplitFire Production",
                style = TextStyle(
                    fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold,
                    fontSize = 10.sp, letterSpacing = 2.sp, color = NeonCyan.copy(alpha = 0.75f),
                ),
                modifier = Modifier.alpha(wordIn.value * 0.9f),
            )
        }
    }
}
