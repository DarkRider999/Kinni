package com.nocternal.playz.intelligence

import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import kotlin.math.sqrt

/** A [SongDna] vector scored against another, with a short human-readable reason. */
data class Recommendation(val track: Track, val score: Float, val reason: String)

/** The listener's average taste, derived from their favorites and most-played tracks. */
data class TasteProfile(val dna: SongDna, val sampleSize: Int)

/**
 * Song-DNA-based recommendations (spec #23-27): "more like this", a taste profile built from
 * favorites/plays, and the distance math FutureCast and Discovery Radar both reuse. A sibling to
 * the older genre/mood/BPM [com.nocternal.playz.ai.RecommendationEngine] in `ai_assistant` — this one
 * works purely off [SongDna] vectors so it has no dependency on that module.
 */
class RecommendationEngine2(private val dna: SongDnaAnalyzer = SongDnaAnalyzer()) {

    /** 0 (identical) .. ~1.3 (opposite) Euclidean distance between two DNA vectors across all 7 traits. */
    fun distance(a: SongDna, b: SongDna): Float {
        val diffs = listOf(
            a.energy - b.energy, a.danceability - b.danceability, a.emotion - b.emotion,
            a.instrumentalness - b.instrumentalness, a.vocalIntensity - b.vocalIntensity,
            a.complexity - b.complexity, a.groove - b.groove,
        )
        var sumSq = 0.0
        for (v in diffs) sumSq += (v * v).toDouble()
        return sqrt(sumSq).toFloat()
    }

    fun profileFrom(tracks: List<Track>): TasteProfile? {
        if (tracks.isEmpty()) return null
        val vectors = tracks.map(dna::analyze)
        fun avg(sel: (SongDna) -> Float) = vectors.sumOf { sel(it).toDouble() }.toFloat() / vectors.size
        val avgDna = SongDna(avg(SongDna::energy), avg(SongDna::danceability), avg(SongDna::emotion), avg(SongDna::instrumentalness), avg(SongDna::vocalIntensity), avg(SongDna::complexity), avg(SongDna::groove))
        return TasteProfile(avgDna, tracks.size)
    }

    /** Tracks in [pool] most similar to [seed], excluding [seed] itself and anything in [exclude]. */
    fun similarTo(seed: Track, pool: List<Track>, exclude: Set<String> = emptySet(), limit: Int = 20): List<Recommendation> {
        val seedDna = dna.analyze(seed)
        return pool.asSequence()
            .filter { it.id != seed.id && it.id !in exclude }
            .map { it to distance(seedDna, dna.analyze(it)) }
            .sortedBy { it.second }
            .take(limit)
            .map { (t, d) -> Recommendation(t, (1f - d / 1.3f).coerceIn(0f, 1f), "sounds like “${seed.title}”") }
            .toList()
    }

    /** Tracks in [pool] closest to a taste [profile], for "for you" style picks. */
    fun forProfile(profile: TasteProfile, pool: List<Track>, exclude: Set<String> = emptySet(), limit: Int = 20): List<Recommendation> =
        pool.asSequence()
            .filter { it.id !in exclude }
            .map { it to distance(profile.dna, dna.analyze(it)) }
            .sortedBy { it.second }
            .take(limit)
            .map { (t, d) -> Recommendation(t, (1f - d / 1.3f).coerceIn(0f, 1f), "matches your taste") }
            .toList()
}

/**
 * "What's next" queue preview (spec #2): blends the currently playing track's DNA with what this
 * listener has typically played around this hour, so the preview leans toward their own habits
 * rather than just "more of the same song".
 */
class FutureCast(private val engine: RecommendationEngine2 = RecommendationEngine2(), private val dna: SongDnaAnalyzer = SongDnaAnalyzer()) {
    fun predict(
        nowPlaying: Track?, hourOfDay: Int, history: List<PlayEvent>, tracks: Map<String, Track>,
        pool: List<Track>, recentlyPlayed: Set<String> = emptySet(), size: Int = 8,
    ): List<Recommendation> {
        val hourTracks = history.filter { epochHour(it.startedAtEpochMs) in (hourOfDay - 1)..(hourOfDay + 1) }
            .mapNotNull { tracks[it.trackId] }
        val habitProfile = engine.profileFrom(hourTracks)
        val nowDna = nowPlaying?.let(dna::analyze)
        val target = when {
            nowDna != null && habitProfile != null -> blend(nowDna, habitProfile.dna, 0.6f)
            nowDna != null -> nowDna
            habitProfile != null -> habitProfile.dna
            else -> return emptyList()
        }
        val exclude = recentlyPlayed + listOfNotNull(nowPlaying?.id)
        return engine.forProfile(TasteProfile(target, hourTracks.size), pool, exclude, size)
            .map { it.copy(reason = "fits what you usually play around now") }
    }

    private fun blend(a: SongDna, b: SongDna, weightA: Float): SongDna {
        val wb = 1f - weightA
        fun mix(x: Float, y: Float) = x * weightA + y * wb
        return SongDna(mix(a.energy, b.energy), mix(a.danceability, b.danceability), mix(a.emotion, b.emotion), mix(a.instrumentalness, b.instrumentalness), mix(a.vocalIntensity, b.vocalIntensity), mix(a.complexity, b.complexity), mix(a.groove, b.groove))
    }

    private fun epochHour(epochMs: Long): Int =
        java.time.Instant.ofEpochMilli(epochMs).atZone(java.time.ZoneId.systemDefault()).hour
}

/**
 * Discovery Radar (spec #2): tracks the listener already owns but rarely or never plays, ranked by
 * how well they still match the listener's taste — "forgotten gems" rather than random unplayed songs.
 */
class DiscoveryRadar(private val engine: RecommendationEngine2 = RecommendationEngine2()) {
    fun forgottenGems(allTracks: List<Track>, history: List<PlayEvent>, favorites: Set<String>, limit: Int = 20): List<Recommendation> {
        val played = history.map { it.trackId }.toSet()
        val forgotten = allTracks.filter { it.id !in played }
        if (forgotten.isEmpty()) return emptyList()
        val tasteSeed = allTracks.filter { it.id in favorites || it.id in played }
        val profile = engine.profileFrom(tasteSeed) ?: return forgotten.take(limit).map { Recommendation(it, 0.5f, "never played") }
        return engine.forProfile(profile, forgotten, limit = limit).map { it.copy(reason = "in your library, never played, but matches your taste") }
    }
}
