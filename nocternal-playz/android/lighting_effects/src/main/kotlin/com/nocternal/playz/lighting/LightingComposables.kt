package com.nocternal.playz.lighting

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.toColor
import com.nocternal.playz.model.EdgeLightingMode
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.SpectrumFrame

/** Animation clock + beat envelope shared by all lighting views. */
private class Clock { var time by mutableFloatStateOf(0f); var pulse by mutableFloatStateOf(0f) }

@Composable
private fun rememberClock(spectrum: SpectrumFrame, running: Boolean): Clock {
    val clock = remember { Clock() }
    val latest by rememberUpdatedState(spectrum)
    LaunchedEffect(running) {
        var last = 0L
        while (true) {
            withFrameNanos { now ->
                val dt = if (last == 0L) 0f else (now - last) / 1e9f
                last = now
                clock.time += if (running) dt else dt * 0.2f
                clock.pulse = if (latest.beat) 1f else (clock.pulse - dt * 3f).coerceAtLeast(0f)
            }
        }
    }
    return clock
}

/** Any of the ten animations, full size. Used by the Lighting screen previews and the player visualizer. */
@Composable
fun LightingCanvas(
    animation: LightingAnimation,
    spectrum: SpectrumFrame,
    modifier: Modifier = Modifier,
    intensity: Float = 1f,
    primary: Color = Neon.palette.accent,
    secondary: Color = Neon.palette.secondary,
    running: Boolean = true,
) {
    val clock = rememberClock(spectrum, running)
    val stars = remember { StarField() }
    Canvas(modifier.clipToBounds()) {
        LightingAnimations.draw(this, animation, LightFrame(clock.time, spectrum, clock.pulse, primary, secondary, intensity), stars)
    }
}

/** The neon light bar (spec §5A): a slim reactive strip with the selected animation, colour and glow. */
@Composable
fun NeonLightBar(state: LightingState, spectrum: SpectrumFrame, modifier: Modifier = Modifier, height: Dp = 56.dp, playing: Boolean = true) {
    if (!state.lightBarEnabled) return
    val color = state.lightBarColor?.toColor() ?: Neon.palette.accent
    LightingCanvas(
        state.lightBarAnimation, spectrum, modifier.fillMaxWidth().height(height),
        intensity = state.lightBarGlow, primary = color, secondary = Neon.palette.secondary, running = playing,
    )
}

/** Neon glow around the whole screen (spec §5B). Draw it as the top layer; it ignores touches. */
@Composable
fun EdgeLightingOverlay(state: LightingState, spectrum: SpectrumFrame, modifier: Modifier = Modifier, cornerRadius: Dp = 32.dp) {
    if (!state.edgeEnabled || state.edgeMode == EdgeLightingMode.OFF) return
    val p = Neon.palette
    val clock = rememberClock(spectrum, true)
    Canvas(modifier.fillMaxSize()) {
        val level = when (state.edgeMode) {
            EdgeLightingMode.MUSIC_REACTIVE -> 0.35f + 0.65f * maxOf(spectrum.bass, clock.pulse)
            else -> 1f
        }
        val alpha = (state.edgeBrightness * level).coerceIn(0f, 1f)
        val stroke = state.edgeThickness.dp.toPx() * (if (state.edgeMode == EdgeLightingMode.MUSIC_REACTIVE) 0.7f + 0.6f * spectrum.bass else 1f)
        val brush = when (state.edgeMode) {
            EdgeLightingMode.STATIC -> Brush.linearGradient(listOf(p.accent, p.accent))
            EdgeLightingMode.GRADIENT -> {
                val shift = (clock.time * 0.15f) % 1f
                Brush.sweepGradient(listOf(p.accent, p.secondary, p.accent, p.secondary, p.accent).let { c -> c.drop((shift * 4).toInt()) + c.take((shift * 4).toInt()) }, center)
            }
            else -> Brush.sweepGradient(listOf(p.accent, p.secondary, p.accent), center)
        }
        val r = cornerRadius.toPx()
        // Soft outer glow layers, then the crisp line.
        for (layer in 3 downTo 1) {
            drawRoundRect(brush, Offset(stroke / 2, stroke / 2), Size(size.width - stroke, size.height - stroke), CornerRadius(r), alpha = alpha * 0.15f * layer, style = Stroke(stroke * (1 + layer * 1.5f)))
        }
        drawRoundRect(brush, Offset(stroke / 2, stroke / 2), Size(size.width - stroke, size.height - stroke), CornerRadius(r), alpha = alpha, style = Stroke(stroke))
    }
}
