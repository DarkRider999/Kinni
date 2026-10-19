package com.nocternal.playz.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.app.JourneyViewModel
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.intelligence.JourneyPlan
import com.nocternal.playz.intelligence.JourneyStep
import java.util.concurrent.TimeUnit

private val JOURNEY_EXAMPLES = listOf(
    "90 minute Progressive House Journey", "Late Night Techno Drive", "Sunset Deep House", "Festival Warmup Set",
)

/** AI Journey Mode (Phase 4A, spec #1): a prompt in, a previewed set out, one tap to start it. */
@Composable
fun JourneyScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val vm: JourneyViewModel = viewModel { JourneyViewModel(c) }
    val plan by vm.plan.collectAsStateWithLifecycle()
    val generating by vm.generating.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var prompt by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("AI Journey Mode", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    Text("Genre, mood, duration, energy goal — in one line.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                    OutlinedTextField(
                        value = prompt, onValueChange = { prompt = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                        placeholder = { Text("e.g. 90 minute Progressive House Journey", color = p.muted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, unfocusedBorderColor = p.muted),
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(JOURNEY_EXAMPLES) { ex -> NeonChip(ex, selected = prompt == ex) { prompt = ex } }
                    }
                    NeonButton(if (generating) "Building…" else "Generate preview") { if (!generating) vm.generate(prompt) }
                    error?.let { Text(it, color = p.secondary, style = MaterialTheme.typography.labelSmall) }
                }
            }
            if (generating) {
                item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = p.accent) } }
            }
            plan?.let { journey ->
                item {
                    GlowCard(Modifier.fillMaxWidth()) {
                        Text(journey.label, style = MaterialTheme.typography.titleMedium, color = p.onBackground)
                        Text(
                            "${journey.trackCount} tracks · ~${TimeUnit.MILLISECONDS.toMinutes(journey.estimatedDurationMs)} min",
                            color = p.muted, style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
                item { SectionTitle("Energy curve") }
                item { EnergyCurveChart(journey.energyCurve) }
                item { SectionTitle("Mood transitions") }
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(journey.moodTransitions.distinct()) { m -> NeonChip(m.label) {} }
                    }
                }
                item { SectionTitle("Planned progression") }
                items(journey.steps.withIndex().toList(), key = { (i, s) -> "$i-${s.track.id}" }) { (i, step) -> JourneyStepRow(i + 1, step) }
                item {
                    NeonButton("▶ START JOURNEY", Modifier.fillMaxWidth()) { if (vm.start()) onOpenPlayer() }
                }
            }
        }
    }
}

@Composable
private fun JourneyStepRow(index: Int, step: JourneyStep) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("$index", color = p.accent, style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(end = 10.dp))
            Column(Modifier.weight(1f)) {
                Text(step.track.title, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val meta = step.transitionIn?.explanation ?: "Opening track · ${step.mood.label}"
                Text(meta, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun EnergyCurveChart(curve: List<Float>) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().height(80.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom) {
            curve.forEach { e ->
                Box(
                    Modifier.weight(1f).fillMaxWidth().height((80 * e.coerceIn(0.04f, 1f)).dp)
                        .clip(RoundedCornerShape(3.dp)).background(p.accent),
                )
            }
        }
    }
}
