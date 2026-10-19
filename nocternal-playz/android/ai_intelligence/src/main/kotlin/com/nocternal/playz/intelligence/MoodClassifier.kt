package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector

data class MoodClassification(val mood: Mood, val confidence: Float, val reason: String)

/**
 * Classifies a track into one of the 8 "feel" moods (Happy, Energetic, Emotional/Melancholic,
 * Relaxed/Calm, Aggressive, Romantic, Dark, Uplifting) plus the app's existing situational moods
 * (Focused, Spiritual, Sleepy, Party), from [SongDna] plus the detected genre's own default mood as a
 * prior — a genre tag like "devotional" or "lofi" carries more signal than audio features alone can.
 * A sibling to the assistant's `MoodDetector`, specialised for Song DNA rather than theme switching.
 */
class MoodClassifier(
    private val genres: GenreDetector = GenreDetector(),
    private val dna: SongDnaAnalyzer = SongDnaAnalyzer(genres),
) {
    fun classify(track: Track): MoodClassification {
        val d = dna.analyze(track)
        val genreMood = genres.detect(track)?.genre?.defaultMood
        val scores = HashMap<Mood, Float>()
        val why = mutableListOf<String>()
        fun add(m: Mood, v: Float) { scores[m] = (scores[m] ?: 0f) + v }

        genreMood?.let { add(it, 1.0f) }

        when {
            d.energy > 0.75f && d.emotion > 0.55f -> { add(Mood.AGGRESSIVE, 0.9f); why += "high energy, heavy tone" }
            d.energy > 0.7f && d.emotion <= 0.35f -> { add(Mood.UPLIFTING, 0.8f); why += "high energy, bright tone" }
            d.energy > 0.55f -> { add(Mood.ENERGETIC, 0.6f); why += "high energy" }
            d.energy < 0.3f && d.emotion > 0.6f -> { add(Mood.DARK, 0.6f); why += "low energy, heavy tone" }
            d.energy < 0.35f -> { add(Mood.CALM, 0.6f); why += "low energy" }
        }
        if (d.emotion > 0.65f) { add(Mood.MELANCHOLIC, 0.5f); why += "minor-leaning" }
        if (d.emotion <= 0.3f && d.energy in 0.35f..0.7f) { add(Mood.HAPPY, 0.5f); why += "major-leaning" }
        if (d.vocalIntensity > 0.6f && d.energy in 0.25f..0.6f) add(Mood.ROMANTIC, 0.3f)

        if (scores.isEmpty()) add(Mood.CALM, 0.3f)
        val sorted = scores.entries.sortedByDescending { it.value }
        val best = sorted.first()
        val total = scores.values.sum()
        val margin = if (total > 0f) (best.value - (sorted.getOrNull(1)?.value ?: 0f)) / total else 0f
        val reason = (why + listOfNotNull(genreMood?.let { "genre leans ${it.label.lowercase()}" })).distinct().joinToString(", ").ifBlank { "no strong signal" }
        return MoodClassification(best.key, (0.4f + margin).coerceIn(0f, 0.95f), reason)
    }
}
