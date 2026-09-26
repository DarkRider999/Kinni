package com.nocternal.playz.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.freemusic.FreeCollection
import com.nocternal.playz.freemusic.FreeTrack
import com.nocternal.playz.offline.OfflineManager
import com.nocternal.playz.ui.player.AlbumArt
import kotlinx.coroutines.launch

private enum class FreeTab(val label: String) { ARCHIVE("Internet Archive"), JAMENDO("Jamendo"), PODCASTS("Podcasts"), SAVED("Downloaded") }

/**
 * Free downloads: Creative Commons and public-domain music (Internet Archive, Jamendo) and podcast episodes,
 * saved to the app for offline play with the licence and a credit link kept for every track.
 */
@Composable
fun FreeMusicScreen(c: AppContainer, onOpenPlayer: () -> Unit, onBack: () -> Unit) {
    val p = Neon.palette
    val scope = rememberCoroutineScope()
    val network by c.offline.network.collectAsStateWithLifecycle()
    val settings by c.settingsRepo.settings.collectAsStateWithLifecycle()
    val online = OfflineManager.allowed(network, settings)
    val lib by c.library.data.collectAsStateWithLifecycle()
    val active by c.downloads.active.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current

    var tab by remember { mutableStateOf(FreeTab.ARCHIVE) }
    var query by remember { mutableStateOf("") }
    var genre by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var collections by remember { mutableStateOf<List<FreeCollection>>(emptyList()) }
    var tracks by remember { mutableStateOf<List<FreeTrack>>(emptyList()) }
    var openId by remember { mutableStateOf<String?>(null) }
    val children = remember { mutableStateMapOf<String, List<FreeTrack>>() }

    fun load() {
        if (!online) return
        scope.launch {
            loading = true
            when (tab) {
                FreeTab.ARCHIVE -> collections = c.freeMusic.archive.search(query, genre)
                FreeTab.JAMENDO -> tracks = c.freeMusic.jamendo.search(query, genre)
                FreeTab.PODCASTS -> collections = c.freeMusic.podcasts.search(query.ifBlank { genre ?: "music" })
                FreeTab.SAVED -> Unit
            }
            loading = false
        }
    }
    fun toggle(col: FreeCollection) {
        if (openId == col.id) { openId = null; return }
        openId = col.id
        if (col.id !in children) scope.launch {
            children[col.id] = if (col.feedUrl != null) c.freeMusic.podcasts.episodes(col) else c.freeMusic.archive.tracks(col)
        }
    }
    val downloaded = lib.tracks.filter { it.id.startsWith("free:") }.sortedByDescending { it.dateAddedEpochMs }
    val rowCallbacks = FreeRowCallbacks(
        state = { t -> when { lib.tracks.any { it.id == t.libraryId } -> RowState.Saved; active[t.libraryId]?.error != null -> RowState.Failed; t.libraryId in active -> RowState.Busy(active[t.libraryId]!!.fraction); else -> RowState.Idle } },
        preview = { t -> c.audio.playStream(t.audioUrl, t.title, t.artist, t.genre, t.artworkUrl) },
        download = c.downloads::download, cancel = c.downloads::cancel, open = { url -> runCatching { uri.openUri(url) } },
    )

    LaunchedEffect(tab, genre, online) { collections = emptyList(); tracks = emptyList(); openId = null; if (tab != FreeTab.SAVED && (tab != FreeTab.JAMENDO || c.freeMusic.jamendo.isConfigured)) load() }

    LazyColumn(Modifier.fillMaxSize().statusBarsPadding(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = p.onBackground) }
                Column {
                    Text("Free music & podcasts", color = p.onBackground, style = MaterialTheme.typography.titleLarge)
                    Text("Creative Commons, public domain and podcast feeds — legal to download. Credit the artist if you share.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        item { LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(FreeTab.entries) { t -> NeonChip(t.label, selected = t == tab) { tab = t; genre = null } } } }

        if (tab == FreeTab.SAVED) {
            item { SectionTitle("${downloaded.size} downloaded · plays offline") }
            if (downloaded.isEmpty()) item { Text("Nothing yet — download a track and it appears here and in your Library under Folders ▸ Free downloads.", color = p.muted) }
            items(downloaded, key = { it.id }) { t ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { c.audio.playQueue(downloaded, downloaded.indexOf(t)); onOpenPlayer() }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    AlbumArt(t.artworkUri, remember(t.id) { c.artGenerator.generate(t) }, Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t.title, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(t.artist, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                        t.license?.let { Text(it, color = p.secondary, style = MaterialTheme.typography.labelSmall, maxLines = 1) }
                    }
                    t.attributionUrl?.let { u -> NeonChip("Credit") { runCatching { uri.openUri(u) } } }
                    Spacer(Modifier.width(6.dp))
                    NeonChip("Delete", color = p.secondary) { c.library.deleteDownload(t.id) }
                }
            }
            return@LazyColumn
        }

        if (!online) { item { Text("You're offline — check Wi-Fi / mobile data in Settings. Downloaded tracks still play.", color = p.muted) }; return@LazyColumn }

        if (tab == FreeTab.JAMENDO && !c.freeMusic.jamendo.isConfigured) {
            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    Text("Jamendo needs a free client ID", color = p.onBackground, style = MaterialTheme.typography.titleMedium)
                    Text("Create one in a minute at devportal.jamendo.com (free, non-commercial), then paste it under Settings ▸ Free music.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                    NeonChip("Open Jamendo developer portal") { runCatching { uri.openUri("https://devportal.jamendo.com") } }
                }
            }
            return@LazyColumn
        }

        item {
            OutlinedTextField(
                value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                placeholder = { Text(if (tab == FreeTab.PODCASTS) "Search podcasts" else "Search free music") }, leadingIcon = { Icon(Icons.Filled.Search, null) },
                keyboardActions = KeyboardActions(onSearch = { load() }), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, cursorColor = p.accent), shape = RoundedCornerShape(16.dp),
            )
        }
        item {
            val chips = if (tab == FreeTab.PODCASTS) c.freeMusic.podcastStarters else c.freeMusic.genres
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(chips) { g -> NeonChip(g, selected = g == genre) { genre = if (g == genre) null else g; if (tab == FreeTab.PODCASTS) query = "" } }
            }
        }
        if (loading) item { LinearProgressIndicator(Modifier.fillMaxWidth(), color = p.accent) }

        when (tab) {
            FreeTab.JAMENDO -> {
                if (!loading && tracks.isEmpty()) item { Text("No tracks found.", color = p.muted) }
                items(tracks, key = { it.id }) { t -> FreeTrackRow(t, rowCallbacks) }
            }
            else -> {
                if (!loading && collections.isEmpty()) item { Text("Nothing found — try another word or genre.", color = p.muted) }
                collections.forEach { col -> collectionItems(this, col, openId == col.id, children[col.id], { toggle(col) }, rowCallbacks) }
            }
        }
    }
}

private sealed interface RowState {
    data object Idle : RowState
    data object Saved : RowState
    data object Failed : RowState
    data class Busy(val fraction: Float) : RowState
}

private class FreeRowCallbacks(
    val state: (FreeTrack) -> RowState,
    val preview: (FreeTrack) -> Unit,
    val download: (FreeTrack) -> Unit,
    val cancel: (FreeTrack) -> Unit,
    val open: (String) -> Unit,
)

private fun collectionItems(scope: LazyListScope, col: FreeCollection, open: Boolean, tracks: List<FreeTrack>?, onToggle: () -> Unit, cb: FreeRowCallbacks) = with(scope) {
    item(key = "c_" + col.id) {
        val p = Neon.palette
        GlowCard(Modifier.fillMaxWidth(), glowColor = p.accent.copy(alpha = if (open) 0.8f else 0.3f), onClick = onToggle) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AlbumArt(col.artworkUrl, null, Modifier.size(52.dp).clip(RoundedCornerShape(10.dp)))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(col.title, color = p.onBackground, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(col.artist, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                    Text(col.license, color = p.secondary, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                }
                Text(if (open) "▲" else "▼", color = p.accent)
            }
        }
    }
    if (open) {
        if (tracks == null) item(key = "l_" + col.id) { LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = 16.dp), color = Neon.palette.accent) }
        else if (tracks.isEmpty()) item(key = "e_" + col.id) { Text("No downloadable audio in here.", color = Neon.palette.muted, modifier = Modifier.padding(start = 16.dp)) }
        else items(tracks, key = { "t_" + col.id + it.id }) { t -> Box(Modifier.padding(start = 16.dp)) { FreeTrackRow(t, cb) } }
    }
}

@Composable
private fun FreeTrackRow(t: FreeTrack, cb: FreeRowCallbacks) {
    val p = Neon.palette
    val state = cb.state(t)
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        AlbumArt(t.artworkUrl, null, Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).clickable { cb.preview(t) })
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f).clickable { cb.preview(t) }) {
            Text(t.title, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(listOfNotNull(t.artist, t.durationMs.takeIf { it > 0 }?.let { "%d:%02d".format(it / 60000, it / 1000 % 60) }).joinToString(" · "), color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            Row {
                Text(t.license, color = p.secondary, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                t.pageUrl?.let { u -> Text("  source ↗", color = p.accent, style = MaterialTheme.typography.labelSmall, modifier = Modifier.clickable { cb.open(u) }) }
            }
            if (state is RowState.Busy) {
                if (state.fraction >= 0f) LinearProgressIndicator(progress = { state.fraction }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp), color = p.accent)
                else LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 4.dp), color = p.accent)
            }
        }
        Spacer(Modifier.width(6.dp))
        when (state) {
            RowState.Saved -> Text("✓ Saved", color = p.accent, style = MaterialTheme.typography.labelSmall)
            is RowState.Busy -> NeonChip("Cancel", color = p.secondary) { cb.cancel(t) }
            RowState.Failed -> NeonChip("Retry", color = p.secondary) { cb.cancel(t); cb.download(t) }
            RowState.Idle -> NeonChip("⬇ Get") { cb.download(t) }
        }
    }
}
