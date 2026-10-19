package com.nocternal.playz.intelligence

import com.nocternal.playz.model.MusicalKey
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector

/** One reason a track was suggested, in the order the UI should show them. */
data class WhyRecommended(val reasons: List<String>) {
    val headline: String get() = reasons.firstOrNull() ?: "Picked for you"
}

/**
 * "Because You Like" (spec: AI Discovery Improvements / Recommendation Explanations): turns a
 * seed/candidate pair into the concrete, checkable reasons a listener would actually recognise —
 * BPM, key, mood, artist and overall Song DNA closeness — rather than a single vague line.
 */
class RecommendationExplanation(
    private val genres: GenreDetector = GenreDetector(),
    private val dna: SongDnaAnalyzer = SongDnaAnalyzer(genres),
    private val moods: MoodClassifier = MoodClassifier(genres, dna),
    private val engine: RecommendationEngine2 = RecommendationEngine2(dna),
) {
    fun explain(seed: Track, candidate: Track): WhyRecommended {
        val reasons = mutableListOf<String>()

        val sb = seed.bpm; val cb = candidate.bpm
        if (sb != null && cb != null && kotlin.math.abs(sb - cb) <= 4f) reasons += "Similar BPM (${cb.toInt()} vs ${sb.toInt()})"

        val sk = seed.camelotKey?.let(MusicalKey::fromCamelot)
        val ck = candidate.camelotKey?.let(MusicalKey::fromCamelot)
        if (sk != null && ck != null) {
            val rel = com.nocternal.playz.automix.Harmonic.relation(sk, ck)
            if (rel.score >= 0.85f) reasons += "Compatible key (${rel.label})"
        }

        val seedMood = moods.classify(seed).mood
        val candidateMood = moods.classify(candidate).mood
        if (seedMood == candidateMood) reasons += "Same mood (${seedMood.label.lowercase()})"

        if (seed.artist.equals(candidate.artist, ignoreCase = true) && seed.artist.isNotBlank() && !seed.artist.equals("Unknown artist", ignoreCase = true)) reasons += "Same artist"

        val distance = engine.distance(dna.analyze(seed), dna.analyze(candidate))
        if (distance < 0.25f) reasons += "Very similar overall sound"
        else if (distance < 0.45f) reasons += "Similar overall sound"

        if (reasons.isEmpty()) reasons += "Matches your taste"
        return WhyRecommended(reasons)
    }
}
