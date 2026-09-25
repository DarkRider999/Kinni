package com.nocternal.playz.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.designsystem.toColor
import com.nocternal.playz.lighting.LightingCanvas
import com.nocternal.playz.lighting.NeonLightBar
import com.nocternal.playz.model.EdgeLightingMode
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.SpectrumFrame
import com.nocternal.playz.theme.ThemeEvent
import com.nocternal.playz.theme.ThemePresets
import kotlin.math.sin

private val SWATCHES = listOf("#00F0FF", "#FF00E5", "#8F00FF", "#00A3FF", "#00F5A0", "#B6FF00", "#FFC940", "#FF8A00", "#FF1744", "#FF2E88", "#FFFFFF").map(NeonColor::hex)

/** Lighting screen (spec §5/§6/§10): light bar, edge lighting, the 10-animation grid and theme presets. */
@Composable
fun LightingScreen(c: AppContainer, spectrum: SpectrumFrame, playing: Boolean) {
    val p = Neon.palette
    val lighting by c.lighting.state.collectAsStateWithLifecycle()
    val decision by c.themeSwitcher.current.collectAsStateWithLifecycle()
    val appSettings by c.settingsRepo.settings.collectAsStateWithLifecycle()
    // When nothing plays, previews run on a gentle synthetic spectrum so the grid still moves.
    val preview = if (playing) spectrum else remember { demoSpectrum() }
    fun settings(block: (com.nocternal.playz.model.AppSettings) -> com.nocternal.playz.model.AppSettings) = c.settingsRepo.update(block)

    LazyColumn(Modifier.fillMaxSize().statusBarsPadding(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Lighting", style = MaterialTheme.typography.headlineSmall, color = p.onBackground) }
        item { Text("Theme: ${decision.preset.name} · ${decision.reason}", style = MaterialTheme.typography.labelSmall, color = p.accent) }

        item { SectionTitle("Light bar") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                NeonLightBar(lighting, preview, Modifier.clip(RoundedCornerShape(12.dp)), playing = true)
                ToggleRow("Enabled", lighting.lightBarEnabled) { on -> settings { it.copy(lightBar = it.lightBar.copy(enabled = on)) } }
                Text("Color", color = p.muted, style = MaterialTheme.typography.labelSmall)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 6.dp)) {
                    item { Swatch(null, lighting.lightBarColor == null) { settings { it.copy(lightBar = it.lightBar.copy(color = null)) } } }
                    items(SWATCHES) { col -> Swatch(col, lighting.lightBarColor == col) { settings { it.copy(lightBar = it.lightBar.copy(color = col)) } } }
                }
                LabeledSlider("Glow intensity", lighting.lightBarGlow, 0f..1f) { v -> settings { it.copy(lightBar = it.lightBar.copy(glowIntensity = v)) } }
            }
        }

        item { SectionTitle("Edge lighting") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                ToggleRow("Enabled", lighting.edgeEnabled) { on -> settings { it.copy(edgeLighting = it.edgeLighting.copy(enabled = on)) } }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(EdgeLightingMode.entries.filter { it != EdgeLightingMode.OFF }) { m ->
                        NeonChip(m.label, selected = lighting.edgeMode == m) { c.lighting.setEdgeMode(m); settings { it.copy(edgeLighting = it.edgeLighting.copy(mode = m)) } }
                    }
                }
                LabeledSlider("Thickness", lighting.edgeThickness, 1f..12f) { v -> c.lighting.setEdgeStyle(v, lighting.edgeBrightness); settings { it.copy(edgeLighting = it.edgeLighting.copy(thickness = v)) } }
                LabeledSlider("Brightness", lighting.edgeBrightness, 0f..1f) { v -> c.lighting.setEdgeStyle(lighting.edgeThickness, v); settings { it.copy(edgeLighting = it.edgeLighting.copy(brightness = v)) } }
            }
        }

        item { SectionTitle("Animations") }
        items(LightingAnimation.entries.chunked(2)) { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { a ->
                    val selected = lighting.lightBarAnimation == a
                    Column(
                        Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(Color.Black)
                            .border(if (selected) 2.dp else 1.dp, if (selected) p.accent else p.muted.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                            .clickable { c.lighting.setLightBarAnimation(a); settings { it.copy(lightBar = it.lightBar.copy(animation = a)) } },
                    ) {
                        LightingCanvas(a, preview, Modifier.fillMaxWidth().aspectRatio(1.4f), intensity = 0.9f)
                        Text(a.label, Modifier.padding(8.dp), color = if (selected) p.accent else p.onBackground, style = MaterialTheme.typography.labelSmall)
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        item {
            ToggleRow("Full-screen visualizer behind the player", lighting.backdropAnimation != null) { on ->
                c.lighting.update { it.copy(backdropAnimation = if (on) it.lightBarAnimation else null) }
            }
        }

        item { SectionTitle("Neon theme presets") }
        item {
            ToggleRow("Auto-switch theme by genre", appSettings.autoThemeByGenre) { on -> settings { it.copy(autoThemeByGenre = on) } }
        }
        items(ThemePresets.all.chunked(2)) { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { preset ->
                    GlowCard(Modifier.weight(1f), glowColor = preset.accent.toColor(), onClick = { c.themeSwitcher.onEvent(ThemeEvent.ManualThemeSelected(preset.id)) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(16.dp).clip(CircleShape).background(preset.accent.toColor()))
                            Spacer(Modifier.size(4.dp))
                            Box(Modifier.size(16.dp).clip(CircleShape).background(preset.secondaryAccent.toColor()))
                        }
                        Text(preset.name, color = p.onBackground, style = MaterialTheme.typography.bodyMedium)
                        Text(preset.lightBarAnimation.label, color = p.muted, style = MaterialTheme.typography.labelSmall)
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        item { NeonChip("Resume automatic themes") { c.themeSwitcher.onEvent(ThemeEvent.ManualLockReleased) } }
    }
}

@Composable
fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val p = Neon.palette
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), color = p.onBackground)
        Switch(checked, onChange, colors = SwitchDefaults.colors(checkedTrackColor = p.accent, checkedThumbColor = Color.Black))
    }
}

@Composable
fun LabeledSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, format: (Float) -> String = { "%.2f".format(it) }, onChange: (Float) -> Unit) {
    val p = Neon.palette
    Column {
        Row { Text(label, Modifier.weight(1f), color = p.muted, style = MaterialTheme.typography.labelSmall); Text(format(value), color = p.accent, style = MaterialTheme.typography.labelSmall) }
        Slider(value, onChange, valueRange = range, colors = SliderDefaults.colors(thumbColor = p.accent, activeTrackColor = p.accent))
    }
}

@Composable
private fun Swatch(color: NeonColor?, selected: Boolean, onClick: () -> Unit) {
    val p = Neon.palette
    Box(
        Modifier.size(34.dp).clip(CircleShape)
            .background(color?.toColor() ?: p.accent)
            .border(if (selected) 3.dp else 1.dp, if (selected) Color.White else Color.White.copy(alpha = 0.2f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { if (color == null) Text("A", color = Color.Black, style = MaterialTheme.typography.labelSmall) }
}

private fun demoSpectrum(): SpectrumFrame {
    val bands = FloatArray(SpectrumFrame.BAND_COUNT) { i -> 0.35f + 0.3f * sin(i * 0.5f).let { it * it } }
    return SpectrumFrame(bands, 0.5f, 0.45f, 0.5f, 0.45f, false)
}
