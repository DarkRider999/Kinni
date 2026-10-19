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
import androidx.compose.foundation.layout.width
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.intelligence.SmartCollection
import com.nocternal.playz.model.Track

/** Smart Collections (Phase 4B): the 10 auto-generated playlists, recomputed on open from the current library/history. */
@Composable
fun SmartCollectionsScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val lib by c.library.data.collectAsStateWithLifecycle()

    val collections = remember(lib) { c.smartCollections.all(lib.tracks, lib.history, lib.favorites) }

    fun play(tracks: List<Track>, index: Int = 0) { if (tracks.isNotEmpty()) { c.audio.playQueue(tracks, index); onOpenPlayer() } }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Smart Collections", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        if (collections.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Keep listening — collections build up as your history grows.", color = p.muted, style = MaterialTheme.typography.bodyMedium)
            }
            return@Column
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            items(collections, key = { it.id }) { collection -> CollectionSection(collection, onPlayAll = { play(collection.tracks) }, onPlayTrack = { t -> play(collection.tracks, collection.tracks.indexOf(t)) }) }
        }
    }
}

@Composable
private fun CollectionSection(collection: SmartCollection, onPlayAll: () -> Unit, onPlayTrack: (Track) -> Unit) {
    val p = Neon.palette
    Column {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(collection.title, style = MaterialTheme.typography.titleMedium, color = p.onBackground)
                Text(collection.subtitle, color = p.muted, style = MaterialTheme.typography.labelSmall)
            }
            NeonChip("▶ Play all") { onPlayAll() }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(top = 8.dp)) {
            items(collection.tracks.take(15), key = { "${collection.id}_${it.id}" }) { t ->
                GlowCard(Modifier.width(140.dp), onClick = { onPlayTrack(t) }) {
                    Text(t.title, color = p.onBackground, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    Text(t.artist, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                }
            }
        }
    }
}
