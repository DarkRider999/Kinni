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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.nocternal.playz.database.entity.PlaylistEntity
import com.nocternal.playz.database.entity.TrackEntity
import com.nocternal.playz.designsystem.DarkBackground
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.NeonCyan
import com.nocternal.playz.designsystem.NeonPink
import com.nocternal.playz.designsystem.NeonPurple
import com.nocternal.playz.designsystem.NocternalAppTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistScreen(
    viewModel: PlaylistViewModel,
    onBack: () -> Unit,
    onTrackClick: (String) -> Unit,
    onAddTrack: () -> Unit,
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
                        Text(
                            uiState.playlist?.name ?: "PLAYLIST",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground),
                )
            },
            floatingActionButton = {
                FloatingActionButton(onClick = onAddTrack, containerColor = NeonPink, contentColor = Color.White) {
                    Icon(Icons.Filled.Add, contentDescription = "Add track to playlist")
                }
            },
        ) { padding ->
            Box(
                Modifier
                    .fillMaxSize()
                    .background(DarkBackground)
                    .padding(padding),
            ) {
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
                    else -> PlaylistContent(
                        playlist = uiState.playlist,
                        tracks = uiState.tracks,
                        onTrackClick = onTrackClick,
                        onRemoveTrack = viewModel::removeTrack,
                    )
                }
            }
        }
    }
}

@Composable
private fun PlaylistContent(
    playlist: PlaylistEntity?,
    tracks: List<TrackEntity>,
    onTrackClick: (String) -> Unit,
    onRemoveTrack: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Bottom padding keeps the last row clear of the FAB.
        contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "header") { PlaylistHeader(playlist = playlist, tracks = tracks) }
        if (tracks.isEmpty()) {
            item(key = "empty") {
                Text(
                    "No tracks in this playlist",
                    color = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    textAlign = TextAlign.Center,
                )
            }
        } else {
            items(tracks, key = { it.id }) { track ->
                SwipeToRemoveTrackRow(
                    track = track,
                    onClick = { onTrackClick(track.id) },
                    onRemove = { onRemoveTrack(track.id) },
                )
            }
        }
    }
}

@Composable
private fun PlaylistHeader(playlist: PlaylistEntity?, tracks: List<TrackEntity>) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        val artworkUri = playlist?.artworkUri
        if (artworkUri != null) {
            AsyncImage(
                model = artworkUri,
                contentDescription = playlist?.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(200.dp)
                    .clip(RoundedCornerShape(20.dp)),
            )
        } else {
            GlowCard(modifier = Modifier.size(200.dp), glowColor = NeonPurple) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brush.linearGradient(listOf(NeonPurple, NeonPink))),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.QueueMusic,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(72.dp),
                    )
                }
            }
        }
        Spacer(Modifier.size(16.dp))
        // Counted from the loaded rows: PlaylistEntity.trackCount/totalDurationMs are denormalised
        // fields that removeTrack does not update.
        val totalMs = tracks.sumOf { it.durationMs }
        Text(
            "${tracks.size} tracks • ${formatDuration(totalMs)}",
            color = NeonCyan,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
        if (!playlist?.description.isNullOrBlank()) {
            Spacer(Modifier.size(4.dp))
            Text(playlist?.description.orEmpty(), color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeToRemoveTrackRow(track: TrackEntity, onClick: () -> Unit, onRemove: () -> Unit) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onRemove()
                true
            } else {
                false
            }
        },
    )
    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(20.dp))
                    .background(NeonPink.copy(alpha = 0.35f))
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(Icons.Filled.Delete, contentDescription = "Remove from playlist", tint = Color.White)
            }
        },
    ) {
        GlowCard(modifier = Modifier.fillMaxWidth(), glowColor = NeonPurple, onClick = onClick) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    TrackTitleAndArtist(track)
                    Spacer(Modifier.size(8.dp))
                    TrackBadges(track)
                }
                Spacer(Modifier.width(8.dp))
                Text(formatDuration(track.durationMs), color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
            }
        }
    }
}
