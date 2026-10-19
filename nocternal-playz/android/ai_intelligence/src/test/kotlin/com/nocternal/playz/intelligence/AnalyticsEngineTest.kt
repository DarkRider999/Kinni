package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

class AnalyticsEngineTest {
    private val zone = ZoneId.of("UTC")
    private val engine = AnalyticsEngine(zone = zone)

    private fun at(date: LocalDate, hour: Int): Long =
        ZonedDateTime.of(date, java.time.LocalTime.of(hour, 0), zone).toInstant().toEpochMilli()

    private val tracks = mapOf(
        "t1" to Track("t1", "", "Club Anthem", artist = "DJ One", genreTag = "EDM", bpm = 128f, energy = 0.9f),
        "t2" to Track("t2", "", "Sleepy Tune", artist = "Lo Artist", energy = 0.1f),
    )

    @Test fun heatmapBucketsByDayAndHour() {
        val day = LocalDate.of(2026, 1, 5) // Monday
        val events = listOf(
            PlayEvent("t1", at(day, 22), listenedMs = 60_000),
            PlayEvent("t1", at(day, 22), listenedMs = 30_000),
        )
        val cells = engine.heatmap(events)
        assertEquals(1, cells.size)
        assertEquals(1, cells[0].dayOfWeek)
        assertEquals(22, cells[0].hour)
        assertEquals(90_000L, cells[0].listenedMs)
        assertEquals(2, cells[0].plays)
    }

    @Test fun monthlyReportAggregatesWithinMonthOnly() {
        val events = listOf(
            PlayEvent("t1", at(LocalDate.of(2026, 3, 10), 10), listenedMs = 100_000),
            PlayEvent("t1", at(LocalDate.of(2026, 3, 12), 10), listenedMs = 50_000),
            PlayEvent("t2", at(LocalDate.of(2026, 4, 1), 10), listenedMs = 999_000),
        )
        val report = engine.monthlyReport(events, tracks, 2026, 3)
        assertEquals(150_000L, report.totalListenedMs)
        assertEquals(2, report.totalPlays)
        assertEquals("t1", report.topTrackId)
        assertEquals("DJ One", report.topArtist)
    }

    @Test fun topArtistsRankedByListenedMs() {
        val events = listOf(
            PlayEvent("t1", at(LocalDate.of(2026, 1, 1), 9), listenedMs = 200_000),
            PlayEvent("t2", at(LocalDate.of(2026, 1, 1), 9), listenedMs = 50_000),
        )
        val top = engine.topArtists(events, tracks)
        assertEquals("DJ One", top.first().artist)
    }

    @Test fun streakCountsConsecutiveDaysEndingToday() {
        val today = LocalDate.of(2026, 5, 10)
        val events = listOf(
            PlayEvent("t1", at(today, 9), listenedMs = 1_000),
            PlayEvent("t1", at(today.minusDays(1), 9), listenedMs = 1_000),
            PlayEvent("t1", at(today.minusDays(2), 9), listenedMs = 1_000),
            PlayEvent("t1", at(today.minusDays(5), 9), listenedMs = 1_000),
        )
        val streak = engine.streak(events, today)
        assertEquals(3, streak.currentDays)
        assertEquals(3, streak.longestDays)
    }

    @Test fun dailyTimelineIsSortedByDate() {
        val events = listOf(
            PlayEvent("t1", at(LocalDate.of(2026, 2, 2), 9), listenedMs = 1_000),
            PlayEvent("t1", at(LocalDate.of(2026, 2, 1), 9), listenedMs = 2_000),
        )
        val timeline = engine.dailyTimeline(events)
        assertEquals(listOf(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 2)), timeline.keys.toList())
    }

    @Test fun emptyHistoryYieldsZeroStreak() {
        val streak = engine.streak(emptyList(), LocalDate.of(2026, 1, 1))
        assertEquals(0, streak.currentDays)
        assertEquals(0, streak.longestDays)
    }
}
