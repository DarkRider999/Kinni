package com.nocternal.playz.ui.radio

import androidx.compose.foundation.Canvas
import com.nocternal.playz.radio.RadioStation
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.neonGlow
import kotlin.math.abs
import kotlin.math.roundToInt

const val FM_MIN = 87.5f
const val FM_MAX = 108.0f

/** Nearest station within half a channel of [freq], or null (static). */
fun tuneTo(stations: List<RadioStation>, freq: Float, tolerance: Float = 0.25f): RadioStation? =
    stations.minByOrNull { abs((it.fmFrequency ?: 0f) - freq) }?.takeIf { abs((it.fmFrequency ?: 0f) - freq) <= tolerance }

/**
 * FM dial (spec §10 Radio Hub). Drag to tune across 87.5–108 MHz in 0.1 steps; station marks glow, and
 * letting go on a station plays its internet stream. (Phones don't expose FM tuner hardware through a
 * public API, so the dial tunes the same stations' online streams.)
 */
@Composable
fun FmDial(frequency: Float, stations: List<RadioStation>, onTune: (Float) -> Unit, onSettle: (Float) -> Unit, modifier: Modifier = Modifier) {
    val p = Neon.palette
    val freq by rememberUpdatedState(frequency)
    val tuned = tuneTo(stations, frequency)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("%.1f".format(frequency), fontSize = 44.sp, fontWeight = FontWeight.Black, color = if (tuned != null) p.accent else p.onBackground, modifier = Modifier.neonGlow(p.accent, if (tuned != null) p.glow else 0f, corner = 12.dp))
        Text(tuned?.name ?: "· · · static · · ·", style = MaterialTheme.typography.labelSmall, color = if (tuned != null) p.secondary else p.muted)
        Canvas(
            Modifier.fillMaxWidth().height(90.dp).pointerInput(Unit) {
                detectHorizontalDragGestures(onDragEnd = { onSettle(freq) }) { change, drag ->
                    change.consume()
                    val mhzPerPx = 6f / size.width // about 6 MHz visible across the dial
                    val next = ((freq - drag * mhzPerPx) * 10).roundToInt() / 10f
                    onTune(next.coerceIn(FM_MIN, FM_MAX))
                }
            },
        ) {
            val span = 6f
            val pxPerMhz = size.width / span
            val start = frequency - span / 2
            var f = (start * 10).roundToInt() / 10f
            while (f <= start + span) {
                val x = (f - start) * pxPerMhz
                val major = ((f * 10).roundToInt() % 10) == 0
                val h = if (major) size.height * 0.45f else size.height * 0.2f
                if (f in FM_MIN..FM_MAX) drawLine(p.muted.copy(alpha = if (major) 0.8f else 0.35f), Offset(x, size.height - h), Offset(x, size.height), if (major) 2f else 1f)
                f = ((f + 0.1f) * 10).roundToInt() / 10f
            }
            stations.forEach { s ->
                val sf = s.fmFrequency ?: return@forEach
                if (sf in start..start + span) {
                    val x = (sf - start) * pxPerMhz
                    drawCircle(p.secondary.copy(alpha = 0.3f), 10f, Offset(x, size.height * 0.3f))
                    drawCircle(p.secondary, 4f, Offset(x, size.height * 0.3f))
                }
            }
            drawLine(Brush.verticalGradient(listOf(p.accent, p.secondary)), Offset(size.width / 2, 0f), Offset(size.width / 2, size.height), 4f)
        }
    }
}
