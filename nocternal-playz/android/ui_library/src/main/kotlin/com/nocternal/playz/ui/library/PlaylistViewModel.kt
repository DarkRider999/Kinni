package com.nocternal.playz.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.database.NocternalDatabase
import com.nocternal.playz.database.entity.PlaylistEntity
import com.nocternal.playz.database.entity.TrackEntity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PlaylistDetailUiState(
    val playlist: PlaylistEntity? = null,
    val tracks: List<TrackEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

class PlaylistViewModel(database: NocternalDatabase, private val playlistId: String) : ViewModel() {
    private val playlistDao = database.playlistDao()
    private val trackDao = database.trackDao()

    /**
     * PlaylistDao.getTrackIdsForPlaylist is a one-shot suspend query (not a Flow), so membership
     * changes made here bump this counter to re-read the ordered track ids.
     */
    private val membershipVersion = MutableStateFlow(0)

    @OptIn(ExperimentalCoroutinesApi::class)
    private val trackIds = membershipVersion.mapLatest { playlistDao.getTrackIdsForPlaylist(playlistId) }

    val uiState: StateFlow<PlaylistDetailUiState> = combine(
        playlistDao.getAllPlaylists().map { playlists -> playlists.find { it.id == playlistId } },
        trackIds,
        trackDao.getAllTracks(),
    ) { playlist, ids, allTracks ->
        val byId = allTracks.associateBy { it.id }
        PlaylistDetailUiState(
            playlist = playlist,
            tracks = ids.mapNotNull { byId[it] },
            isLoading = false,
            error = if (playlist == null) "Playlist not found" else null,
        )
    }.catch { e -> emit(PlaylistDetailUiState(isLoading = false, error = e.message ?: "Failed to load playlist")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PlaylistDetailUiState())

    fun removeTrack(trackId: String) {
        viewModelScope.launch {
            playlistDao.removeTrackFromPlaylist(playlistId, trackId)
            membershipVersion.update { it + 1 }
        }
    }
}
