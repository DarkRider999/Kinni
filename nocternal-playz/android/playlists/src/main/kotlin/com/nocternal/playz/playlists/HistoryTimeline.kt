package com.nocternal.playz.playlists

import com.nocternal.playz.model.PlayEvent
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** A day in the playback history timeline. */
data class TimelineDay(val date: LocalDate, val label: String, val events: List<PlayEvent>, val listenedMs: Long)

object HistoryTimeline {
    /** Groups history into days, newest first, labelled Today / Yesterday / weekday / date. */
    fun build(history: List<PlayEvent>, zone: ZoneId = ZoneId.systemDefault(), today: LocalDate = LocalDate.now(zone)): List<TimelineDay> =
        history.sortedByDescending { it.startedAtEpochMs }
            .groupBy { Instant.ofEpochMilli(it.startedAtEpochMs).atZone(zone).toLocalDate() }
            .map { (date, events) -> TimelineDay(date, label(date, today), events, events.sumOf { it.listenedMs }) }
            .sortedByDescending { it.date }

    fun label(date: LocalDate, today: LocalDate): String = when {
        date == today -> "Today"
        date == today.minusDays(1) -> "Yesterday"
        date.isAfter(today.minusDays(7)) -> date.dayOfWeek.name.lowercase().replaceFirstChar { it.uppercase() }
        date.year == today.year -> date.format(DateTimeFormatter.ofPattern("d MMM"))
        else -> date.format(DateTimeFormatter.ofPattern("d MMM yyyy"))
    }

    /** Total listening time per hour of day (0..23) — powers the "when do you listen" insight and AI time suggestions. */
    fun hourlyProfile(history: List<PlayEvent>, zone: ZoneId = ZoneId.systemDefault()): LongArray {
        val out = LongArray(24)
        history.forEach { out[Instant.ofEpochMilli(it.startedAtEpochMs).atZone(zone).hour] += it.listenedMs }
        return out
    }
}
