package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector
import java.time.Instant
import java.time.ZoneId

data class Share(val label: String, val fraction: Float)
data class EnergyByPartOfDay(val morning: Float, val afternoon: Float, val evening: Float, val lateNight: Float)

enum class ListeningPersonality(val label: String, val description: String) {
    EXPLORER("Explorer", "Wide genre range, always trying something new"),
    COLLECTOR("Collector", "Deep, focused listening within a few favourites"),
    PARTY_STARTER("Party Starter", "High-energy, upbeat tracks most of the time"),
    DEEP_LISTENER("Deep Listener", "Rarely skips, listens tracks through"),
    DJ_MINDSET("DJ Mindset", "Thinks in sets, keys and transitions"),
    NIGHT_OWL("Night Owl", "Most listening happens late at night"),
}

data class MusicDna(
    val genreShares: List<Share>,
    val moodShares: List<Share>,
    val energyByPartOfDay: EnergyByPartOfDay,
    val personality: ListeningPersonality,
)

/**
 * Music DNA Dashboard (spec: Analytics Pro): genre/mood % breakdown, an energy profile across the
 * day, and a "Listening Personality" label — all derived from data already recorded, same spirit
 * as [AnalyticsEngine] and [MoodClassifier]. Genre buckets reflect whatever genres are actually
 * detected in the library (plus "Other"), rather than a fixed hardcoded taxonomy.
 */
class MusicDnaDashboard(
    private val genres: GenreDetector = GenreDetector(),
    private val dna: SongDnaAnalyzer = SongDnaAnalyzer(genres),
    private val moods: MoodClassifier = MoodClassifier(genres, dna),
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    private fun partOfDay(hour: Int) = when (hour) {
        in 5..11 -> PartOfDay.MORNING
        in 12..16 -> PartOfDay.AFTERNOON
        in 17..21 -> PartOfDay.EVENING
        else -> PartOfDay.LATE_NIGHT
    }
    private enum class PartOfDay { MORNING, AFTERNOON, EVENING, LATE_NIGHT }

    private fun shares(counts: Map<String, Int>, topN: Int = 5): List<Share> {
        val total = counts.values.sum()
        if (total == 0) return emptyList()
        val sorted = counts.entries.sortedByDescending { it.value }
        val top = sorted.take(topN)
        val otherCount = sorted.drop(topN).sumOf { it.value }
        val result = top.map { Share(it.key, it.value.toFloat() / total) }
        return if (otherCount > 0) result + Share("Other", otherCount.toFloat() / total) else result
    }

    private fun moodBucket(m: Mood): String = when (m) {
        Mood.ENERGETIC, Mood.PARTY -> "Energetic"
        Mood.UPLIFTING, Mood.HAPPY -> "Uplifting"
        Mood.DARK -> "Dark"
        Mood.CALM, Mood.SLEEPY -> "Chill"
        Mood.MELANCHOLIC -> "Emotional"
        Mood.AGGRESSIVE -> "Aggressive"
        Mood.ROMANTIC -> "Romantic"
        Mood.FOCUSED, Mood.SPIRITUAL -> "Other"
    }

    fun build(tracks: List<Track>, history: List<PlayEvent>, hasDjSessions: Boolean = false): MusicDna {
        val byId = tracks.associateBy { it.id }
        val playedTracks = history.mapNotNull { byId[it.trackId] }

        val genreCounts = HashMap<String, Int>()
        val moodCounts = HashMap<String, Int>()
        val energySum = DoubleArray(PartOfDay.entries.size)
        val energyCount = IntArray(PartOfDay.entries.size)

        for (e in history) {
            val t = byId[e.trackId] ?: continue
            genres.detect(t)?.genre?.displayName?.let { genreCounts[it] = (genreCounts[it] ?: 0) + 1 }
            val bucket = moodBucket(moods.classify(t).mood)
            moodCounts[bucket] = (moodCounts[bucket] ?: 0) + 1
            val part = partOfDay(Instant.ofEpochMilli(e.startedAtEpochMs).atZone(zone).hour)
            energySum[part.ordinal] += dna.analyze(t).energy
            energyCount[part.ordinal]++
        }
        fun avgEnergy(p: PartOfDay) = if (energyCount[p.ordinal] == 0) 0f else (energySum[p.ordinal] / energyCount[p.ordinal]).toFloat()

        val personality = classifyPersonality(playedTracks, genreCounts, moodCounts, energyCount, hasDjSessions)

        return MusicDna(
            genreShares = shares(genreCounts), moodShares = shares(moodCounts),
            energyByPartOfDay = EnergyByPartOfDay(avgEnergy(PartOfDay.MORNING), avgEnergy(PartOfDay.AFTERNOON), avgEnergy(PartOfDay.EVENING), avgEnergy(PartOfDay.LATE_NIGHT)),
            personality = personality,
        )
    }

    private fun classifyPersonality(
        playedTracks: List<Track>, genreCounts: Map<String, Int>, moodCounts: Map<String, Int>,
        energyCount: IntArray, hasDjSessions: Boolean,
    ): ListeningPersonality {
        if (playedTracks.isEmpty()) return ListeningPersonality.EXPLORER
        val totalPlays = playedTracks.size
        val scores = HashMap<ListeningPersonality, Float>()
        fun add(p: ListeningPersonality, v: Float) { scores[p] = (scores[p] ?: 0f) + v }

        if (hasDjSessions) add(ListeningPersonality.DJ_MINDSET, 1.5f)

        val lateNightFraction = energyCount[PartOfDay.LATE_NIGHT.ordinal].toFloat() / energyCount.sum().coerceAtLeast(1)
        if (lateNightFraction > 0.4f) add(ListeningPersonality.NIGHT_OWL, 1.2f * lateNightFraction)

        val distinctGenres = genreCounts.size
        if (distinctGenres >= 3) add(ListeningPersonality.EXPLORER, (distinctGenres.coerceAtMost(6)).toFloat() / 6f * 2f)
        val topGenreShare = (genreCounts.values.maxOrNull() ?: 0).toFloat() / totalPlays.coerceAtLeast(1)
        if (topGenreShare > 0.6f && totalPlays >= 5) add(ListeningPersonality.COLLECTOR, topGenreShare)

        val energeticFraction = ((moodCounts["Energetic"] ?: 0) + (moodCounts["Uplifting"] ?: 0)).toFloat() / totalPlays.coerceAtLeast(1)
        if (energeticFraction > 0.4f) add(ListeningPersonality.PARTY_STARTER, energeticFraction)

        if (scores.isEmpty() || (scores.values.maxOrNull() ?: 0f) < 0.3f) add(ListeningPersonality.DEEP_LISTENER, 0.3f)

        return scores.entries.maxByOrNull { it.value }?.key ?: ListeningPersonality.DEEP_LISTENER
    }
}
