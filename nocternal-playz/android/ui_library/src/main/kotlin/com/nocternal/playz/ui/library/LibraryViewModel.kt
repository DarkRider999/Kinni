package com.nocternal.playz.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.database.NocternalDatabase
import com.nocternal.playz.database.entity.PlaylistEntity
import com.nocternal.playz.database.entity.TrackEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class LibraryUiState(
    val tracks: List<TrackEntity> = emptyList(),
    val playlists: List<PlaylistEntity> = emptyList(),
    val isLoading: Boolean = true,
    val searchQuery: String = "",
    val selectedTab: LibraryTab = LibraryTab.TRACKS,
    val error: String? = null,
)

enum class LibraryTab { TRACKS, PLAYLISTS, FAVORITES, HISTORY }

class LibraryViewModel(database: NocternalDatabase) : ViewModel() {
    private val trackDao = database.trackDao()
    private val playlistDao = database.playlistDao()
    private val historyDao = database.historyDao()

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

    val uiState: StateFlow<LibraryUiState> = combine(
        _selectedTab,
        _searchQuery,
        tracksWithHistory,
        playlistDao.getAllPlaylists(),
        trackDao.getFavorites(),
    ) { tab, query, (tracks, recent), playlists, favorites ->
        val source = when (tab) {
            LibraryTab.FAVORITES -> favorites
            LibraryTab.HISTORY -> recent
            LibraryTab.TRACKS, LibraryTab.PLAYLISTS -> tracks
        }
        LibraryUiState(
            tracks = source.filterBy(query),
            playlists = if (query.isBlank()) playlists
                else playlists.filter { it.name.contains(query, ignoreCase = true) },
            isLoading = false,
            searchQuery = query,
            selectedTab = tab,
            error = null,
        )
    }.catch { e -> emit(LibraryUiState(isLoading = false, error = e.message ?: "Failed to load library")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), LibraryUiState())

    fun onSearch(query: String) { _searchQuery.value = query }

    fun onTabSelected(tab: LibraryTab) { _selectedTab.value = tab }

    fun toggleFavorite(trackId: String) {
        viewModelScope.launch {
            val track = uiState.value.tracks.find { it.id == trackId } ?: return@launch
            trackDao.setFavorite(trackId, !track.isFavorite)
        }
    }

    private fun List<TrackEntity>.filterBy(query: String): List<TrackEntity> =
        if (query.isBlank()) this
        else filter { it.title.contains(query, ignoreCase = true) || it.artist.contains(query, ignoreCase = true) }
}
