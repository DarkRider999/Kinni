package com.nocternal.playz.backup

import com.nocternal.playz.model.AppSettings
import com.nocternal.playz.model.EqPreset
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.PlaylistKind
import com.nocternal.playz.model.Track
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Everything the user would miss after reinstalling: settings, playlists, favourites, play history,
 * custom EQ presets and lyric offsets. Track references use portable [TrackKeys] because media IDs differ
 * between devices.
 */
@Serializable
data class BackupSnapshot(
    val format: String = FORMAT,
    val schemaVersion: Int = SCHEMA_VERSION,
    val createdAtEpochMs: Long,
    val appVersion: String,
    val settings: AppSettings,
    val playlists: List<PortablePlaylist>,
    val favorites: List<String>,
    val history: List<PortablePlayEvent>,
    val customEqPresets: List<EqPreset> = emptyList(),
    val lyricsOffsetsMs: Map<String, Long> = emptyMap(),
) {
    companion object {
        const val FORMAT = "nocternal-playz-backup"
        const val SCHEMA_VERSION = 2
    }
}

@Serializable
data class PortablePlaylist(val name: String, val trackKeys: List<String>, val description: String = "")

@Serializable
data class PortablePlayEvent(val trackKey: String, val startedAtEpochMs: Long, val listenedMs: Long, val completed: Boolean)

/** What the app currently holds, in device IDs. */
data class LibraryState(
    val settings: AppSettings,
    val playlists: List<Playlist>,
    val favorites: Set<String>,
    val history: List<PlayEvent>,
    val customEqPresets: List<EqPreset> = emptyList(),
    val lyricsOffsetsMs: Map<String, Long> = emptyMap(),
)

enum class RestoreStrategy { REPLACE, MERGE }

data class RestoreResult(val state: LibraryState, val unmatchedTrackKeys: Set<String>, val restoredPlaylists: Int)

class BackupException(message: String) : Exception(message)

/** Portable identity for a track: normalised artist + title + duration rounded to 2 s. */
object TrackKeys {
    fun of(t: Track): String = "${norm(t.artist)}|${norm(t.title)}|${(t.durationMs + 1000) / 2000}"
    private fun norm(s: String) = s.lowercase().replace(Regex("""\(.*?\)|\[.*?]"""), "").replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()
}

class BackupManager(private val appVersion: String, private val clock: () -> Long = System::currentTimeMillis) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = true }

    /**
     * Serialises [state]. Smart/genre playlists are regenerated on restore, so only user and AI playlists are saved.
     * History is left out in private mode, and the assistant API key is never exported.
     */
    fun export(state: LibraryState, tracks: List<Track>): String {
        val keyOf = tracks.associate { it.id to TrackKeys.of(it) }
        val snapshot = BackupSnapshot(
            createdAtEpochMs = clock(),
            appVersion = appVersion,
            settings = state.settings.copy(assistantApiKey = null),
            playlists = state.playlists.filter { it.kind == PlaylistKind.USER || it.kind == PlaylistKind.AI }
                .map { p -> PortablePlaylist(p.name, p.trackIds.mapNotNull { keyOf[it] }, p.description) },
            favorites = state.favorites.mapNotNull { keyOf[it] }.sorted(),
            history = if (state.settings.privateMode) emptyList()
            else state.history.mapNotNull { e -> keyOf[e.trackId]?.let { PortablePlayEvent(it, e.startedAtEpochMs, e.listenedMs, e.completed) } },
            customEqPresets = state.customEqPresets,
            lyricsOffsetsMs = state.lyricsOffsetsMs.mapNotNull { (id, off) -> keyOf[id]?.let { it to off } }.toMap(),
        )
        return json.encodeToString(BackupSnapshot.serializer(), snapshot)
    }

    fun parse(text: String): BackupSnapshot {
        val root = runCatching { json.parseToJsonElement(text).jsonObject }.getOrElse { throw BackupException("Not a backup file") }
        if (root["format"]?.jsonPrimitive?.content != BackupSnapshot.FORMAT) throw BackupException("Not a Nocternal Playz backup")
        val version = root["schemaVersion"]?.jsonPrimitive?.int ?: 1
        if (version > BackupSnapshot.SCHEMA_VERSION) throw BackupException("Backup is from a newer app version; please update the app")
        return json.decodeFromJsonElement(BackupSnapshot.serializer(), migrate(root, version))
    }

    /** v1 used British "favourites" and had no app version. */
    private fun migrate(root: JsonObject, version: Int): JsonObject {
        if (version >= 2) return root
        val m = root.toMutableMap()
        m.remove("favourites")?.let { m["favorites"] = it }
        m.putIfAbsent("appVersion", JsonPrimitive("1.x"))
        m["schemaVersion"] = JsonPrimitive(2)
        return JsonObject(m)
    }

    fun restore(text: String, current: LibraryState, localTracks: List<Track>, strategy: RestoreStrategy): RestoreResult {
        val snap = parse(text)
        val idOf = HashMap<String, String>()
        localTracks.forEach { idOf.putIfAbsent(TrackKeys.of(it), it.id) }
        val unmatched = HashSet<String>()
        fun map(key: String): String? = idOf[key] ?: run { unmatched += key; null }

        val playlists = snap.playlists.map { p ->
            Playlist(id = "restored_" + p.name.lowercase().replace(Regex("\\W+"), "_"), name = p.name, trackIds = p.trackKeys.mapNotNull(::map), kind = PlaylistKind.USER, description = p.description)
        }
        val favorites = snap.favorites.mapNotNull(::map).toSet()
        val history = snap.history.mapNotNull { e -> map(e.trackKey)?.let { PlayEvent(it, e.startedAtEpochMs, e.listenedMs, completed = e.completed) } }
        val offsets = snap.lyricsOffsetsMs.mapNotNull { (k, v) -> map(k)?.let { it to v } }.toMap()
        // Keep the local API key; it is never in a backup.
        val settings = snap.settings.copy(assistantApiKey = current.settings.assistantApiKey)

        val state = when (strategy) {
            RestoreStrategy.REPLACE -> LibraryState(settings, playlists, favorites, history, snap.customEqPresets, offsets)
            RestoreStrategy.MERGE -> LibraryState(
                settings = current.settings,
                playlists = current.playlists + playlists.filter { r -> current.playlists.none { it.name.equals(r.name, true) } },
                favorites = current.favorites + favorites,
                history = (current.history + history).distinctBy { it.trackId to it.startedAtEpochMs }.sortedBy { it.startedAtEpochMs },
                customEqPresets = current.customEqPresets + snap.customEqPresets.filter { r -> current.customEqPresets.none { it.id == r.id } },
                lyricsOffsetsMs = offsets + current.lyricsOffsetsMs,
            )
        }
        return RestoreResult(state, unmatched, playlists.size)
    }
}
