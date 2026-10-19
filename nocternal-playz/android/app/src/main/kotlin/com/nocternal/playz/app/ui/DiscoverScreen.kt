package com.nocternal.playz.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.intelligence.CrowdEnergyPresets
import com.nocternal.playz.intelligence.EnergyCurve
import com.nocternal.playz.intelligence.PromptPlaylistParser
import com.nocternal.playz.intelligence.Recommendation
import com.nocternal.playz.model.Track

private val QUICK_PROMPTS = listOf(
    "Chill study music for a rainy evening", "High energy workout", "Romantic night in",
    "Devotional morning", "Late night focus", "Sunny day drive",
)

/** Discover (spec #23-27): FutureCast queue, Discovery Radar, a free-text prompt playlist builder and Crowd Energy Mode. */
@Composable
fun DiscoverScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val lib by c.library.data.collectAsStateWithLifecycle()
    val playback by c.audio.state.collectAsStateWithLifecycle()
    var prompt by remember { mutableStateOf("") }
    var built by remember { mutableStateOf<List<Track>>(emptyList()) }

    val trackMap = remember(lib.tracks) { lib.tracks.associateBy { it.id } }
    val recentIds = remember(lib.history) { lib.history.takeLast(30).map { it.trackId }.toSet() }
    val futureCast = remember(playback.track?.id, lib) {
        c.futureCast.predict(playback.track, c.hour(), lib.history, trackMap, lib.tracks, recentIds)
    }
    val gems = remember(lib) { c.discoveryRadar.forgottenGems(lib.tracks, lib.history, lib.favorites) }

    fun play(tracks: List<Track>, index: Int = 0) { if (tracks.isNotEmpty()) { c.audio.playQueue(tracks, index); onOpenPlayer() } }
    fun buildFromPrompt(text: String) {
        prompt = text
        built = c.promptPlaylistBuilder.build(PromptPlaylistParser.parse(text), lib.tracks)
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Discover", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (futureCast.isNotEmpty()) {
                item { SectionTitle("What's next", action = { NeonChip("▶ Play all") { play(futureCast.map { it.track }) } }) }
                items(futureCast, key = { "fc_" + it.track.id }) { RecommendationRow(c, it, playback.track) { play(futureCast.map { r -> r.track }, futureCast.indexOf(it)) } }
            }
            if (gems.isNotEmpty()) {
                item { SectionTitle("Discovery Radar · forgotten gems") }
                items(gems, key = { "dr_" + it.track.id }) { RecommendationRow(c, it, null) { play(gems.map { r -> r.track }, gems.indexOf(it)) } }
            }

            item { SectionTitle("Ask for a playlist") }
            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = prompt, onValueChange = { prompt = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                        placeholder = { Text("e.g. chill study music for a rainy evening", color = p.muted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, unfocusedBorderColor = p.muted),
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(QUICK_PROMPTS) { q -> NeonChip(q, selected = prompt == q) { buildFromPrompt(q) } }
                    }
                    NeonButton("Build playlist") { buildFromPrompt(prompt) }
                    if (built.isEmpty() && prompt.isNotBlank()) Text("No matches in your library for that yet.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                }
            }
            if (built.isNotEmpty()) {
                item { SectionTitle("${built.size} songs", action = { NeonChip("▶ Play all") { play(built) } }) }
                items(built.take(30), key = { "bp_" + it.id }) { t -> TrackRow(c, t, t.id in lib.favorites) { play(built, built.indexOf(t)) } }
            }

            item { SectionTitle("Crowd Energy Mode") }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(CrowdEnergyPresets.all) { curve: EnergyCurve ->
                        NeonChip(curve.label) { play(c.crowdEnergyBuilder.build(curve, lib.tracks)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecommendationRow(c: AppContainer, rec: Recommendation, seed: Track?, onClick: () -> Unit) {
    val p = Neon.palette
    val reasonText = remember(seed?.id, rec.track.id) {
        if (seed != null) "Added because: " + c.recommendationExplanation.explain(seed, rec.track).reasons.joinToString(" · ") else rec.reason
    }
    Column {
        TrackRow(c, rec.track, false, onClick)
        Text(reasonText, color = p.muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(start = 60.dp))
    }
}
