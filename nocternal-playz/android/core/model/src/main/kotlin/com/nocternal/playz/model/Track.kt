package com.nocternal.playz.model

import kotlinx.serialization.Serializable

/** A playable item from any source. Local tracks carry a content/file URI; radio carries a stream URL. */
@Serializable
data class Track(
    val id: String,
    val uri: String,
    val title: String,
    val artist: String = "Unknown artist",
    val album: String = "",
    /** Raw genre tag from the file or station (may be null or messy, e.g. "Bhajan / Devotional"). */
    val genreTag: String? = null,
    val durationMs: Long = 0,
    /** Beats per minute from tags or on-device analysis. */
    val bpm: Float? = null,
    /** Musical key in Camelot notation, e.g. "8A" (A minor) or "8B" (C major). */
    val camelotKey: String? = null,
    /** Folder path relative to the storage root, e.g. "Music/Bhajans". */
    val folder: String = "",
    val year: Int? = null,
    /** ReplayGain track gain in dB, if tagged. */
    val replayGainDb: Float? = null,
    /** Average loudness measured by the analyzer (LUFS-like), if known. */
    val loudnessDb: Float? = null,
    /** 0..1 perceived energy from analysis, if known. */
    val energy: Float? = null,
    val artworkUri: String? = null,
    val dateAddedEpochMs: Long = 0,
    val source: AudioSource = AudioSource.LOCAL,
    val isPodcast: Boolean = false,
    /** Licence of a free download, e.g. "CC BY-SA 4.0"; shown as attribution. */
    val license: String? = null,
    /** Where the work was published (credit / attribution link). */
    val attributionUrl: String? = null,
)

@Serializable
data class Playlist(
    val id: String,
    val name: String,
    val trackIds: List<String>,
    val kind: PlaylistKind = PlaylistKind.USER,
    val genreId: String? = null,
    val description: String = "",
)

@Serializable
enum class PlaylistKind { USER, SMART, GENRE, AI }

/** One play event. Stored only when private mode is off. */
@Serializable
data class PlayEvent(
    val trackId: String,
    val startedAtEpochMs: Long,
    val listenedMs: Long,
    val source: AudioSource = AudioSource.LOCAL,
    val completed: Boolean = listenedMs > 0,
)
