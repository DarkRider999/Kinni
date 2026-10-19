package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmartCollectionsTest {
    private val collections = SmartCollections()
    private val now = System.currentTimeMillis()

    private val tracks = listOf(
        Track("workout1", "", "Pump It", bpm = 140f, energy = 0.85f),
        Track("focus1", "", "Deep Code", genreTag = "Focus", energy = 0.3f),
        Track("rainy1", "", "Grey Skies", energy = 0.2f, camelotKey = "3A"),
        Track("gem1", "", "Unplayed Gem", energy = 0.6f, camelotKey = "8A", bpm = 124f),
        Track("fav1", "", "Old Favourite", energy = 0.5f),
    )

    @Test fun workoutEnergyKeepsOnlyHighBpmHighEnergy() {
        val result = collections.workoutEnergy(tracks)
        assertEquals(listOf("workout1"), result.tracks.map { it.id })
    }

    @Test fun focusModeExcludesHighEnergyTracks() {
        val result = collections.focusMode(tracks)
        assertTrue(result.tracks.none { it.id == "workout1" })
    }

    @Test fun mostReplayedRanksByPlayCount() {
        val history = listOf(
            PlayEvent("gem1", now, 60_000), PlayEvent("gem1", now, 60_000), PlayEvent("gem1", now, 60_000),
            PlayEvent("fav1", now, 60_000),
        )
        val result = collections.mostReplayed(tracks, history)
        assertEquals("gem1", result.tracks.first().id)
    }

    @Test fun mostSkippedIgnoresFullListens() {
        val history = listOf(
            PlayEvent("workout1", now, 5_000), // short play on a track with a long duration below
            PlayEvent("fav1", now, 59_000),
        )
        val withDuration = tracks.map { it.copy(durationMs = 200_000) }
        val result = collections.mostSkipped(withDuration, history)
        assertEquals(listOf("workout1"), result.tracks.map { it.id })
    }

    @Test fun forgottenFavouritesOnlyIncludesStaleFavorites() {
        val staleHistory = listOf(PlayEvent("fav1", now - 60L * 86_400_000L, 60_000))
        val result = collections.forgottenFavourites(tracks, staleHistory, favorites = setOf("fav1"))
        assertEquals(listOf("fav1"), result.tracks.map { it.id })
    }

    @Test fun forgottenFavouritesExcludesRecentlyPlayedFavorites() {
        val recentHistory = listOf(PlayEvent("fav1", now, 60_000))
        val result = collections.forgottenFavourites(tracks, recentHistory, favorites = setOf("fav1"))
        assertTrue(result.tracks.isEmpty())
    }

    @Test fun allSkipsEmptyCollections() {
        val result = collections.all(emptyList(), emptyList(), emptySet())
        assertTrue(result.isEmpty())
    }
}
