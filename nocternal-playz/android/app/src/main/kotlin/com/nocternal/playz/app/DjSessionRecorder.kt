package com.nocternal.playz.app

import com.nocternal.playz.audio.AudioEngine
import com.nocternal.playz.audio.PlaybackEvent
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.PlaylistKind
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** One track played while the DJ Deck session recorder was running. */
data class DjSessionEntry(val trackId: String, val title: String, val artist: String, val startedAtEpochMs: Long)

/**
 * DJ Session Recorder (spec §6-14, "local-only"): logs the order tracks actually played in while recording
 * is on, so a set can be saved and replayed later. It does not capture audio — just the track order and
 * timing, turned into a normal [Playlist] on [stop].
 */
class DjSessionRecorder(private val audio: AudioEngine, private val scope: CoroutineScope) {
    private val _recording = MutableStateFlow(false)
    val recording: StateFlow<Boolean> = _recording.asStateFlow()

    private val _entries = MutableStateFlow<List<DjSessionEntry>>(emptyList())
    val entries: StateFlow<List<DjSessionEntry>> = _entries.asStateFlow()

    private var job: Job? = null

    fun start() {
        if (_recording.value) return
        _entries.value = emptyList()
        _recording.value = true
        job = scope.launch {
            audio.events.collect { e ->
                if (e is PlaybackEvent.TrackStarted) {
                    _entries.update { it + DjSessionEntry(e.track.id, e.track.title, e.track.artist, System.currentTimeMillis()) }
                }
            }
        }
    }

    /** Stops recording and returns a playlist of the set, or null if nothing was captured. */
    fun stop(): Playlist? {
        job?.cancel(); job = null
        _recording.value = false
        val ids = _entries.value.map { it.trackId }.distinct()
        if (ids.isEmpty()) return null
        val label = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date())
        return Playlist(
            id = "dj_session_" + System.currentTimeMillis(), name = "DJ Set · $label", trackIds = ids,
            kind = PlaylistKind.USER, description = "${ids.size} tracks, recorded on the DJ Deck",
        )
    }
}
