package com.nocternal.playz.ui.player

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.NeonVerticalSlider
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.fx.CompressorParams
import com.nocternal.playz.fx.EnhancerMode
import com.nocternal.playz.fx.FxSettings
import com.nocternal.playz.fx.dsp.Biquad
import com.nocternal.playz.model.EQ_BAND_FREQUENCIES
import com.nocternal.playz.model.EqPreset
import kotlin.math.log10
import kotlin.math.pow

/** EQ & FX screen (spec §10): 10 sliders, presets, FX grid, AI optimize and the song enhancer. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EqFxScreen(
    fx: FxSettings,
    presets: List<EqPreset>,
    onChange: ((FxSettings) -> FxSettings) -> Unit,
    onPreset: (EqPreset) -> Unit,
    onAiOptimize: () -> Unit,
    onEnhance: (EnhancerMode) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = Neon.palette
    Column(modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("EQ & FX", style = MaterialTheme.typography.headlineSmall, color = p.onBackground, modifier = Modifier.weight(1f))
            Switch(fx.eqEnabled, { on -> onChange { it.copy(eqEnabled = on) } }, colors = SwitchDefaults.colors(checkedTrackColor = p.accent))
        }
        EqCurve(fx, Modifier.fillMaxWidth().height(90.dp))
        GlowCard(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().height(220.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                EQ_BAND_FREQUENCIES.forEachIndexed { i, f ->
                    NeonVerticalSlider(
                        value = fx.eqGainsDb[i],
                        onValueChange = { v -> onChange { s -> s.copy(eqGainsDb = s.eqGainsDb.toMutableList().also { it[i] = Math.round(v * 2) / 2f }) } },
                        label = if (f >= 1000) "${(f / 1000).toInt()}k" else f.toInt().toString(),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(presets, key = { it.id }) { preset -> NeonChip(preset.name, selected = preset.bandGainsDb == fx.eqGainsDb) { onPreset(preset) } }
        }
        Spacer(Modifier.height(12.dp))
        NeonButton("AI optimize for this song", Modifier.fillMaxWidth(), icon = Icons.Filled.AutoAwesome, onClick = onAiOptimize)

        SectionTitle("Enhance")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EnhancerMode.entries.forEach { m -> NeonChip(m.label) { onEnhance(m) } }
        }

        SectionTitle("Sound")
        FxSlider("Preamp", fx.preampDb, -12f..12f, "dB") { v -> onChange { it.copy(preampDb = v) } }
        FxSlider("Bass boost", fx.bassBoost, 0f..1f) { v -> onChange { it.copy(bassBoost = v) } }
        FxSlider("3D surround", fx.surround3d, 0f..1f) { v -> onChange { it.copy(surround3d = v) } }
        FxSlider("Loudness", fx.loudnessDb, 0f..12f, "dB") { v -> onChange { it.copy(loudnessDb = v) } }
        FxSlider("Stereo width", fx.stereoWidth, 0f..2f) { v -> onChange { it.copy(stereoWidth = v) } }
        FxSlider("Pitch shift", fx.pitchSemitones, -12f..12f, "st", steps = 23) { v -> onChange { it.copy(pitchSemitones = v) } }

        SectionTitle("FX grid")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 3) {
            FxTile("Reverb", fx.reverb.enabled) { onChange { it.copy(reverb = it.reverb.copy(enabled = !it.reverb.enabled)) } }
            FxTile("Flanger", fx.flanger.enabled) { onChange { it.copy(flanger = it.flanger.copy(enabled = !it.flanger.enabled)) } }
            FxTile("Phaser", fx.phaser.enabled) { onChange { it.copy(phaser = it.phaser.copy(enabled = !it.phaser.enabled)) } }
            FxTile("Compressor", fx.compressor.enabled) { onChange { it.copy(compressor = if (it.compressor.enabled) it.compressor.copy(enabled = false) else CompressorParams(enabled = true)) } }
            FxTile("Vocal remover", fx.vocalRemover > 0f) { onChange { it.copy(vocalRemover = if (it.vocalRemover > 0f) 0f else 1f) } }
            FxTile("Noise reduction", fx.noiseReduction > 0f) { onChange { it.copy(noiseReduction = if (it.noiseReduction > 0f) 0f else 0.6f) } }
            FxTile("Speaker boost", fx.speakerBoost) { onChange { it.copy(speakerBoost = !it.speakerBoost) } }
            FxTile("Safe mode", fx.safeMode) { onChange { it.copy(safeMode = !it.safeMode) } }
        }
        if (fx.reverb.enabled) {
            SectionTitle("Reverb")
            FxSlider("Room size", fx.reverb.roomSize, 0f..1f) { v -> onChange { it.copy(reverb = it.reverb.copy(roomSize = v)) } }
            FxSlider("Wet", fx.reverb.wet, 0f..1f) { v -> onChange { it.copy(reverb = it.reverb.copy(wet = v)) } }
        }
        if (fx.flanger.enabled) {
            SectionTitle("Flanger")
            FxSlider("Rate", fx.flanger.rateHz, 0.05f..5f, "Hz") { v -> onChange { it.copy(flanger = it.flanger.copy(rateHz = v)) } }
            FxSlider("Depth", fx.flanger.depthMs, 0.5f..10f, "ms") { v -> onChange { it.copy(flanger = it.flanger.copy(depthMs = v)) } }
        }
        if (fx.phaser.enabled) {
            SectionTitle("Phaser")
            FxSlider("Rate", fx.phaser.rateHz, 0.05f..5f, "Hz") { v -> onChange { it.copy(phaser = it.phaser.copy(rateHz = v)) } }
            FxSlider("Feedback", fx.phaser.feedback, 0f..0.9f) { v -> onChange { it.copy(phaser = it.phaser.copy(feedback = v)) } }
        }
        if (fx.compressor.enabled) {
            SectionTitle("Compressor")
            FxSlider("Threshold", fx.compressor.thresholdDb, -40f..0f, "dB") { v -> onChange { it.copy(compressor = it.compressor.copy(thresholdDb = v)) } }
            FxSlider("Ratio", fx.compressor.ratio, 1f..10f, ":1") { v -> onChange { it.copy(compressor = it.compressor.copy(ratio = v)) } }
        }
        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun FxSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, unit: String = "", steps: Int = 0, onValue: (Float) -> Unit) {
    val p = Neon.palette
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.width(110.dp), color = p.onBackground, style = MaterialTheme.typography.bodyMedium)
        Slider(value, onValue, Modifier.weight(1f), valueRange = range, steps = steps, colors = SliderDefaults.colors(thumbColor = p.accent, activeTrackColor = p.accent, inactiveTrackColor = p.muted.copy(alpha = 0.3f)))
        Text(if (unit.isEmpty()) "${(value * 100).toInt()}%" else "%.1f %s".format(value, unit), Modifier.width(64.dp), color = p.accent, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun FxTile(name: String, on: Boolean, onClick: () -> Unit) {
    val p = Neon.palette
    GlowCard(Modifier.width(104.dp), glowColor = if (on) p.accent else p.muted.copy(alpha = 0.2f), onClick = onClick) {
        Text(name, color = if (on) p.accent else p.onBackground, style = MaterialTheme.typography.titleMedium)
        Text(if (on) "ON" else "OFF", color = p.muted, style = MaterialTheme.typography.labelSmall)
    }
}

/** Live EQ response curve computed from the same biquads the audio thread uses. */
@Composable
private fun EqCurve(fx: FxSettings, modifier: Modifier) {
    val p = Neon.palette
    Canvas(modifier) {
        val fs = 48000f
        val filters = EQ_BAND_FREQUENCIES.mapIndexed { i, f -> Biquad().apply { setPeaking(fs, f, 1.41f, fx.eqGainsDb[i]) } }
        val path = Path()
        val n = 120
        for (k in 0..n) {
            val freq = 20f * 1000f.pow(k / n.toFloat())
            val db = filters.sumOf { if (it.isIdentity) 0.0 else it.magnitudeDb(fs, freq) }.toFloat() + fx.preampDb
            val x = size.width * (log10(freq / 20f) / 3f)
            val y = size.height / 2 - db / 24f * size.height
            if (k == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawLine(p.muted.copy(alpha = 0.3f), Offset(0f, size.height / 2), Offset(size.width, size.height / 2), 1f)
        drawPath(path, Brush.horizontalGradient(listOf(p.accent, p.secondary)), style = Stroke(3.dp.toPx()))
    }
}
