package com.nocternal.playz.ui.dj

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.database.NocternalDatabase
import com.nocternal.playz.database.entity.CuePointEntity
import com.nocternal.playz.database.entity.TrackEntity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DjHubViewModel(private val db: NocternalDatabase) : ViewModel() {
    private val trackDao = db.trackDao()
    private val cuePointDao = db.cuePointDao()

    private val tracks: StateFlow<List<TrackEntity>> = trackDao.getAllTracks()
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Deck A: the first track in the library, or null when the library is empty. */
    val currentTrack: StateFlow<TrackEntity?> = tracks.map { it.firstOrNull() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** Deck B: the second track in the library. */
    val nextTrack: StateFlow<TrackEntity?> = tracks.map { it.getOrNull(1) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    @OptIn(ExperimentalCoroutinesApi::class)
    val cuePoints: StateFlow<List<CuePointEntity>> = currentTrack
        .flatMapLatest { track ->
            if (track == null) flowOf(emptyList()) else cuePointDao.getCuePointsForTrack(track.id)
        }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Base BPM of the mix: 128 until the deck A track loads, then that track's BPM. */
    val masterBpm = MutableStateFlow(DEFAULT_BPM)
    val tempoMultiplier = MutableStateFlow(1.0f)

    val crossfaderPosition = MutableStateFlow(0.5f)
    val deckAVolume = MutableStateFlow(1.0f)
    val deckBVolume = MutableStateFlow(1.0f)
    val eqLow = MutableStateFlow(0f)
    val eqMid = MutableStateFlow(0f)
    val eqHigh = MutableStateFlow(0f)

    init {
        viewModelScope.launch { masterBpm.value = currentTrack.filterNotNull().first().bpm }
    }

    fun setCuePoint(trackId: String, positionMs: Long, label: String, isHotCue: Boolean, hotCueIndex: Int?) {
        viewModelScope.launch {
            runCatching {
                cuePointDao.insertCuePoint(
                    CuePointEntity(
                        trackId = trackId,
                        positionMs = positionMs,
                        label = label,
                        isHotCue = isHotCue,
                        hotCueIndex = hotCueIndex,
                    ),
                )
            }
        }
    }

    /** Room's @Delete matches on the primary key only, so the other fields are placeholders. */
    fun deleteCuePoint(id: Long) {
        viewModelScope.launch {
            runCatching {
                cuePointDao.deleteCuePoint(CuePointEntity(id = id, trackId = "", positionMs = 0L))
            }
        }
    }

    /** 0.0 = full deck A, 1.0 = full deck B. */
    fun updateCrossfader(position: Float) {
        crossfaderPosition.value = position.coerceIn(0f, 1f)
    }

    fun updateTempo(multiplier: Float) {
        tempoMultiplier.value = multiplier.coerceIn(MIN_TEMPO, MAX_TEMPO)
    }

    class Factory(private val db: NocternalDatabase) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(DjHubViewModel::class.java)) {
                "Unknown ViewModel class: ${modelClass.name}"
            }
            return DjHubViewModel(db) as T
        }
    }

    companion object {
        const val DEFAULT_BPM = 128f
        const val MIN_TEMPO = 0.5f
        const val MAX_TEMPO = 2.0f
    }
}
