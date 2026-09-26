package com.nocternal.playz.library

import android.content.Context
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.Track
import com.nocternal.playz.playlists.LibrarySnapshot
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/** Analysis results cached by track id, so a re-scan doesn't re-decode. */
@Serializable
data class TrackAnalysis(val bpm: Float?, val camelotKey: String?, val loudnessDb: Float, val energy: Float)

@Serializable
data class LibraryData(
    val tracks: List<Track> = emptyList(),
    val favorites: Set<String> = emptySet(),
    val history: List<PlayEvent> = emptyList(),
    val playlists: List<Playlist> = emptyList(),
    val analysis: Map<String, TrackAnalysis> = emptyMap(),
    val lyricsOffsetsMs: Map<String, Long> = emptyMap(),
)

enum class ScanPhase { IDLE, SCANNING, ANALYZING, DONE, NO_PERMISSION }
data class ScanStatus(val phase: ScanPhase = ScanPhase.IDLE, val analyzed: Int = 0, val total: Int = 0)

/**
 * Local library store: tracks, favourites, playback history, user playlists and analysis, persisted as JSON
 * in app storage (small enough for tens of thousands of tracks; swap for Room if it grows further).
 */
class LibraryRepository(
    private val context: Context,
    private val scope: CoroutineScope,
    private val scanner: MediaStoreScanner = MediaStoreScanner(context),
    private val analyzer: AudioAnalyzer = AudioAnalyzer(context),
) {
    private val file = File(context.filesDir, "library.json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    private val mutex = Mutex()
    private val _data = MutableStateFlow(LibraryData())
    val data: StateFlow<LibraryData> = _data.asStateFlow()
    private val _scan = MutableStateFlow(ScanStatus())
    val scan: StateFlow<ScanStatus> = _scan.asStateFlow()

    /** When on, nothing is written to history (spec: private mode). */
    @Volatile var privateMode = false

    fun snapshot(): LibrarySnapshot = _data.value.let { LibrarySnapshot(it.tracks, it.favorites, it.history) }
    fun track(id: String): Track? = _data.value.tracks.firstOrNull { it.id == id }

    suspend fun load() = withContext(Dispatchers.IO) {
        if (file.exists()) runCatching { _data.value = json.decodeFromString(LibraryData.serializer(), file.readText()) }
    }

    fun rescan(hasPermission: Boolean) = scope.launch {
        if (!hasPermission) { _scan.value = ScanStatus(ScanPhase.NO_PERMISSION); return@launch }
        _scan.value = ScanStatus(ScanPhase.SCANNING)
        val found = scanner.scan()
        val analysis = _data.value.analysis
        // Free downloads live in app storage (not MediaStore), so keep them across scans while their file exists.
        mutate { d -> d.copy(tracks = found.map { it.withAnalysis(analysis[it.id]) } + d.tracks.filter { it.isDownload() && it.fileExists() }) }
        val todo = found.filter { it.id !in analysis && !it.isPodcast }
        _scan.value = ScanStatus(ScanPhase.ANALYZING, 0, todo.size)
        todo.forEachIndexed { i, t ->
            analyzer.analyze(t.uri, t.durationMs)?.let { r ->
                val a = TrackAnalysis(r.bpm, r.key?.camelot, r.loudnessDb, r.energy)
                mutate(persist = i % 10 == 9) { d -> d.copy(analysis = d.analysis + (t.id to a), tracks = d.tracks.map { if (it.id == t.id) it.withAnalysis(a) else it }) }
            }
            _scan.update { it.copy(analyzed = i + 1) }
        }
        persist()
        _scan.value = ScanStatus(ScanPhase.DONE, todo.size, todo.size)
    }

    /** Adds (or replaces) a downloaded free track so it plays offline like any local song. */
    fun addDownload(t: Track) = scope.launch { mutate { d -> d.copy(tracks = d.tracks.filterNot { it.id == t.id } + t) } }

    /** Removes a downloaded track from the library and deletes its file. */
    fun deleteDownload(id: String) = scope.launch {
        val t = track(id)?.takeIf { it.isDownload() } ?: return@launch
        withContext(Dispatchers.IO) { runCatching { File(java.net.URI(t.uri)).delete() } }
        mutate { d -> d.copy(tracks = d.tracks.filterNot { it.id == id }, favorites = d.favorites - id) }
    }

    fun downloads(): List<Track> = _data.value.tracks.filter { it.isDownload() }

    fun toggleFavorite(id: String) = scope.launch { mutate { d -> d.copy(favorites = if (id in d.favorites) d.favorites - id else d.favorites + id) } }

    fun recordPlay(event: PlayEvent) {
        if (privateMode || event.trackId.startsWith("stream:")) return
        scope.launch { mutate { d -> d.copy(history = (d.history + event).takeLast(5000)) } }
    }

    fun clearHistory() = scope.launch { mutate { it.copy(history = emptyList()) } }

    fun savePlaylist(p: Playlist) = scope.launch { mutate { d -> d.copy(playlists = d.playlists.filterNot { it.id == p.id } + p) } }
    fun deletePlaylist(id: String) = scope.launch { mutate { d -> d.copy(playlists = d.playlists.filterNot { it.id == id }) } }

    /** Replaces user data after a backup restore (tracks stay as scanned). */
    fun replaceUserData(favorites: Set<String>, history: List<PlayEvent>, playlists: List<Playlist>, offsets: Map<String, Long>) =
        scope.launch { mutate { it.copy(favorites = favorites, history = history, playlists = playlists, lyricsOffsetsMs = offsets) } }

    private suspend fun mutate(persist: Boolean = true, block: (LibraryData) -> LibraryData) {
        mutex.withLock { _data.value = block(_data.value) }
        if (persist) persist()
    }

    private suspend fun persist() = withContext(Dispatchers.IO) {
        mutex.withLock {
            val tmp = File(file.parentFile, "library.json.tmp")
            tmp.writeText(json.encodeToString(LibraryData.serializer(), _data.value))
            tmp.renameTo(file)
        }
    }

    private fun Track.isDownload() = id.startsWith(DOWNLOAD_PREFIX)
    private fun Track.fileExists() = runCatching { File(java.net.URI(uri)).exists() }.getOrDefault(false)

    companion object { const val DOWNLOAD_PREFIX = "free:" }

    private fun Track.withAnalysis(a: TrackAnalysis?): Track =
        if (a == null) this else copy(bpm = bpm ?: a.bpm, camelotKey = camelotKey ?: a.camelotKey, loudnessDb = a.loudnessDb, energy = a.energy)
}
