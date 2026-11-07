package com.nocternal.playz.ui.player

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.fx.analysis.BeatGrid

/** Beat-grid tick marks over a waveform: a thin line on every beat, a taller/brighter one every bar (4 beats).
 *  Purely derived from the track's own BPM — no extra decode pass. */
@Composable
fun BeatGridOverlay(durationMs: Long, bpm: Float?, modifier: Modifier = Modifier, barHeight: androidx.compose.ui.unit.Dp = 56.dp) {
    if (bpm == null || bpm <= 0f || durationMs <= 0L) return
    val p = Neon.palette
    val beats = remember(durationMs, bpm) { BeatGrid.beatsMs(durationMs, bpm) }
    val bars = remember(durationMs, bpm) { BeatGrid.barsMs(durationMs, bpm).toSet() }
    Canvas(modifier.fillMaxWidth().height(barHeight)) {
        beats.forEach { ms ->
            val x = size.width * (ms.toFloat() / durationMs)
            val isBar = ms in bars
            val tickHeight = if (isBar) size.height * 0.9f else size.height * 0.4f
            drawLine(
                color = (if (isBar) p.accent else p.muted).copy(alpha = if (isBar) 0.55f else 0.25f),
                start = Offset(x, 0f), end = Offset(x, tickHeight), strokeWidth = if (isBar) 2f else 1f,
            )
        }
    }
}
