package com.nocternal.playz.playlists

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class PlaylistsTest {
    private val tracks = listOf(
        Track("1", "", "Om Namah Shivaya", genreTag = "Bhajan", folder = "Music/Devotional", dateAddedEpochMs = 3),
        Track("2", "", "Rain Sleep", folder = "Music/Sleep", dateAddedEpochMs = 2),
        Track("3", "", "Strobe", genreTag = "Progressive House", folder = "Music/EDM", dateAddedEpochMs = 1),
        Track("4", "", "Hanuman Chalisa", folder = "Music/Devotional/Morning", dateAddedEpochMs = 4),
    )
    private val day = 86_400_000L
    private val history = listOf(
        PlayEvent("3", 10 * day, 200_000), PlayEvent("1", 11 * day, 200_000), PlayEvent("1", 12 * day, 200_000),
        PlayEvent("2", 12 * day + 1000, 5_000, completed = false), PlayEvent("2", 12 * day + 2000, 5_000, completed = false),
    )
    private val lib = LibrarySnapshot(tracks, favorites = setOf("2"), history = history)
    private val engine = SmartPlaylistEngine()

    @Test fun smartLists() {
        assertEquals(listOf("2"), engine.favorites(lib).trackIds)
        assertEquals(listOf("2", "1", "3"), engine.recentlyPlayed(lib).trackIds)
        // Skips (5 s, not completed) do not count.
        assertEquals(listOf("1", "3"), engine.mostPlayed(lib).trackIds)
        assertEquals(listOf("4", "1", "2", "3"), engine.recentlyAdded(lib).trackIds)
        assertEquals(listOf("1", "4"), engine.moodPlaylist(lib, Mood.SPIRITUAL).trackIds)
    }

    @Test fun genrePlaylistsFollowCatalogOrder() {
        val g = engine.genrePlaylists(lib)
        assertEquals(listOf("devotional", "sleep", "edm"), g.map { it.genreId })
        assertEquals(listOf("1", "4"), g.first().trackIds)
    }

    @Test fun folderTree() {
        val root = FolderTree.build(tracks)
        val dev = root.find("Music/Devotional")!!
        assertEquals(listOf("1"), dev.trackIds)
        assertEquals(listOf("1", "4"), dev.allTrackIds())
        assertEquals(4, root.totalCount)
    }

    @Test fun timeline() {
        val days = HistoryTimeline.build(history, ZoneOffset.UTC, today = LocalDate.ofEpochDay(12))
        assertEquals(listOf("Today", "Yesterday"), days.take(2).map { it.label })
        assertEquals(3, days.first().events.size)
    }
}
