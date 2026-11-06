package com.nocternal.playz.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.database.NocternalDatabase
import com.nocternal.playz.database.entity.PlaylistEntity
import com.nocternal.playz.database.entity.PlaylistTrackEntity
import com.nocternal.playz.database.entity.TrackEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

enum class SortOrder { TITLE, ARTIST, BPM_ASC, BPM_DESC, RECENT }

data class LibraryUiState(
    val tracks: List<TrackEntity> = emptyList(),
    val playlists: List<PlaylistEntity> = emptyList(),
    val isLoading: Boolean = true,
    val searchQuery: String = "",
    val selectedTab: LibraryTab = LibraryTab.TRACKS,
    val sortOrder: SortOrder = SortOrder.RECENT,
    val error: String? = null,
    // track context-menu sheet state
    val trackMenuTarget: TrackEntity? = null,
    val showEditSheet: Boolean = false,
    val showAddToPlaylistSheet: Boolean = false,
    val showDeleteConfirm: Boolean = false,
)

enum class LibraryTab { TRACKS, PLAYLISTS, FAVORITES, HISTORY }

class LibraryViewModel(database: NocternalDatabase) : ViewModel() {
    private val trackDao = database.trackDao()
    private val playlistDao = database.playlistDao()
    private val historyDao = database.historyDao()

    private val _sortOrder = MutableStateFlow(SortOrder.RECENT)
    private val _searchQuery = MutableStateFlow("")
    private val _selectedTab = MutableStateFlow(LibraryTab.TRACKS)

    /** All tracks paired with the recently played ones (most recent first, de-duplicated). */
    private val tracksWithHistory = combine(
        trackDao.getAllTracks(),
        historyDao.getRecentHistory(),
    ) { tracks, history ->
        val byId = tracks.associateBy { it.id }
        tracks to history.map { it.trackId }.distinct().mapNotNull { byId[it] }
    }

    // ── Internal sheet state (merged into uiState via combine) ────────────────

    private data class SheetState(
        val trackMenuTarget: TrackEntity? = null,
        val showEditSheet: Boolean = false,
        val showAddToPlaylistSheet: Boolean = false,
        val showDeleteConfirm: Boolean = false,
    )

    private val _sheetState = MutableStateFlow(SheetState())

    val uiState: StateFlow<LibraryUiState> = combine(
        combine(_selectedTab, _searchQuery, tracksWithHistory, playlistDao.getAllPlaylists(), trackDao.getFavorites()) {
                tab, query, (tracks, recent), playlists, favorites ->
            Triple(tab, query, Triple(tracks, recent, Pair(playlists, favorites)))
        },
        _sheetState,
        _sortOrder,
    ) { (tab, query, inner), sheet, sortOrder ->
        val (tracks, recent, pf) = inner
        val (playlists, favorites) = pf
        val source = when (tab) {
            LibraryTab.FAVORITES -> favorites
            LibraryTab.HISTORY -> recent
            LibraryTab.TRACKS, LibraryTab.PLAYLISTS -> tracks
        }
        LibraryUiState(
            tracks = source.filterBy(query).sortedBy(sortOrder),
            playlists = if (query.isBlank()) playlists
                else playlists.filter { it.name.contains(query, ignoreCase = true) },
            isLoading = false,
            searchQuery = query,
            selectedTab = tab,
            sortOrder = sortOrder,
            error = null,
            trackMenuTarget = sheet.trackMenuTarget,
            showEditSheet = sheet.showEditSheet,
            showAddToPlaylistSheet = sheet.showAddToPlaylistSheet,
            showDeleteConfirm = sheet.showDeleteConfirm,
        )
    }.catch { e -> emit(LibraryUiState(isLoading = false, error = e.message ?: "Failed to load library")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), LibraryUiState())

    fun onSearch(query: String) { _searchQuery.value = query }

    fun onTabSelected(tab: LibraryTab) { _selectedTab.value = tab }

    fun toggleFavorite(trackId: String) {
        viewModelScope.launch {
            val track = uiState.value.tracks.find { it.id == trackId } ?: return@launch
            runCatching { trackDao.setFavorite(trackId, !track.isFavorite) }
        }
    }

    // ── Context menu ──────────────────────────────────────────────────────────

    fun onTrackMenuOpen(track: TrackEntity) {
        _sheetState.value = _sheetState.value.copy(
            trackMenuTarget = track,
            showEditSheet = false,
            showAddToPlaylistSheet = false,
            showDeleteConfirm = false,
        )
    }

    fun onDismissMenu() {
        _sheetState.value = SheetState()
    }

    fun onEditOpen() {
        _sheetState.value = _sheetState.value.copy(showEditSheet = true)
    }

    fun onAddToPlaylistOpen() {
        _sheetState.value = _sheetState.value.copy(showAddToPlaylistSheet = true)
    }

    fun onDeleteOpen() {
        _sheetState.value = _sheetState.value.copy(showDeleteConfirm = true)
    }

    fun onDismissSheet() {
        _sheetState.value = SheetState()
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    fun updateTrack(title: String, artist: String, bpm: Float, camelotKey: String) {
        val track = _sheetState.value.trackMenuTarget ?: return
        viewModelScope.launch {
            runCatching {
                trackDao.updateTrack(
                    track.copy(
                        title = title.trim().ifBlank { track.title },
                        artist = artist.trim().ifBlank { track.artist },
                        bpm = if (bpm > 0f) bpm else track.bpm,
                        camelotKey = camelotKey.trim(),
                    ),
                )
            }
            _sheetState.value = SheetState()
        }
    }

    fun deleteTrack() {
        val track = _sheetState.value.trackMenuTarget ?: return
        viewModelScope.launch {
            runCatching { trackDao.deleteTrack(track) }
            _sheetState.value = SheetState()
        }
    }

    fun addToPlaylist(playlist: PlaylistEntity) {
        val track = _sheetState.value.trackMenuTarget ?: return
        viewModelScope.launch {
            runCatching {
                val existingIds = playlistDao.getTrackIdsForPlaylist(playlist.id)
                if (track.id !in existingIds) {
                    playlistDao.addTrackToPlaylist(
                        PlaylistTrackEntity(
                            playlistId = playlist.id,
                            trackId = track.id,
                            position = existingIds.size,
                        ),
                    )
                    playlistDao.updatePlaylist(
                        playlist.copy(
                            trackCount = existingIds.size + 1,
                            totalDurationMs = playlist.totalDurationMs + track.durationMs,
                            updatedAt = System.currentTimeMillis(),
                        ),
                    )
                }
            }
            _sheetState.value = SheetState()
        }
    }

    fun createPlaylistAndAdd(name: String) {
        val track = _sheetState.value.trackMenuTarget ?: return
        if (name.isBlank()) return
        viewModelScope.launch {
            runCatching {
                val newPlaylist = PlaylistEntity(
                    id = UUID.randomUUID().toString(),
                    name = name.trim(),
                    trackCount = 1,
                    totalDurationMs = track.durationMs,
                    artworkUri = track.artworkUri,
                    kind = "USER",
                    updatedAt = System.currentTimeMillis(),
                )
                playlistDao.insertPlaylist(newPlaylist)
                playlistDao.addTrackToPlaylist(
                    PlaylistTrackEntity(
                        playlistId = newPlaylist.id,
                        trackId = track.id,
                        position = 0,
                    ),
                )
            }
            _sheetState.value = SheetState()
        }
    }

    fun onSortOrderChange(order: SortOrder) { _sortOrder.value = order }

    private fun List<TrackEntity>.filterBy(query: String): List<TrackEntity> =
        if (query.isBlank()) this
        else filter { it.title.contains(query, ignoreCase = true) || it.artist.contains(query, ignoreCase = true) }

    private fun List<TrackEntity>.sortedBy(order: SortOrder): List<TrackEntity> = when (order) {
        SortOrder.TITLE -> sortedBy { it.title.lowercase() }
        SortOrder.ARTIST -> sortedBy { it.artist.lowercase() }
        SortOrder.BPM_ASC -> sortedBy { it.bpm }
        SortOrder.BPM_DESC -> sortedByDescending { it.bpm }
        SortOrder.RECENT -> this
    }
}
