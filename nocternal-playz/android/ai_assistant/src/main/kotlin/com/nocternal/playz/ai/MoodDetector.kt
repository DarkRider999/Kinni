package com.nocternal.playz.ai

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.MusicalKey
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector

data class MoodEstimate(val mood: Mood, val confidence: Float, val reason: String)

/**
 * AI mood detection (spec §11.4). Combines audio features from on-device analysis (tempo, energy,
 * major/minor key, brightness) with genre and time of day. A transparent scoring model rather than a black
 * box, so the assistant can explain its choice; the plugin API can replace it with a trained classifier.
 */
class MoodDetector(private val genres: GenreDetector = GenreDetector()) {
    fun detect(track: Track, hourOfDay: Int? = null): MoodEstimate? {
        val scores = HashMap<Mood, Float>()
        val why = mutableListOf<String>()
        fun add(m: Mood, v: Float) { scores[m] = (scores[m] ?: 0f) + v }

        genres.detect(track)?.let { add(it.genre.defaultMood, 1.2f * it.confidence); why += it.genre.displayName }

        val bpm = track.bpm; val energy = track.energy
        val minor = track.camelotKey?.let(MusicalKey::fromCamelot)?.minor
        if (energy != null) {
            when {
                energy > 0.75f -> { add(Mood.ENERGETIC, 0.8f); add(Mood.PARTY, 0.5f); why += "high energy" }
                energy < 0.3f -> { add(Mood.CALM, 0.6f); add(Mood.SLEEPY, 0.4f); why += "low energy" }
                else -> add(Mood.FOCUSED, 0.2f)
            }
        }
        if (bpm != null) {
            when {
                bpm >= 124 -> { add(Mood.PARTY, 0.4f); add(Mood.ENERGETIC, 0.4f) }
                bpm < 80 -> { add(Mood.CALM, 0.4f); add(Mood.ROMANTIC, 0.15f) }
            }
        }
        if (minor != null) {
            if (minor && (energy ?: 0.5f) < 0.5f) { add(Mood.MELANCHOLIC, 0.5f); why += "minor key" }
            if (!minor && (energy ?: 0.5f) >= 0.5f) { add(Mood.HAPPY, 0.4f); why += "major key" }
        }
        if (hourOfDay != null && scores.isNotEmpty()) {
            if (hourOfDay >= 23 || hourOfDay < 5) add(Mood.SLEEPY, 0.2f)
            if (hourOfDay in 5..8) add(Mood.SPIRITUAL, 0.1f)
        }
        if (scores.isEmpty()) return null
        val sorted = scores.entries.sortedByDescending { it.value }
        val best = sorted[0]
        val total = scores.values.sum()
        val margin = (best.value - (sorted.getOrNull(1)?.value ?: 0f)) / total
        val confidence = (0.35f + margin + 0.1f * why.size).coerceIn(0f, 0.95f)
        return MoodEstimate(best.key, confidence, why.joinToString(", "))
    }

    /** Mood of a listening session: the most common confident mood of the last few tracks. */
    fun sessionMood(recent: List<Track>, hourOfDay: Int? = null): MoodEstimate? {
        val estimates = recent.takeLast(5).mapNotNull { detect(it, hourOfDay) }.filter { it.confidence >= 0.5f }
        if (estimates.isEmpty()) return null
        val (mood, group) = estimates.groupBy { it.mood }.maxBy { it.value.size }
        return MoodEstimate(mood, group.map { it.confidence }.average().toFloat() * group.size / estimates.size, "last ${estimates.size} songs")
    }
}
