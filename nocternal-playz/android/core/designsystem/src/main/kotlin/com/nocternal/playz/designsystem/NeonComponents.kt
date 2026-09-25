package com.nocternal.playz.designsystem

import android.graphics.BlurMaskFilter
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Soft neon glow drawn behind the content with a blurred rounded rect. */
fun Modifier.neonGlow(color: Color, intensity: Float, radius: Dp = 18.dp, corner: Dp = 20.dp): Modifier = drawBehind {
    if (intensity <= 0.01f) return@drawBehind
    drawIntoCanvas { canvas ->
        val paint = Paint()
        paint.asFrameworkPaint().apply {
            isAntiAlias = true
            this.color = color.copy(alpha = (0.55f * intensity).coerceIn(0f, 1f)).toArgb()
            maskFilter = BlurMaskFilter(radius.toPx().coerceAtLeast(1f), BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawRoundRect(0f, 0f, size.width, size.height, corner.toPx(), corner.toPx(), paint)
    }
}

@Composable
fun GlowCard(
    modifier: Modifier = Modifier,
    glowColor: Color = Neon.palette.accent,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = Neon.palette
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier
            .neonGlow(glowColor, p.glow * 0.6f)
            .clip(shape)
            .background(p.surface)
            .border(BorderStroke(1.dp, Brush.linearGradient(listOf(glowColor.copy(alpha = 0.9f), p.secondary.copy(alpha = 0.4f)))), shape)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(16.dp),
        content = content,
    )
}

@Composable
fun NeonButton(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, onClick: () -> Unit) {
    val p = Neon.palette
    Box(
        modifier
            .neonGlow(p.accent, p.glow, corner = 28.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(Brush.horizontalGradient(listOf(p.accent, p.secondary)))
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) { Icon(icon, null, tint = Color.Black, modifier = Modifier.size(18.dp)); androidx.compose.foundation.layout.Spacer(Modifier.width(8.dp)) }
            Text(text, color = Color.Black, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun NeonIconButton(icon: ImageVector, contentDescription: String?, modifier: Modifier = Modifier, size: Dp = 48.dp, active: Boolean = false, onClick: () -> Unit) {
    val p = Neon.palette
    Box(
        modifier
            .size(size)
            .neonGlow(p.accent, if (active) p.glow else p.glow * 0.25f, corner = size / 2)
            .clip(CircleShape)
            .background(if (active) p.accent.copy(alpha = 0.2f) else p.surface)
            .border(1.dp, p.accent.copy(alpha = if (active) 1f else 0.4f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription, tint = if (active) p.accent else p.onBackground, modifier = Modifier.size(size * 0.5f)) }
}

@Composable
fun NeonChip(text: String, selected: Boolean = false, modifier: Modifier = Modifier, color: Color = Neon.palette.accent, onClick: () -> Unit) {
    val p = Neon.palette
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) color.copy(alpha = 0.22f) else p.surface,
        border = BorderStroke(1.dp, color.copy(alpha = if (selected) 1f else 0.35f)),
        modifier = modifier,
    ) { Text(text, Modifier.padding(horizontal = 14.dp, vertical = 8.dp), color = if (selected) color else p.onBackground, style = MaterialTheme.typography.bodyMedium) }
}

/** Vertical neon slider used by the 10-band EQ. Value range -12..12 dB by default. */
@Composable
fun NeonVerticalSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    range: ClosedFloatingPointRange<Float> = -12f..12f,
    label: String = "",
) {
    val p = Neon.palette
    val current by rememberUpdatedState(value)
    val span = range.endInclusive - range.start
    Column(modifier.fillMaxHeight().widthIn(min = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("${if (value > 0) "+" else ""}${value.toInt()}", style = MaterialTheme.typography.labelSmall, color = p.accent)
        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .pointerInput(range) {
                    fun toValue(y: Float) = (range.endInclusive - (y / size.height) * span).coerceIn(range)
                    detectTapGestures { onValueChange(toValue(it.y)) }
                }
                .pointerInput(range) {
                    detectDragGestures { change, _ -> onValueChange((range.endInclusive - (change.position.y / size.height) * span).coerceIn(range)) }
                }
                .drawBehind {
                    val x = size.width / 2
                    val frac = (current - range.start) / span
                    val y = size.height * (1 - frac)
                    val zeroY = size.height * (1 - (0f - range.start) / span)
                    drawRoundRect(p.muted.copy(alpha = 0.3f), Offset(x - 2.dp.toPx(), 0f), androidx.compose.ui.geometry.Size(4.dp.toPx(), size.height), CornerRadius(2.dp.toPx()))
                    drawLine(Brush.verticalGradient(listOf(p.accent, p.secondary)), Offset(x, zeroY), Offset(x, y), strokeWidth = 4.dp.toPx())
                    drawCircle(p.accent.copy(alpha = 0.35f * p.glow), 14.dp.toPx(), Offset(x, y))
                    drawCircle(p.accent, 7.dp.toPx(), Offset(x, y))
                },
        )
        Text(label, style = MaterialTheme.typography.labelSmall, color = p.muted, fontSize = 9.sp, textAlign = TextAlign.Center)
    }
}

/** Pulsing voice orb for the AI assistant. [level] 0..1 animates it while listening. */
@Composable
fun VoiceOrb(listening: Boolean, level: Float, modifier: Modifier = Modifier, size: Dp = 88.dp, onClick: () -> Unit) {
    val p = Neon.palette
    val t = rememberInfiniteTransition(label = "orb")
    val pulse by t.animateFloat(0.9f, 1.1f, infiniteRepeatable(tween(1200), RepeatMode.Reverse), label = "pulse")
    val scale = if (listening) 1f + level * 0.35f else pulse
    Box(
        modifier
            .size(size)
            .pointerInput(Unit) { detectTapGestures { onClick() } }
            .drawBehind {
                val r = this.size.minDimension / 2
                drawCircle(Brush.radialGradient(listOf(p.accent.copy(alpha = 0.5f * p.glow), Color.Transparent)), r * scale * 1.3f)
                drawCircle(Brush.sweepGradient(listOf(p.accent, p.secondary, p.accent)), r * 0.7f * scale)
                drawCircle(Color.Black.copy(alpha = 0.35f), r * 0.45f * scale)
            },
    )
}

/** The NOCTERNAL PLAYZ wordmark with a neon gradient and glow. */
@Composable
fun NeonLogo(modifier: Modifier = Modifier, showByline: Boolean = true) {
    val p = Neon.palette
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "NOCTERNAL PLAYZ",
            style = MaterialTheme.typography.displaySmall.copy(
                brush = Brush.horizontalGradient(listOf(p.accent, p.secondary)),
                shadow = androidx.compose.ui.graphics.Shadow(p.accent.copy(alpha = p.glow), Offset.Zero, 24f),
                fontSize = 26.sp,
            ),
        )
        if (showByline) Text("by Roshan", style = MaterialTheme.typography.labelSmall, color = p.muted)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    androidx.compose.foundation.layout.Row(modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = Neon.palette.accent, modifier = Modifier.weight(1f))
        action?.invoke()
    }
}

@Composable
fun NeonDivider(modifier: Modifier = Modifier) {
    val p = Neon.palette
    Box(modifier.fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, p.accent, p.secondary, Color.Transparent))))
}
