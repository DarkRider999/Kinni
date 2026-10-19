package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/** One cell of the listening heatmap: a day of week (1=Monday..7=Sunday) and hour of day (0..23). */
data class HeatmapCell(val dayOfWeek: Int, val hour: Int, val listenedMs: Long, val plays: Int)

data class MonthlyReport(
    val year: Int,
    val month: Int,
    val totalListenedMs: Long,
    val totalPlays: Int,
    val topTrackId: String?,
    val topArtist: String?,
    val topGenre: String?,
    val topMood: Mood?,
)

data class ArtistTotal(val artist: String, val listenedMs: Long, val plays: Int)

data class ListeningStreak(val currentDays: Int, val longestDays: Int)

/**
 * Turns the already-recorded [PlayEvent] history into the Listening Analytics screen's data — a
 * heatmap, a monthly report, genre/mood distributions, a daily timeline, top artists and a streak.
 * Pure functions, no persistence of its own: it reads whatever `LibraryRepository` already keeps
 * (JSON-backed, capped at 5000 events, already private-mode aware since private plays are never
 * recorded in the first place).
 */
class AnalyticsEngine(
    private val zone: ZoneId = ZoneId.systemDefault(),
    private val genres: GenreDetector = GenreDetector(),
    private val moods: MoodClassifier = MoodClassifier(genres),
) {
    private fun time(event: PlayEvent): ZonedDateTime =
        Instant.ofEpochMilli(event.startedAtEpochMs).atZone(zone)

    fun heatmap(events: List<PlayEvent>): List<HeatmapCell> {
        val byCell = LinkedHashMap<Pair<Int, Int>, Pair<Long, Int>>()
        for (e in events) {
            val t = time(e)
            val key = t.dayOfWeek.value to t.hour
            val prev = byCell[key] ?: (0L to 0)
            byCell[key] = (prev.first + e.listenedMs) to (prev.second + 1)
        }
        return byCell.map { (k, v) -> HeatmapCell(k.first, k.second, v.first, v.second) }
    }

    fun monthlyReport(events: List<PlayEvent>, tracks: Map<String, Track>, year: Int, month: Int): MonthlyReport {
        val inMonth = events.filter { val t = time(it); t.year == year && t.monthValue == month }
        val totalMs = inMonth.sumOf { it.listenedMs }
        val topTrackId = inMonth.groupingBy { it.trackId }.eachCount().maxByOrNull { it.value }?.key
        val topArtist = inMonth.mapNotNull { tracks[it.trackId]?.artist }
            .groupingBy { it }.eachCount().maxByOrNull { it.value }?.key
        val topGenre = inMonth.mapNotNull { tracks[it.trackId] }
            .mapNotNull { genres.detect(it)?.genre?.id }
            .groupingBy { it }.eachCount().maxByOrNull { it.value }?.key
        val topMood = inMonth.mapNotNull { tracks[it.trackId] }
            .map { moods.classify(it).mood }
            .groupingBy { it }.eachCount().maxByOrNull { it.value }?.key
        return MonthlyReport(year, month, totalMs, inMonth.size, topTrackId, topArtist, topGenre, topMood)
    }

    fun genreDistribution(events: List<PlayEvent>, tracks: Map<String, Track>): Map<String, Long> {
        val byGenre = LinkedHashMap<String, Long>()
        for (e in events) {
            val track = tracks[e.trackId] ?: continue
            val genre = genres.detect(track)?.genre?.id ?: continue
            byGenre[genre] = (byGenre[genre] ?: 0L) + e.listenedMs
        }
        return byGenre
    }

    fun moodDistribution(events: List<PlayEvent>, tracks: Map<String, Track>): Map<Mood, Long> {
        val byMood = LinkedHashMap<Mood, Long>()
        for (e in events) {
            val track = tracks[e.trackId] ?: continue
            val mood = moods.classify(track).mood
            byMood[mood] = (byMood[mood] ?: 0L) + e.listenedMs
        }
        return byMood
    }

    fun dailyTimeline(events: List<PlayEvent>): Map<LocalDate, Long> {
        val byDay = LinkedHashMap<LocalDate, Long>()
        for (e in events) {
            val day = time(e).toLocalDate()
            byDay[day] = (byDay[day] ?: 0L) + e.listenedMs
        }
        return byDay.toSortedMap()
    }

    fun topArtists(events: List<PlayEvent>, tracks: Map<String, Track>, limit: Int = 10): List<ArtistTotal> {
        val byArtist = LinkedHashMap<String, Pair<Long, Int>>()
        for (e in events) {
            val artist = tracks[e.trackId]?.artist ?: continue
            val prev = byArtist[artist] ?: (0L to 0)
            byArtist[artist] = (prev.first + e.listenedMs) to (prev.second + 1)
        }
        return byArtist.entries
            .map { (artist, v) -> ArtistTotal(artist, v.first, v.second) }
            .sortedByDescending { it.listenedMs }
            .take(limit)
    }

    /** Current and longest streaks of consecutive days with at least one completed play, ending today. */
    fun streak(events: List<PlayEvent>, today: LocalDate = LocalDate.now(zone)): ListeningStreak {
        val days = events.map { time(it).toLocalDate() }.toSortedSet()
        if (days.isEmpty()) return ListeningStreak(0, 0)

        var longest = 1
        var run = 1
        val sorted = days.toList()
        for (i in 1 until sorted.size) {
            run = if (sorted[i] == sorted[i - 1].plusDays(1)) run + 1 else 1
            if (run > longest) longest = run
        }

        var current = 0
        var cursor = today
        while (days.contains(cursor)) {
            current++
            cursor = cursor.minusDays(1)
        }
        return ListeningStreak(current, longest)
    }
}
