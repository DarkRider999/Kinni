package com.nocternal.playz.ui.library

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.nocternal.playz.database.entity.PlaylistEntity
import com.nocternal.playz.database.entity.TrackEntity
import com.nocternal.playz.designsystem.DarkBackground
import com.nocternal.playz.designsystem.DarkSurface
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.NeonCyan
import com.nocternal.playz.designsystem.NeonGold
import com.nocternal.playz.designsystem.NeonLogo
import com.nocternal.playz.designsystem.NeonPink
import com.nocternal.playz.designsystem.NeonPurple
import com.nocternal.playz.designsystem.NocternalAppTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    viewModel: LibraryViewModel,
    onTrackClick: (String) -> Unit,
    onPlaylistClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    NocternalAppTheme {
        Scaffold(
            modifier = modifier,
            containerColor = DarkBackground,
            topBar = {
                TopAppBar(
                    title = {
                        Text("LIBRARY", color = Color.White, fontWeight = FontWeight.Black, letterSpacing = 4.sp)
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground),
                )
            },
        ) { padding ->
            Column(
                Modifier
                    .fillMaxSize()
                    .background(DarkBackground)
                    .padding(padding),
            ) {
                LibrarySearchBar(query = uiState.searchQuery, onQueryChange = viewModel::onSearch)
                LibraryTabs(selected = uiState.selectedTab, onSelect = viewModel::onTabSelected)
                Box(Modifier.fillMaxSize()) {
                    when {
                        uiState.isLoading -> CircularProgressIndicator(
                            color = NeonPink,
                            modifier = Modifier.align(Alignment.Center),
                        )
                        uiState.error != null -> Text(
                            text = uiState.error.orEmpty(),
                            color = Color.Red,
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(24.dp),
                        )
                        uiState.selectedTab == LibraryTab.PLAYLISTS -> PlaylistList(
                            playlists = uiState.playlists,
                            onPlaylistClick = onPlaylistClick,
                        )
                        else -> TrackList(
                            tracks = uiState.tracks,
                            onTrackClick = onTrackClick,
                            onToggleFavorite = viewModel::toggleFavorite,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LibrarySearchBar(query: String, onQueryChange: (String) -> Unit) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        singleLine = true,
        placeholder = { Text("Search title or artist", color = Color.White.copy(alpha = 0.4f)) },
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = NeonCyan) },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Filled.Clear, contentDescription = "Clear search", tint = Color.White.copy(alpha = 0.6f))
                }
            }
        },
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedBorderColor = NeonPink,
            unfocusedBorderColor = NeonPurple.copy(alpha = 0.5f),
            cursorColor = NeonPink,
            focusedContainerColor = DarkSurface,
            unfocusedContainerColor = DarkSurface,
        ),
    )
}

@Composable
private fun LibraryTabs(selected: LibraryTab, onSelect: (LibraryTab) -> Unit) {
    val tabs = LibraryTab.entries
    TabRow(
        selectedTabIndex = tabs.indexOf(selected),
        containerColor = DarkBackground,
        contentColor = NeonPink,
        indicator = { positions ->
            TabRowDefaults.SecondaryIndicator(
                modifier = Modifier.tabIndicatorOffset(positions[tabs.indexOf(selected)]),
                color = NeonPink,
            )
        },
    ) {
        tabs.forEach { tab ->
            Tab(
                selected = tab == selected,
                onClick = { onSelect(tab) },
                selectedContentColor = NeonPink,
                unselectedContentColor = Color.White.copy(alpha = 0.6f),
                text = { Text(tab.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1) },
            )
        }
    }
}

@Composable
private fun TrackList(
    tracks: List<TrackEntity>,
    onTrackClick: (String) -> Unit,
    onToggleFavorite: (String) -> Unit,
) {
    if (tracks.isEmpty()) {
        EmptyState("No tracks found")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(tracks, key = { it.id }) { track ->
            TrackCard(
                track = track,
                onClick = { onTrackClick(track.id) },
                onToggleFavorite = { onToggleFavorite(track.id) },
            )
        }
    }
}

@Composable
private fun TrackCard(track: TrackEntity, onClick: () -> Unit, onToggleFavorite: () -> Unit) {
    GlowCard(modifier = Modifier.fillMaxWidth(), glowColor = NeonPurple, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                TrackTitleAndArtist(track)
                Spacer(Modifier.size(8.dp))
                TrackBadges(track)
            }
            IconButton(onClick = onToggleFavorite) {
                Icon(
                    imageVector = if (track.isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = if (track.isFavorite) "Remove from favorites" else "Add to favorites",
                    tint = if (track.isFavorite) NeonPink else Color.White.copy(alpha = 0.5f),
                )
            }
        }
    }
}

@Composable
private fun PlaylistList(playlists: List<PlaylistEntity>, onPlaylistClick: (String) -> Unit) {
    if (playlists.isEmpty()) {
        EmptyState("No playlists found")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(playlists, key = { it.id }) { playlist ->
            PlaylistCard(playlist = playlist, onClick = { onPlaylistClick(playlist.id) })
        }
    }
}

@Composable
private fun PlaylistCard(playlist: PlaylistEntity, onClick: () -> Unit) {
    GlowCard(modifier = Modifier.fillMaxWidth(), glowColor = NeonCyan, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PlaylistThumbnail(artworkUri = playlist.artworkUri, size = 56)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    playlist.name,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${playlist.trackCount} tracks • ${formatDuration(playlist.totalDurationMs)}",
                    color = NeonCyan,
                    fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
private fun PlaylistThumbnail(artworkUri: String?, size: Int) {
    val shape = RoundedCornerShape(12.dp)
    if (artworkUri != null) {
        AsyncImage(
            model = artworkUri,
            contentDescription = null,
            modifier = Modifier
                .size(size.dp)
                .clip(shape),
        )
    } else {
        Box(
            Modifier
                .size(size.dp)
                .clip(shape)
                .background(Brush.linearGradient(listOf(NeonPurple, NeonPink))),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.AutoMirrored.Filled.QueueMusic, contentDescription = null, tint = Color.White)
        }
    }
}

@Composable
private fun EmptyState(message: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        NeonLogo(showByline = false)
        Spacer(Modifier.size(16.dp))
        Text(message, color = Color.White.copy(alpha = 0.7f))
    }
}

@Composable
internal fun TrackTitleAndArtist(track: TrackEntity) {
    Text(
        track.title,
        color = Color.White,
        fontWeight = FontWeight.Bold,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
    Text(
        track.artist,
        color = NeonCyan,
        fontSize = 13.sp,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
internal fun TrackBadges(track: TrackEntity) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        NeonChip(text = "${track.bpm.toInt()} BPM", selected = true, color = NeonPurple, onClick = {})
        if (track.camelotKey.isNotBlank()) {
            NeonChip(text = track.camelotKey, color = NeonGold, onClick = {})
        }
    }
}

/** Formats milliseconds as `m:ss`, or `h:mm:ss` once past an hour. */
internal fun formatDuration(durationMs: Long): String {
    val totalSeconds = (durationMs.coerceAtLeast(0L)) / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds)
    else "%d:%02d".format(minutes, seconds)
}
