package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class MemoryYear(val year: Int, val tracks: List<Track>)

data class OnThisDay(
    val years: List<MemoryYear>,
    val frequentArtists: List<String>,
    val favouriteGenres: List<String>,
)

/**
 * "On This Day" (spec: Listening Memories): what was played on this calendar day (month + day,
 * any year) in past years, plus the artists and genres that came up often around this date.
 * A pure read of [PlayEvent] history — nothing new is persisted.
 */
class ListeningMemories(private val genres: GenreDetector = GenreDetector(), private val zone: ZoneId = ZoneId.systemDefault()) {
    fun onThisDay(tracks: List<Track>, history: List<PlayEvent>, today: LocalDate = LocalDate.now(zone), windowDays: Int = 3): OnThisDay {
        val byId = tracks.associateBy { it.id }
        val currentYear = today.year

        val onDate = history.filter { e ->
            val d = Instant.ofEpochMilli(e.startedAtEpochMs).atZone(zone).toLocalDate()
            d.year != currentYear && d.monthValue == today.monthValue && d.dayOfMonth == today.dayOfMonth
        }
        val years = onDate.groupBy { Instant.ofEpochMilli(it.startedAtEpochMs).atZone(zone).toLocalDate().year }
            .map { (year, events) -> MemoryYear(year, events.mapNotNull { byId[it.trackId] }.distinctBy { it.id }) }
            .sortedByDescending { it.year }

        val nearby = history.filter { e ->
            val d = Instant.ofEpochMilli(e.startedAtEpochMs).atZone(zone).toLocalDate()
            d.year != currentYear && kotlin.math.abs(d.dayOfYear - today.dayOfYear) <= windowDays
        }
        val nearbyTracks = nearby.mapNotNull { byId[it.trackId] }
        val frequentArtists = nearbyTracks.groupingBy { it.artist }.eachCount().entries.sortedByDescending { it.value }.take(3).map { it.key }
        val favouriteGenres = nearbyTracks.mapNotNull { genres.detect(it)?.genre?.displayName }.groupingBy { it }.eachCount()
            .entries.sortedByDescending { it.value }.take(3).map { it.key }

        return OnThisDay(years, frequentArtists, favouriteGenres)
    }
}
