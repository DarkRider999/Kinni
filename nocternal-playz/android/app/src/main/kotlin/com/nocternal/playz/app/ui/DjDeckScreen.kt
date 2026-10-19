package com.nocternal.playz.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.automix.AutoMixPlanner
import com.nocternal.playz.automix.SetStep
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/** DJ Deck (spec §6-14): Camelot wheel, live BPM/key readout, Auto Set Builder and the local-only session recorder. */
@Composable
fun DjDeckScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val playback by c.audio.state.collectAsStateWithLifecycle()
    val lib by c.library.data.collectAsStateWithLifecycle()
    val recording by c.djSessionRecorder.recording.collectAsStateWithLifecycle()
    val entries by c.djSessionRecorder.entries.collectAsStateWithLifecycle()
    var wantEnergyRise by remember { mutableStateOf(false) }
    var set by remember { mutableStateOf<List<SetStep>>(emptyList()) }

    val current = playback.track
    val nextCandidate = remember(current?.id, lib.tracks, wantEnergyRise) {
        current?.let { t -> AutoMixPlanner().next(t, lib.tracks, emptySet(), wantEnergyRise) }
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("DJ Deck", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    if (current == null) {
                        Text("Play something to see its key and BPM here.", color = p.muted)
                    } else {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(current.title, color = p.onBackground, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                                Text(listOfNotNull(current.bpm?.let { "${it.toInt()} BPM" }, current.camelotKey?.let { "Key $it" }).joinToString(" · "), color = p.accent, style = MaterialTheme.typography.bodyMedium)
                            }
                            nextCandidate?.let { cand ->
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Next: ${cand.track.title}", color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                                    Text(cand.relation.label, color = p.secondary, style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }

            item { SectionTitle("Camelot wheel") }
            item { CamelotWheel(current?.camelotKey, nextCandidate?.track?.camelotKey, Modifier.fillMaxWidth().aspectRatio(1f)) }

            item { SectionTitle("Auto Set Builder") }
            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NeonChip("Keep energy steady", selected = !wantEnergyRise) { wantEnergyRise = false }
                        NeonChip("Build energy ↑", selected = wantEnergyRise) { wantEnergyRise = true }
                    }
                    NeonButton("Build set from current track") {
                        current?.let { set = c.autoSetBuilder.build(it, lib.tracks, length = 10, wantEnergyRise = wantEnergyRise) }
                    }
                    if (set.isNotEmpty()) {
                        NeonButton("▶ Play this set") { c.audio.playQueue(set.map { it.track }, 0); onOpenPlayer() }
                        set.forEach { step ->
                            Text(
                                step.track.title + (step.transitionIn?.let { " — ${it.explanation}" } ?: " (start)"),
                                color = p.onBackground, style = MaterialTheme.typography.bodySmall, maxLines = 1,
                            )
                        }
                    }
                }
            }

            item { SectionTitle("DJ session recorder") }
            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        IconButton(onClick = { if (recording) c.djSessionRecorder.stop()?.let(c.library::savePlaylist) else c.djSessionRecorder.start() }) {
                            Icon(if (recording) Icons.Filled.Stop else Icons.Filled.FiberManualRecord, if (recording) "Stop recording" else "Start recording", tint = if (recording) p.secondary else p.accent)
                        }
                        Text(if (recording) "Recording · ${entries.size} tracks so far" else "Not recording — tap to start capturing this set as a playlist", color = p.muted, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun CamelotWheel(currentCamelot: String?, nextCamelot: String?, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val density = LocalDensity.current
        val outerRadiusPx = with(density) { (minOf(maxWidth, maxHeight) / 2 * 0.86f).toPx() }
        val innerRadiusPx = outerRadiusPx * 0.58f
        for (n in 1..12) {
            val angle = Math.toRadians((n - 1) * 30.0 - 90.0)
            val cosA = cos(angle).toFloat(); val sinA = sin(angle).toFloat()
            CamelotCell("${n}B", currentCamelot == "${n}B", nextCamelot == "${n}B", Modifier.offset { IntOffset((cosA * outerRadiusPx).roundToInt(), (sinA * outerRadiusPx).roundToInt()) })
            CamelotCell("${n}A", currentCamelot == "${n}A", nextCamelot == "${n}A", Modifier.offset { IntOffset((cosA * innerRadiusPx).roundToInt(), (sinA * innerRadiusPx).roundToInt()) })
        }
    }
}

@Composable
private fun CamelotCell(label: String, isCurrent: Boolean, isNext: Boolean, modifier: Modifier) {
    val p = Neon.palette
    val color = when { isCurrent -> p.accent; isNext -> p.secondary; else -> p.muted }
    Box(
        modifier.size(if (isCurrent) 40.dp else 32.dp).clip(CircleShape)
            .background(if (isCurrent || isNext) color.copy(alpha = 0.25f) else p.surface)
            .border(1.dp, color, CircleShape),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = color, style = MaterialTheme.typography.labelSmall) }
}
