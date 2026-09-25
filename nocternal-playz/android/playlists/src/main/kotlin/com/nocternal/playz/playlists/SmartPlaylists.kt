package com.nocternal.playz.playlists

import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.PlaylistKind
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreCatalog
import com.nocternal.playz.theme.GenreDetector

/** Snapshot of the listening data smart playlists are computed from. */
data class LibrarySnapshot(
    val tracks: List<Track>,
    val favorites: Set<String> = emptySet(),
    val history: List<PlayEvent> = emptyList(),
)

/**
 * Builds the smart playlists: Favorites, Recently Played, Most Played, Recently Added, mood playlists and
 * one auto-generated playlist per built-in genre.
 */
class SmartPlaylistEngine(
    private val detector: GenreDetector = GenreDetector(),
    /** Mood classifier; the AI assistant's MoodDetector plugs in here. */
    private val moodOf: (Track) -> Mood? = { null },
) {
    fun favorites(lib: LibrarySnapshot): Playlist =
        smart("smart_favorites", "Favorites", lib.tracks.filter { it.id in lib.favorites }.map { it.id }, "Songs you liked")

    fun recentlyPlayed(lib: LibrarySnapshot, limit: Int = 50): Playlist {
        val known = lib.tracks.mapTo(HashSet()) { it.id }
        val ids = lib.history.sortedByDescending { it.startedAtEpochMs }.map { it.trackId }.filter { it in known }.distinct().take(limit)
        return smart("smart_recent", "Recently Played", ids, "Your latest listens")
    }

    /** Counts only plays of at least 30 s (or completed) so skips do not count. */
    fun mostPlayed(lib: LibrarySnapshot, limit: Int = 50): Playlist {
        val known = lib.tracks.mapTo(HashSet()) { it.id }
        val ids = playCounts(lib.history).filterKeys { it in known }.entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .take(limit).map { it.key }
        return smart("smart_most_played", "Most Played", ids, "Your heavy rotation")
    }

    fun recentlyAdded(lib: LibrarySnapshot, limit: Int = 50): Playlist =
        smart("smart_recently_added", "Recently Added", lib.tracks.sortedByDescending { it.dateAddedEpochMs }.take(limit).map { it.id }, "Fresh in your library")

    fun moodPlaylist(lib: LibrarySnapshot, mood: Mood, limit: Int = 100): Playlist {
        val ids = lib.tracks.filter { (moodOf(it) ?: detector.detect(it)?.genre?.defaultMood) == mood }.take(limit).map { it.id }
        return smart("smart_mood_${mood.name.lowercase()}", "${mood.label} Mood", ids, "Auto-picked for a ${mood.label.lowercase()} mood")
    }

    /** One playlist per built-in genre that has at least [minTracks] tracks. */
    fun genrePlaylists(lib: LibrarySnapshot, minTracks: Int = 1): List<Playlist> {
        val byGenre = LinkedHashMap<String, MutableList<String>>()
        for (t in lib.tracks) detector.detect(t)?.let { byGenre.getOrPut(it.genre.id) { mutableListOf() } += t.id }
        return GenreCatalog.all.mapNotNull { g ->
            byGenre[g.id]?.takeIf { it.size >= minTracks }?.let { genrePlaylist(g, it) }
        }
    }

    fun genrePlaylist(genre: GenreDefinition, ids: List<String>) = Playlist(
        id = "genre_${genre.id}", name = "${genre.emoji} ${genre.displayName}", trackIds = ids,
        kind = PlaylistKind.GENRE, genreId = genre.id, description = genre.aiSuggestions.firstOrNull().orEmpty(),
    )

    fun all(lib: LibrarySnapshot): List<Playlist> =
        listOf(favorites(lib), recentlyPlayed(lib), mostPlayed(lib), recentlyAdded(lib)) +
            Mood.entries.map { moodPlaylist(lib, it) }.filter { it.trackIds.isNotEmpty() } +
            genrePlaylists(lib)

    private fun smart(id: String, name: String, ids: List<String>, desc: String) =
        Playlist(id = id, name = name, trackIds = ids, kind = PlaylistKind.SMART, description = desc)

    companion object {
        const val MIN_COUNTED_PLAY_MS = 30_000L
        fun playCounts(history: List<PlayEvent>): Map<String, Int> =
            history.filter { it.completed || it.listenedMs >= MIN_COUNTED_PLAY_MS }.groupingBy { it.trackId }.eachCount()
    }
}
