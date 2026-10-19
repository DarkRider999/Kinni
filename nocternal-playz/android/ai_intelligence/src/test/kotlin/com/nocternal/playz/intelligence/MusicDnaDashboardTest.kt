package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class MusicDnaDashboardTest {
    private val zone = ZoneId.of("UTC")
    private val dashboard = MusicDnaDashboard(zone = zone)

    private fun at(hour: Int): Long = ZonedDateTime.of(2026, 1, 1, hour, 0, 0, 0, zone).toInstant().toEpochMilli()

    private val tracks = listOf(
        Track("edm1", "", "Peak Hour", genreTag = "EDM", bpm = 128f, energy = 0.9f),
        Track("edm2", "", "Second Drop", genreTag = "EDM", bpm = 128f, energy = 0.9f),
        Track("chill1", "", "Soft Morning", energy = 0.2f, camelotKey = "4B"),
    )

    @Test fun genreSharesSumToOne() {
        val history = listOf(PlayEvent("edm1", at(14), 60_000), PlayEvent("edm2", at(14), 60_000), PlayEvent("chill1", at(8), 60_000))
        val dna = dashboard.build(tracks, history)
        val total = dna.genreShares.sumOf { it.fraction.toDouble() }
        assertEquals(1.0, total, 0.01)
    }

    @Test fun energyByPartOfDayReflectsPlaybackHour() {
        val history = listOf(PlayEvent("edm1", at(23), 60_000)) // late night
        val dna = dashboard.build(tracks, history)
        assertTrue(dna.energyByPartOfDay.lateNight > 0.8f)
        assertEquals(0f, dna.energyByPartOfDay.morning, 0.001f)
    }

    @Test fun heavyLateNightListeningYieldsNightOwl() {
        val history = (1..10).map { PlayEvent("edm1", at(23), 60_000) }
        val dna = dashboard.build(tracks, history)
        assertEquals(ListeningPersonality.NIGHT_OWL, dna.personality)
    }

    @Test fun djSessionsBiasTowardDjMindset() {
        val history = listOf(PlayEvent("edm1", at(14), 60_000))
        val dna = dashboard.build(tracks, history, hasDjSessions = true)
        assertEquals(ListeningPersonality.DJ_MINDSET, dna.personality)
    }

    @Test fun emptyHistoryDefaultsToExplorer() {
        val dna = dashboard.build(tracks, emptyList())
        assertEquals(ListeningPersonality.EXPLORER, dna.personality)
        assertTrue(dna.genreShares.isEmpty())
    }
}
