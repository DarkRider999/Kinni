package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

class ListeningMemoriesTest {
    private val zone = ZoneId.of("UTC")
    private val memories = ListeningMemories(zone = zone)
    private val today = LocalDate.of(2026, 10, 19)

    private fun at(date: LocalDate): Long = ZonedDateTime.of(date, java.time.LocalTime.NOON, zone).toInstant().toEpochMilli()

    private val tracks = listOf(Track("t1", "", "Old Anthem", artist = "DJ Retro"), Track("t2", "", "This Year", artist = "New Artist"))

    @Test fun findsTracksFromSameCalendarDayInPastYears() {
        val history = listOf(
            PlayEvent("t1", at(today.minusYears(1)), 60_000),
            PlayEvent("t2", at(today), 60_000), // same year, must be excluded
        )
        val result = memories.onThisDay(tracks, history, today)
        assertEquals(1, result.years.size)
        assertEquals(2025, result.years.first().year)
        assertEquals(listOf("t1"), result.years.first().tracks.map { it.id })
    }

    @Test fun ignoresDatesOutsideTheWindowForArtistsAndGenres() {
        val farOff = listOf(PlayEvent("t1", at(today.minusYears(1).minusMonths(2)), 60_000))
        val result = memories.onThisDay(tracks, farOff, today)
        assertTrue(result.frequentArtists.isEmpty())
    }

    @Test fun emptyHistoryYieldsEmptyMemory() {
        val result = memories.onThisDay(tracks, emptyList(), today)
        assertTrue(result.years.isEmpty())
        assertTrue(result.frequentArtists.isEmpty())
        assertTrue(result.favouriteGenres.isEmpty())
    }
}
