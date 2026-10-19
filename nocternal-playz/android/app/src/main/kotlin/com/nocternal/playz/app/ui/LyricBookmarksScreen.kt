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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.model.LyricBookmark

/** Browses saved favourite lyric lines across every track (Phase 4D #15: Lyric Bookmarking). Tapping one jumps
 *  straight to that moment in the song. */
@Composable
fun LyricBookmarksScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val lib by c.library.data.collectAsStateWithLifecycle()
    val bookmarks = lib.lyricBookmarks.sortedByDescending { it.createdAtEpochMs }

    fun play(b: LyricBookmark) {
        val track = c.library.track(b.trackId) ?: return
        c.audio.playQueue(listOf(track), 0)
        c.audio.seekTo(b.lineStartMs)
        onOpenPlayer()
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Lyric Bookmarks", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        if (bookmarks.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Star a lyric line on the Player screen to save it here.", color = p.muted, style = MaterialTheme.typography.bodyMedium)
            }
            return@Column
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(bookmarks, key = { it.trackId + it.lineStartMs }) { b ->
                GlowCard(Modifier.fillMaxWidth(), onClick = { play(b) }) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Star, null, tint = p.accent, modifier = Modifier.padding(end = 12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("“${b.text}”", color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("${b.trackTitle} — ${b.trackArtist}", color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton(onClick = { c.library.removeLyricBookmark(b.trackId, b.lineStartMs) }) {
                            Icon(Icons.Filled.Delete, "Remove bookmark", tint = p.muted)
                        }
                    }
                }
            }
        }
    }
}
