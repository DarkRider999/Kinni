package com.nocternal.playz.ui.analytics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.database.NocternalDatabase
import com.nocternal.playz.database.entity.HistoryEntity
import com.nocternal.playz.database.entity.TrackEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class TrackStat(
    val trackId: String,
    val title: String,
    val artist: String,
    val playCount: Int,
    val totalDurationMs: Long,
)

data class GenreStat(val genre: String, val trackCount: Int, val totalPlayMs: Long)

private const val HISTORY_WINDOW = 1000
private const val TOP_TRACKS = 10
private const val WEEK_MS = 7L * 24 * 60 * 60 * 1000

class AnalyticsViewModel(private val db: NocternalDatabase) : ViewModel() {
    private val trackDao = db.trackDao()
    private val historyDao = db.historyDao()

    /** Re-emits on every history write; drives the suspend-only DAO queries below. */
    private val history: Flow<List<HistoryEntity>> = historyDao.getRecentHistory(HISTORY_WINDOW)
    private val tracks: Flow<List<TrackEntity>> = trackDao.getAllTracks()

    val totalPlayCount: StateFlow<Int> = history
        .map { historyDao.getTotalPlayCount() }
        .catch { emit(0) }
        .eager(0)

    val topTracks: StateFlow<List<TrackStat>> = history
        .map { entries ->
            val counts = entries.groupingBy { it.trackId }.eachCount()
            val durations = entries.playedMsByTrack()
            historyDao.getMostPlayedTrackIds(TOP_TRACKS).mapNotNull { id ->
                val track = trackDao.getTrackById(id) ?: return@mapNotNull null
                TrackStat(
                    trackId = id,
                    title = track.title,
                    artist = track.artist,
                    playCount = counts[id] ?: 0,
                    totalDurationMs = durations[id] ?: 0L,
                )
            }
        }
        .catch { emit(emptyList()) }
        .eager(emptyList())

    val genreStats: StateFlow<List<GenreStat>> = combine(tracks, history) { all, entries ->
        val durations = entries.playedMsByTrack()
        all.groupBy { it.genre.ifBlank { "Unknown" } }
            .map { (genre, inGenre) ->
                GenreStat(
                    genre = genre,
                    trackCount = inGenre.size,
                    totalPlayMs = inGenre.sumOf { durations[it.id] ?: 0L },
                )
            }
            .sortedByDescending { it.trackCount }
    }
        .catch { emit(emptyList()) }
        .eager(emptyList())

    val weeklyListeningMs: StateFlow<Long> = history
        .map { entries ->
            val since = System.currentTimeMillis() - WEEK_MS
            entries.filter { it.playedAt >= since }.sumOf { it.durationPlayedMs }
        }
        .catch { emit(0L) }
        .eager(0L)

    /** Mean BPM over distinct played tracks that have a detected BPM (bpm > 0). */
    val averageBpm: StateFlow<Float> = combine(tracks, history) { all, entries ->
        val playedIds = entries.mapTo(HashSet()) { it.trackId }
        val bpms = all.filter { it.id in playedIds && it.bpm > 0f }.map { it.bpm }
        if (bpms.isEmpty()) 0f else bpms.average().toFloat()
    }
        .catch { emit(0f) }
        .eager(0f)

    val favouriteCount: StateFlow<Int> = trackDao.getFavorites()
        .map { it.size }
        .catch { emit(0) }
        .eager(0)

    // Every flow above is started in viewModelScope at construction (SharingStarted.Eagerly),
    // so the dashboard is populated before the screen first subscribes.
    private fun <T> Flow<T>.eager(initial: T): StateFlow<T> =
        stateIn(viewModelScope, SharingStarted.Eagerly, initial)

    private fun List<HistoryEntity>.playedMsByTrack(): Map<String, Long> =
        groupBy { it.trackId }.mapValues { (_, plays) -> plays.sumOf { it.durationPlayedMs } }

    class Factory(private val db: NocternalDatabase) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AnalyticsViewModel::class.java)) {
                "Unknown ViewModel class: ${modelClass.name}"
            }
            return AnalyticsViewModel(db) as T
        }
    }
}
