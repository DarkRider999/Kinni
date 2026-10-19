package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector

enum class QueueAction(val label: String) {
    KEEP_VIBE("Keep This Vibe"),
    BUILD_ENERGY("Build Energy"),
    COOL_DOWN("Cool Down"),
    MORE_VOCALS("More Vocals"),
    MORE_INSTRUMENTAL("More Instrumental"),
    SURPRISE_ME("Surprise Me"),
}

/** One upcoming track Queue Intelligence suggests, with the concrete reasons it was picked. */
data class QueueSuggestion(val track: Track, val why: WhyRecommended)

/**
 * Queue Intelligence (Phase 4A, spec #2): the 6 queue actions. Each re-ranks [pool] around the
 * current track's [SongDna] — "Build Energy"/"Cool Down" nudge the target energy, "More Vocals"/
 * "More Instrumental" nudge vocal intensity, "Keep This Vibe" stays close to the current track,
 * "Surprise Me" deliberately skips the DNA scoring. Returns a brand-new upcoming queue; nothing is
 * spliced into a live player queue, so there's no audio-engine or playback-pipeline change needed —
 * committing a suggestion plays it the same way every other "play this list" action in the app does.
 */
class QueueIntelligence(
    private val genres: GenreDetector = GenreDetector(),
    private val dna: SongDnaAnalyzer = SongDnaAnalyzer(genres),
    private val engine: RecommendationEngine2 = RecommendationEngine2(dna),
    private val explain: RecommendationExplanation = RecommendationExplanation(genres, dna),
) {
    fun apply(action: QueueAction, current: Track?, pool: List<Track>, exclude: Set<String> = emptySet(), size: Int = 10): List<QueueSuggestion> {
        val candidates = pool.filter { it.id !in exclude && it.id != current?.id }
        if (candidates.isEmpty()) return emptyList()

        val tracks: List<Track> = when (action) {
            QueueAction.SURPRISE_ME -> candidates.shuffled().take(size)
            QueueAction.KEEP_VIBE -> current?.let { engine.similarTo(it, candidates, limit = size).map { r -> r.track } }
                ?: fromProfile(candidates, size) { it }
            QueueAction.BUILD_ENERGY -> fromSeedDna(current, candidates, size) { it.copy(energy = (it.energy + 0.3f).coerceAtMost(1f)) }
            QueueAction.COOL_DOWN -> fromSeedDna(current, candidates, size) { it.copy(energy = (it.energy - 0.3f).coerceAtLeast(0f)) }
            QueueAction.MORE_VOCALS -> fromSeedDna(current, candidates, size) { it.copy(vocalIntensity = (it.vocalIntensity + 0.35f).coerceAtMost(1f), instrumentalness = (it.instrumentalness - 0.2f).coerceAtLeast(0f)) }
            QueueAction.MORE_INSTRUMENTAL -> fromSeedDna(current, candidates, size) { it.copy(instrumentalness = (it.instrumentalness + 0.35f).coerceAtMost(1f), vocalIntensity = (it.vocalIntensity - 0.2f).coerceAtLeast(0f)) }
        }

        return tracks.map { t -> QueueSuggestion(t, if (current != null) explain.explain(current, t) else WhyRecommended(listOf("Matches your taste"))) }
    }

    private fun fromSeedDna(current: Track?, pool: List<Track>, size: Int, adjust: (SongDna) -> SongDna): List<Track> {
        val seedDna = current?.let(dna::analyze) ?: return fromProfile(pool, size) { it }
        val target = adjust(seedDna)
        return engine.forProfile(TasteProfile(target, 1), pool, limit = size).map { it.track }
    }

    private fun fromProfile(pool: List<Track>, size: Int, adjust: (SongDna) -> SongDna): List<Track> {
        val profile = engine.profileFrom(pool) ?: return pool.take(size)
        return engine.forProfile(TasteProfile(adjust(profile.dna), profile.sampleSize), pool, limit = size).map { it.track }
    }
}
