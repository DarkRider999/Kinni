package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector
import java.time.Instant
import java.time.ZoneId

/** A named, auto-generated playlist (spec: Smart Collections) with a short line explaining the pick. */
data class SmartCollection(val id: String, val title: String, val subtitle: String, val tracks: List<Track>)

/**
 * The 10 Smart Collections (Phase 4B): fully derived from data already recorded — [Track] fields,
 * [SongDna], [MoodClassifier] and [PlayEvent] history. Nothing here is persisted; every collection
 * is recomputed on demand from the current library/history, so it is "automatically maintained" by
 * construction rather than by a background job.
 */
class SmartCollections(
    private val genres: GenreDetector = GenreDetector(),
    private val dna: SongDnaAnalyzer = SongDnaAnalyzer(genres),
    private val moods: MoodClassifier = MoodClassifier(genres, dna),
    private val recommender: RecommendationEngine2 = RecommendationEngine2(dna),
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    private fun hourOf(epochMs: Long) = Instant.ofEpochMilli(epochMs).atZone(zone).hour

    /** A play is treated as a skip when it started but stopped well short of a full track — no separate persisted flag needed. */
    private fun isSkip(e: PlayEvent, track: Track): Boolean =
        e.listenedMs in 1 until 20_000L && track.durationMs > 60_000L && e.listenedMs < track.durationMs / 3

    fun hiddenGems(tracks: List<Track>, history: List<PlayEvent>, limit: Int = 20): SmartCollection {
        val plays = history.groupingBy { it.trackId }.eachCount()
        val candidates = tracks.filter { (plays[it.id] ?: 0) <= 1 }
        val profile = recommender.profileFrom(tracks.filter { (plays[it.id] ?: 0) >= 3 }) ?: recommender.profileFrom(tracks)
        val ranked = profile?.let { recommender.forProfile(it, candidates, limit = limit).map { r -> r.track } } ?: candidates.take(limit)
        return SmartCollection("hidden_gems", "Hidden Gems", "High-DNA-match tracks you've barely played", ranked)
    }

    fun forgottenFavourites(tracks: List<Track>, history: List<PlayEvent>, favorites: Set<String>, staleDays: Long = 30, limit: Int = 20): SmartCollection {
        val cutoff = System.currentTimeMillis() - staleDays * 86_400_000L
        val lastPlayed = history.groupingBy { it.trackId }.fold(0L) { acc, e -> maxOf(acc, e.startedAtEpochMs) }
        val picks = tracks.filter { it.id in favorites && (lastPlayed[it.id] ?: 0L) < cutoff }
            .sortedBy { lastPlayed[it.id] ?: 0L }.take(limit)
        return SmartCollection("forgotten_favourites", "Forgotten Favourites", "Loved before, quiet lately", picks)
    }

    fun nightDrive(tracks: List<Track>, limit: Int = 30): SmartCollection {
        val picks = tracks.filter { t -> val d = dna.analyze(t); d.groove > 0.55f && d.emotion > 0.5f && !t.isPodcast }
            .sortedByDescending { dna.analyze(it).groove }.take(limit)
        return SmartCollection("night_drive", "Night Drive", "Dark, melodic, high-groove", picks)
    }

    fun workoutEnergy(tracks: List<Track>, limit: Int = 30): SmartCollection {
        val picks = tracks.filter { (it.bpm ?: 0f) >= 120f && (it.energy ?: 0f) >= 0.65f }
            .sortedByDescending { it.energy ?: 0f }.take(limit)
        return SmartCollection("workout_energy", "Workout Energy", "High BPM, high energy", picks)
    }

    fun focusMode(tracks: List<Track>, limit: Int = 30): SmartCollection {
        val picks = tracks.filter { t -> val d = dna.analyze(t); d.vocalIntensity < 0.45f && d.energy in 0.2f..0.6f }
            .sortedBy { dna.analyze(it).vocalIntensity }.take(limit)
        return SmartCollection("focus_mode", "Focus Mode", "Low-distraction, mostly instrumental", picks)
    }

    fun rainyDay(tracks: List<Track>, limit: Int = 30): SmartCollection {
        val picks = tracks.filter { t -> val d = dna.analyze(t); d.emotion > 0.55f && d.energy < 0.5f }
            .sortedByDescending { dna.analyze(it).emotion }.take(limit)
        return SmartCollection("rainy_day", "Rainy Day", "Emotional, chill selections", picks)
    }

    fun sunsetChill(tracks: List<Track>, limit: Int = 30): SmartCollection {
        val picks = tracks.filter { t -> val d = dna.analyze(t); d.energy in 0.3f..0.6f && d.emotion in 0.25f..0.6f }
            .sortedBy { kotlin.math.abs(dna.analyze(it).energy - 0.45f) }.take(limit)
        return SmartCollection("sunset_chill", "Sunset Chill", "Smooth, warm, mid-energy", picks)
    }

    fun mostReplayed(tracks: List<Track>, history: List<PlayEvent>, limit: Int = 20): SmartCollection {
        val counts = history.groupingBy { it.trackId }.eachCount()
        val byId = tracks.associateBy { it.id }
        val picks = counts.entries.sortedByDescending { it.value }.mapNotNull { byId[it.key] }.take(limit)
        return SmartCollection("most_replayed", "Most Replayed", "Played the most, by far", picks)
    }

    fun mostSkipped(tracks: List<Track>, history: List<PlayEvent>, limit: Int = 20): SmartCollection {
        val byId = tracks.associateBy { it.id }
        val skipCounts = HashMap<String, Int>()
        for (e in history) { val t = byId[e.trackId] ?: continue; if (isSkip(e, t)) skipCounts[e.trackId] = (skipCounts[e.trackId] ?: 0) + 1 }
        val picks = skipCounts.entries.sortedByDescending { it.value }.mapNotNull { byId[it.key] }.take(limit)
        return SmartCollection("most_skipped", "Most Skipped", "Started often, finished rarely", picks)
    }

    fun trendingForYou(tracks: List<Track>, history: List<PlayEvent>, recentDays: Long = 14, limit: Int = 20): SmartCollection {
        val cutoff = System.currentTimeMillis() - recentDays * 86_400_000L
        val byId = tracks.associateBy { it.id }
        val recentTracks = history.filter { it.startedAtEpochMs >= cutoff }.mapNotNull { byId[it.trackId] }
        val profile = recommender.profileFrom(recentTracks) ?: recommender.profileFrom(tracks)
        val picks = profile?.let { recommender.forProfile(it, tracks, limit = limit).map { r -> r.track } } ?: emptyList()
        return SmartCollection("trending_for_you", "Trending For You", "Matches what you've been playing lately", picks)
    }

    fun all(tracks: List<Track>, history: List<PlayEvent>, favorites: Set<String>): List<SmartCollection> = listOf(
        hiddenGems(tracks, history), forgottenFavourites(tracks, history, favorites), nightDrive(tracks),
        workoutEnergy(tracks), focusMode(tracks), rainyDay(tracks), sunsetChill(tracks),
        mostReplayed(tracks, history), mostSkipped(tracks, history), trendingForYou(tracks, history),
    ).filter { it.tracks.isNotEmpty() }
}
