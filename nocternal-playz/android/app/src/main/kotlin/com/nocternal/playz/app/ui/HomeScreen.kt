package com.nocternal.playz.app.ui

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.ActionExecutor
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.NeonLogo
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.designsystem.neonGlow
import com.nocternal.playz.designsystem.toColor
import com.nocternal.playz.library.ScanPhase
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Track
import com.nocternal.playz.playlists.FolderTree
import com.nocternal.playz.playlists.HistoryTimeline
import com.nocternal.playz.theme.GenreCatalog
import com.nocternal.playz.theme.ThemeEvent
import com.nocternal.playz.theme.ThemePresets
import com.nocternal.playz.ui.player.AlbumArt
import com.nocternal.playz.ui.radio.RadioHubScreen
import com.nocternal.playz.ui.youtube.YouTubeMusicPanel
import com.nocternal.playz.ui.youtube.YouTubePanelPlaceholder
import kotlinx.coroutines.launch

/**
 * Home (spec §3 + §10): neon logo, source tabs and the three sliding panels — Local player, YouTube Music,
 * Radio Hub — with Continue Listening, AI ideas and genre tiles on the Local panel.
 */
@Composable
fun HomeScreen(c: AppContainer, actions: ActionExecutor, onOpenPlayer: () -> Unit) {
    val p = Neon.palette
    val pager = rememberPagerState { AudioSource.entries.size }
    val scope = rememberCoroutineScope()
    val network by c.offline.network.collectAsStateWithLifecycle()
    val appSettings by c.settingsRepo.settings.collectAsStateWithLifecycle()
    val online = com.nocternal.playz.offline.OfflineManager.allowed(network, appSettings)
    val requested by c.requestedSource.collectAsStateWithLifecycle()
    val search by c.panelSearch.collectAsStateWithLifecycle()
    var youtubeOpened by remember { mutableStateOf(false) }
    var radioGenre by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(requested) {
        requested?.let { pager.animateScrollToPage(it.ordinal); c.requestedSource.value = null }
    }
    LaunchedEffect(pager) {
        snapshotFlow { pager.settledPage }.collect { page ->
            val src = AudioSource.entries[page]
            if (src == AudioSource.YOUTUBE) youtubeOpened = true
            c.themeSwitcher.onEvent(ThemeEvent.SourceChanged(src, c.audio.state.value.track?.takeIf { it.source == src }))
        }
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        NeonLogo(Modifier.fillMaxWidth().padding(top = 8.dp))
        SourceTabs(pager.currentPage + pager.currentPageOffsetFraction) { i -> scope.launch { pager.animateScrollToPage(i) } }
        HorizontalPager(pager, Modifier.fillMaxSize(), beyondViewportPageCount = 1) { page ->
            // Edge lighting between panels: a glow line that brightens while swiping.
            Box(Modifier.fillMaxSize()) {
                when (AudioSource.entries[page]) {
                    AudioSource.LOCAL -> LocalPanel(c, actions, onOpenPlayer, onGenreRadio = { g -> radioGenre = g; scope.launch { pager.animateScrollToPage(AudioSource.RADIO.ordinal) } })
                    AudioSource.YOUTUBE -> if (youtubeOpened) YouTubeMusicPanel(
                        online = online,
                        searchQuery = search?.takeIf { it.first == AudioSource.YOUTUBE }?.second,
                        active = pager.settledPage == AudioSource.YOUTUBE.ordinal,
                    ) else YouTubePanelPlaceholder({ youtubeOpened = true })
                    AudioSource.RADIO -> RadioHubScreen(
                        client = c.radio, online = online,
                        externalQuery = search?.takeIf { it.first == AudioSource.RADIO }?.second,
                        initialGenreId = radioGenre,
                        onPlay = { st, genreId ->
                            val tag = genreId?.let { GenreCatalog.byId(it)?.radioTags?.firstOrNull() } ?: st.tags.substringBefore(',')
                            c.audio.playStream(st.streamUrl, st.name.trim(), listOf(st.country, st.codec).filter { it.isNotBlank() }.joinToString(" · "), tag, st.favicon.ifBlank { null })
                        },
                    )
                }
                val edge = kotlin.math.abs(pager.currentPageOffsetFraction)
                if (edge > 0.01f) Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(p.accent.copy(alpha = 0.25f * edge), androidx.compose.ui.graphics.Color.Transparent, p.secondary.copy(alpha = 0.25f * edge)))))
            }
        }
    }
}

@Composable
private fun SourceTabs(position: Float, onSelect: (Int) -> Unit) {
    val p = Neon.palette
    val width = LocalConfiguration.current.screenWidthDp.dp - 32.dp
    val tabW = width / AudioSource.entries.size
    val x by animateDpAsState(tabW * position, label = "tab")
    Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().height(40.dp).clip(RoundedCornerShape(20.dp)).background(p.surface)) {
        Box(Modifier.offset(x = x).width(tabW).fillMaxSize().padding(3.dp).neonGlow(p.accent, p.glow, corner = 18.dp).clip(RoundedCornerShape(18.dp)).background(Brush.horizontalGradient(listOf(p.accent, p.secondary))))
        Row(Modifier.fillMaxSize()) {
            AudioSource.entries.forEachIndexed { i, s ->
                Box(Modifier.weight(1f).fillMaxSize().clickable { onSelect(i) }, contentAlignment = Alignment.Center) {
                    Text(s.label, style = MaterialTheme.typography.labelSmall, color = if (kotlin.math.round(position).toInt() == i) androidx.compose.ui.graphics.Color.Black else p.onBackground)
                }
            }
        }
    }
}

private enum class LibraryTab { SONGS, PLAYLISTS, FOLDERS, HISTORY }

@Composable
private fun LocalPanel(c: AppContainer, actions: ActionExecutor, onOpenPlayer: () -> Unit, onGenreRadio: (String) -> Unit) {
    val p = Neon.palette
    val lib by c.library.data.collectAsStateWithLifecycle()
    val scan by c.library.scan.collectAsStateWithLifecycle()
    val playback by c.audio.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(LibraryTab.SONGS) }
    var folderPath by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(setOf<String>()) }
    val snapshot = remember(lib) { c.library.snapshot() }
    val recent = remember(snapshot) { c.smartPlaylists.recentlyPlayed(snapshot, 15).trackIds.mapNotNull(c.library::track) }
    val genrePlaylists = remember(snapshot) { c.smartPlaylists.genrePlaylists(snapshot).associateBy { it.genreId } }
    val ideas = remember(playback.track?.id) { c.recommender.ideasFor(c.hour(), playback.track) }

    fun play(list: List<Track>, index: Int) { c.audio.playQueue(list, index); onOpenPlayer() }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (scan.phase == ScanPhase.SCANNING || scan.phase == ScanPhase.ANALYZING) item {
            Text(if (scan.phase == ScanPhase.SCANNING) "Scanning your music…" else "Analyzing BPM & key · ${scan.analyzed}/${scan.total}", color = p.accent, style = MaterialTheme.typography.labelSmall)
        }
        if (scan.phase == ScanPhase.NO_PERMISSION) item { Text("Allow music access in system settings to see your library.", color = p.muted) }

        if (recent.isNotEmpty()) {
            item { SectionTitle("Continue listening") }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(recent, key = { it.id }) { t -> TrackCard(c, t) { play(recent, recent.indexOf(t)) } }
                }
            }
        }

        item { SectionTitle("AI ideas") }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(ideas) { idea -> NeonChip("✨ $idea") { scope.launch { actions.run(c.assistant.value.handle("suggest a $idea playlist", actions.context()).actions) } } }
            }
        }

        item { SectionTitle("Genres") }
        items(GenreCatalog.all.chunked(3)) { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { g ->
                    GenreTile(g, genrePlaylists[g.id]?.trackIds?.size ?: 0, Modifier.weight(1f)) {
                        actions.openGenre(g.id)
                        val pl = genrePlaylists[g.id]
                        if (pl != null) { actions.playPlaylist(pl); onOpenPlayer() } else onGenreRadio(g.id)
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }

        item { SectionTitle("Library · ${lib.tracks.size} songs") }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(LibraryTab.entries) { t -> NeonChip(t.name.lowercase().replaceFirstChar { it.uppercase() }, selected = t == tab) { tab = t } }
            }
        }
        when (tab) {
            LibraryTab.SONGS -> items(lib.tracks.take(500), key = { it.id }) { t -> TrackRow(c, t, t.id in lib.favorites) { play(lib.tracks, lib.tracks.indexOf(t)) } }
            LibraryTab.PLAYLISTS -> {
                val lists = c.smartPlaylists.all(snapshot).filter { it.trackIds.isNotEmpty() } + lib.playlists
                lists.forEach { pl ->
                    val open = pl.id in expanded
                    item(key = "pl_" + pl.id) {
                        GlowCard(Modifier.fillMaxWidth(), glowColor = p.accent.copy(alpha = if (open) 0.8f else 0.3f), onClick = { expanded = if (open) expanded - pl.id else expanded + pl.id }) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(pl.name, color = p.onBackground, style = MaterialTheme.typography.titleMedium)
                                    Text("${pl.trackIds.size} songs · ${pl.description}", color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                NeonChip("▶ Play") { actions.playPlaylist(pl); onOpenPlayer() }
                                Text(if (open) "  ▲" else "  ▼", color = p.accent)
                            }
                        }
                    }
                    if (open) {
                        val tracks = pl.trackIds.mapNotNull(c.library::track)
                        items(tracks, key = { "pl_" + pl.id + "_" + it.id }) { t ->
                            Box(Modifier.padding(start = 16.dp)) {
                                TrackRow(c, t, t.id in lib.favorites) { actions.playPlaylist(pl, tracks.indexOf(t)); onOpenPlayer() }
                            }
                        }
                    }
                }
            }
            LibraryTab.FOLDERS -> {
                val root = FolderTree.build(lib.tracks)
                val node = root.find(folderPath) ?: root
                if (node.path.isNotEmpty()) item { NeonChip("⬅ ${node.path}") { folderPath = node.path.substringBeforeLast('/', "") } }
                item { NeonChip("▶ Play folder (${node.totalCount})") { play(node.allTrackIds().mapNotNull(c.library::track), 0) } }
                items(node.children, key = { it.path }) { f ->
                    GlowCard(Modifier.fillMaxWidth(), glowColor = p.secondary.copy(alpha = 0.3f), onClick = { folderPath = f.path }) {
                        Text("📁 ${f.name}", color = p.onBackground); Text("${f.totalCount} songs", color = p.muted, style = MaterialTheme.typography.labelSmall)
                    }
                }
                val here = node.trackIds.mapNotNull(c.library::track)
                items(here, key = { "f" + it.id }) { t -> TrackRow(c, t, t.id in lib.favorites) { play(here, here.indexOf(t)) } }
            }
            LibraryTab.HISTORY -> {
                val days = HistoryTimeline.build(lib.history)
                if (days.isEmpty()) item { Text(if (c.settingsRepo.settings.value.privateMode) "Private mode is on — history isn't recorded." else "Your playback timeline appears here.", color = p.muted) }
                days.take(14).forEach { day ->
                    item(key = "d" + day.date) { SectionTitle("${day.label} · ${day.listenedMs / 60000} min") }
                    items(day.events.take(50), key = { "h" + it.trackId + it.startedAtEpochMs }) { e ->
                        c.library.track(e.trackId)?.let { t -> TrackRow(c, t, t.id in lib.favorites) { play(listOf(t), 0) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun GenreTile(g: GenreDefinition, count: Int, modifier: Modifier, onClick: () -> Unit) {
    val preset = ThemePresets.byId(g.themePresetId)
    val a = preset.accent.toColor(); val b = preset.secondaryAccent.toColor()
    val p = Neon.palette
    Box(
        modifier.aspectRatio(1f).neonGlow(a, p.glow * 0.5f, corner = 18.dp).clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(a.copy(alpha = 0.35f), b.copy(alpha = 0.15f), p.surface)))
            .clickable(onClick = onClick).padding(10.dp),
    ) {
        Text(g.emoji, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.align(Alignment.TopStart))
        Column(Modifier.align(Alignment.BottomStart)) {
            Text(g.displayName, color = p.onBackground, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(if (count > 0) "$count songs" else "Radio", color = a, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun TrackCard(c: AppContainer, t: Track, onClick: () -> Unit) {
    val p = Neon.palette
    Column(Modifier.width(128.dp).clickable(onClick = onClick)) {
        AlbumArt(t.artworkUri, remember(t.id) { c.artGenerator.generate(t) }, Modifier.size(128.dp).neonGlow(p.accent, p.glow * 0.4f, corner = 16.dp).clip(RoundedCornerShape(16.dp)))
        Text(t.title, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
        Text(t.artist, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
    }
}

@Composable
fun TrackRow(c: AppContainer, t: Track, favorite: Boolean, onClick: () -> Unit) {
    val p = Neon.palette
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        AlbumArt(t.artworkUri, remember(t.id) { c.artGenerator.generate(t) }, Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(t.title, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(listOfNotNull(t.artist, t.bpm?.let { "${it.toInt()} BPM" }, t.camelotKey).joinToString(" · "), color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
        if (favorite) Text("♥", color = p.secondary)
    }
}
