package com.nocternal.playz.ui.library

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
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

private fun onTrackMenuOpen(track: TrackEntity, action: TrackMenuAction, viewModel: LibraryViewModel) {
    viewModel.onTrackMenuOpen(track)
    when (action) {
        TrackMenuAction.EDIT -> viewModel.onEditOpen()
        TrackMenuAction.ADD_TO_PLAYLIST -> viewModel.onAddToPlaylistOpen()
        TrackMenuAction.DELETE -> viewModel.onDeleteOpen()
    }
}

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
                LazyRow(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    val orders = listOf(
                        SortOrder.RECENT to "Recent",
                        SortOrder.BPM_ASC to "BPM ↑",
                        SortOrder.BPM_DESC to "BPM ↓",
                        SortOrder.TITLE to "Title",
                        SortOrder.ARTIST to "Artist",
                    )
                    items(orders) { (order, label) ->
                        NeonChip(
                            text = label,
                            selected = uiState.sortOrder == order,
                            onClick = { viewModel.onSortOrderChange(order) },
                        )
                    }
                }
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
                            onTrackMenuOpen = { track, action -> onTrackMenuOpen(track, action, viewModel) },
                        )
                    }
                }
            }

            // ── Bottom sheets / dialogs ───────────────────────────────────
            val editTarget = uiState.trackMenuTarget
            if (uiState.showEditSheet && editTarget != null) {
                EditTrackSheet(
                    track = editTarget,
                    onDismiss = viewModel::onDismissSheet,
                    onSave = { title, artist, bpm, key ->
                        viewModel.updateTrack(title, artist, bpm, key)
                    },
                )
            }

            val addTarget = uiState.trackMenuTarget
            if (uiState.showAddToPlaylistSheet && addTarget != null) {
                AddToPlaylistSheet(
                    playlists = uiState.playlists,
                    onDismiss = viewModel::onDismissSheet,
                    onAddToExisting = viewModel::addToPlaylist,
                    onCreateNew = viewModel::createPlaylistAndAdd,
                )
            }

            val deleteTarget = uiState.trackMenuTarget
            if (uiState.showDeleteConfirm && deleteTarget != null) {
                DeleteTrackDialog(
                    trackTitle = deleteTarget.title,
                    onConfirm = viewModel::deleteTrack,
                    onDismiss = viewModel::onDismissSheet,
                )
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
    onTrackMenuOpen: (TrackEntity, TrackMenuAction) -> Unit,
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
                onMenuAction = { action -> onTrackMenuOpen(track, action) },
            )
        }
    }
}

private enum class TrackMenuAction { EDIT, ADD_TO_PLAYLIST, DELETE }

@Composable
private fun TrackCard(
    track: TrackEntity,
    onClick: () -> Unit,
    onToggleFavorite: () -> Unit,
    onMenuAction: (TrackMenuAction) -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }

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
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = "More options", tint = Color.White.copy(alpha = 0.7f))
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                    containerColor = DarkSurface,
                ) {
                    DropdownMenuItem(
                        text = { Text("Edit", color = Color.White) },
                        leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null, tint = NeonCyan) },
                        onClick = {
                            menuExpanded = false
                            onMenuAction(TrackMenuAction.EDIT)
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Add to playlist", color = Color.White) },
                        leadingIcon = { Icon(Icons.Filled.PlaylistAdd, contentDescription = null, tint = NeonPurple) },
                        onClick = {
                            menuExpanded = false
                            onMenuAction(TrackMenuAction.ADD_TO_PLAYLIST)
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Delete", color = NeonPink) },
                        leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null, tint = NeonPink) },
                        onClick = {
                            menuExpanded = false
                            onMenuAction(TrackMenuAction.DELETE)
                        },
                    )
                }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditTrackSheet(
    track: TrackEntity,
    onDismiss: () -> Unit,
    onSave: (title: String, artist: String, bpm: Float, camelotKey: String) -> Unit,
) {
    var title by remember { mutableStateOf(track.title) }
    var artist by remember { mutableStateOf(track.artist) }
    var bpm by remember { mutableStateOf(track.bpm.toInt().toString()) }
    var key by remember { mutableStateOf(track.camelotKey) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = DarkSurface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Edit Track", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = sheetFieldColors(),
            )
            OutlinedTextField(
                value = artist,
                onValueChange = { artist = it },
                label = { Text("Artist") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = sheetFieldColors(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = bpm,
                    onValueChange = { bpm = it.filter { c -> c.isDigit() } },
                    label = { Text("BPM") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    colors = sheetFieldColors(),
                )
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    label = { Text("Key") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    colors = sheetFieldColors(),
                )
            }
            Button(
                onClick = { onSave(title, artist, bpm.toFloatOrNull() ?: track.bpm, key) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = NeonPink),
            ) {
                Text("Save", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddToPlaylistSheet(
    playlists: List<PlaylistEntity>,
    onDismiss: () -> Unit,
    onAddToExisting: (PlaylistEntity) -> Unit,
    onCreateNew: (String) -> Unit,
) {
    var showNewField by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = DarkSurface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .padding(bottom = 24.dp),
        ) {
            Text(
                "Add to Playlist",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            LazyColumn(modifier = Modifier.weight(1f, fill = false)) {
                items(playlists, key = { it.id }) { playlist ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onAddToExisting(playlist) }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        PlaylistThumbnail(artworkUri = playlist.artworkUri, size = 40)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(playlist.name, color = Color.White, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("${playlist.trackCount} tracks", color = NeonCyan, fontSize = 12.sp)
                        }
                    }
                    HorizontalDivider(color = Color.White.copy(alpha = 0.08f))
                }
            }
            Spacer(Modifier.size(8.dp))
            if (showNewField) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        placeholder = { Text("Playlist name") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = sheetFieldColors(),
                    )
                    Button(
                        onClick = { if (newName.isNotBlank()) onCreateNew(newName) },
                        colors = ButtonDefaults.buttonColors(containerColor = NeonPurple),
                    ) { Text("Create") }
                }
            } else {
                TextButton(
                    onClick = { showNewField = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = null, tint = NeonPurple)
                    Spacer(Modifier.width(8.dp))
                    Text("New playlist", color = NeonPurple, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun DeleteTrackDialog(
    trackTitle: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = DarkSurface,
        title = { Text("Delete track?", color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            Text(
                "\"$trackTitle\" will be removed from your library.",
                color = Color.White.copy(alpha = 0.8f),
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = NeonPink),
            ) { Text("Delete", fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Color.White.copy(alpha = 0.7f)) }
        },
    )
}

@Composable
private fun sheetFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    focusedBorderColor = NeonPink,
    unfocusedBorderColor = NeonPurple.copy(alpha = 0.5f),
    focusedLabelColor = NeonPink,
    unfocusedLabelColor = Color.White.copy(alpha = 0.5f),
    cursorColor = NeonPink,
    focusedContainerColor = DarkSurface,
    unfocusedContainerColor = DarkSurface,
)

/** Formats milliseconds as `m:ss`, or `h:mm:ss` once past an hour. */
internal fun formatDuration(durationMs: Long): String {
    val totalSeconds = (durationMs.coerceAtLeast(0L)) / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds)
    else "%d:%02d".format(minutes, seconds)
}
