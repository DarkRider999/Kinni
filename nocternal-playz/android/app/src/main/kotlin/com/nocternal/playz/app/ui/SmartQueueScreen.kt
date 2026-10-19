package com.nocternal.playz.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.intelligence.QueueAction
import com.nocternal.playz.intelligence.QueueSuggestion

/** Smart Queue (Phase 4A, spec #2-3): Queue Intelligence actions over the current track, each suggestion explained. */
@Composable
fun SmartQueueScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val playback by c.audio.state.collectAsStateWithLifecycle()
    val lib by c.library.data.collectAsStateWithLifecycle()
    var selected by remember { mutableStateOf<QueueAction?>(null) }
    var suggestions by remember { mutableStateOf<List<QueueSuggestion>>(emptyList()) }

    fun run(action: QueueAction) {
        selected = action
        val exclude = playback.queue.map { it.id }.toSet()
        suggestions = c.queueIntelligence.apply(action, playback.track, lib.tracks, exclude)
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Smart Queue", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        Text(
            playback.track?.let { "Based on “${it.title}”" } ?: "Nothing playing — suggestions use your overall taste",
            color = p.muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 16.dp),
        )
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)) {
            items(QueueAction.entries) { action -> NeonChip(action.label, selected = selected == action) { run(action) } }
        }
        if (suggestions.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(if (selected == null) "Pick an action to build a queue." else "No matches in your library for that.", color = p.muted)
            }
            return@Column
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                NeonButton("▶ Play this queue", Modifier.fillMaxWidth()) {
                    c.audio.playQueue(suggestions.map { it.track }, 0)
                    onOpenPlayer()
                }
            }
            items(suggestions, key = { it.track.id }) { s -> SuggestionRow(s) }
        }
    }
}

@Composable
private fun SuggestionRow(s: QueueSuggestion) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth()) {
        Text(s.track.title, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(s.track.artist, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        Text("Added because: ${s.why.reasons.joinToString(" · ")}", color = p.accent, style = MaterialTheme.typography.labelSmall)
    }
}
