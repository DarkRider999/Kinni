package com.nocternal.playz.ui.player

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.nocternal.playz.designsystem.Neon
import kotlin.math.abs
import kotlin.math.sin
import kotlin.random.Random

/**
 * Waveform seek bar. The waveform shape is a stable per-track pseudo-waveform (the real peaks can be plugged in
 * via [peaks]); played bars glow in the accent gradient, and the bar under the playhead pulses with the bass.
 */
@Composable
fun WaveformSeekBar(
    trackId: String?,
    positionMs: Long,
    durationMs: Long,
    bass: Float,
    onSeek: (Long) -> Unit,
    modifier: Modifier = Modifier,
    peaks: FloatArray? = null,
) {
    val p = Neon.palette
    val bars = remember(trackId, peaks) {
        peaks ?: Random(trackId.hashCode()).let { rnd -> FloatArray(64) { i -> (0.25f + 0.75f * abs(sin(i * 0.37f + rnd.nextFloat()))) * (0.6f + 0.4f * rnd.nextFloat()) } }
    }
    var dragFraction by remember { mutableStateOf<Float?>(null) }
    val fraction = dragFraction ?: if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
    Column(modifier) {
        Canvas(
            Modifier.fillMaxWidth().height(56.dp)
                .pointerInput(durationMs) { detectTapGestures { onSeek((it.x / size.width * durationMs).toLong()) } }
                .pointerInput(durationMs) {
                    detectHorizontalDragGestures(
                        onDragEnd = { dragFraction?.let { onSeek((it * durationMs).toLong()) }; dragFraction = null },
                        onDragCancel = { dragFraction = null },
                    ) { change, _ -> dragFraction = (change.position.x / size.width).coerceIn(0f, 1f) }
                },
        ) {
            val w = size.width / bars.size
            val playedBrush = Brush.horizontalGradient(listOf(p.accent, p.secondary))
            bars.forEachIndexed { i, v ->
                val x = i * w + w / 2
                val played = (i + 0.5f) / bars.size <= fraction
                val atHead = abs((i + 0.5f) / bars.size - fraction) < 1f / bars.size
                val h = size.height * v * (if (atHead) 1f + bass * 0.4f else 1f).coerceAtMost(1.2f) * 0.8f
                if (played) drawLine(playedBrush, Offset(x, size.height / 2 - h / 2), Offset(x, size.height / 2 + h / 2), w * 0.55f, StrokeCap.Round)
                else drawLine(p.muted.copy(alpha = 0.35f), Offset(x, size.height / 2 - h / 2), Offset(x, size.height / 2 + h / 2), w * 0.55f, StrokeCap.Round)
            }
        }
        Row(Modifier.fillMaxWidth()) {
            Text(formatTime((fraction * durationMs).toLong()), style = MaterialTheme.typography.labelSmall, color = p.muted, modifier = Modifier.weight(1f))
            Text(if (durationMs > 0) formatTime(durationMs) else "LIVE", style = MaterialTheme.typography.labelSmall, color = if (durationMs > 0) p.muted else p.accent)
        }
    }
}

fun formatTime(ms: Long): String {
    val s = (ms / 1000).coerceAtLeast(0)
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)
}
