package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreCatalog
import com.nocternal.playz.theme.GenreDetector

/** What a free-text prompt asked for, in terms the engines below can filter/rank with. */
data class PlaylistPrompt(
    val raw: String,
    val mood: Mood? = null,
    val genreId: String? = null,
    val energyMin: Float? = null,
    val energyMax: Float? = null,
    /** Requested length in minutes, parsed from phrases like "90 minute" / "2 hour" — null when not stated. */
    val durationMinutes: Int? = null,
    val label: String,
)

/**
 * Turns a free-text prompt ("chill study music for a rainy evening", "high energy workout") into a
 * [PlaylistPrompt] by deterministic keyword matching — same philosophy as the rest of the on-device
 * "AI": transparent rules, no network call, no model. Mirrors `CommandParser` in `ai_assistant`
 * stylistically without depending on it (keeps `ai_intelligence` dependency-free of that module).
 */
object PromptPlaylistParser {
    private val moodWords = mapOf(
        "calm" to Mood.CALM, "relax" to Mood.CALM, "chill" to Mood.CALM, "peaceful" to Mood.CALM,
        "energetic" to Mood.ENERGETIC, "energy" to Mood.ENERGETIC, "upbeat" to Mood.UPLIFTING, "uplifting" to Mood.UPLIFTING,
        "happy" to Mood.HAPPY, "cheerful" to Mood.HAPPY, "sad" to Mood.MELANCHOLIC, "melancholic" to Mood.MELANCHOLIC, "moody" to Mood.MELANCHOLIC,
        "romantic" to Mood.ROMANTIC, "love" to Mood.ROMANTIC, "focus" to Mood.FOCUSED, "study" to Mood.FOCUSED, "work" to Mood.FOCUSED, "concentration" to Mood.FOCUSED,
        "spiritual" to Mood.SPIRITUAL, "devotional" to Mood.SPIRITUAL, "sleepy" to Mood.SLEEPY, "sleep" to Mood.SLEEPY, "bedtime" to Mood.SLEEPY,
        "party" to Mood.PARTY, "dance" to Mood.PARTY, "aggressive" to Mood.AGGRESSIVE, "angry" to Mood.AGGRESSIVE, "intense" to Mood.AGGRESSIVE,
        "dark" to Mood.DARK, "night" to Mood.DARK,
    )

    /** Weather/activity/time words bias energy range even when they don't name a mood directly. */
    private val energyWords = mapOf(
        "workout" to (0.65f to 1f), "gym" to (0.65f to 1f), "running" to (0.6f to 1f), "cardio" to (0.6f to 1f), "pump" to (0.7f to 1f),
        "rainy" to (0f to 0.45f), "rain" to (0f to 0.45f), "cozy" to (0f to 0.4f), "winter" to (0f to 0.45f),
        "sunny" to (0.5f to 1f), "summer" to (0.45f to 1f), "drive" to (0.4f to 0.85f), "driving" to (0.4f to 0.85f),
        "morning" to (0.3f to 0.75f), "late night" to (0f to 0.4f),
    )

    private val durationRegex = Regex("""(\d+(?:\.\d+)?)\s*(minute|min|hour|hr)s?\b""")

    fun parse(prompt: String): PlaylistPrompt {
        val text = prompt.lowercase()
        val mood = moodWords.entries.firstOrNull { (w, _) -> w in text }?.value
        val genre = GenreCatalog.all.firstOrNull { g -> g.aliases.any { it in text } }
        val energyHit = energyWords.entries.firstOrNull { (w, _) -> w in text }
        val duration = durationRegex.find(text)?.let { m ->
            val value = m.groupValues[1].toFloatOrNull() ?: return@let null
            val unit = m.groupValues[2]
            (if (unit.startsWith("hour") || unit == "hr") value * 60f else value).toInt().takeIf { it > 0 }
        }
        return PlaylistPrompt(
            raw = prompt, mood = mood, genreId = genre?.id,
            energyMin = energyHit?.value?.first, energyMax = energyHit?.value?.second,
            durationMinutes = duration,
            label = prompt.trim().replaceFirstChar { it.uppercase() },
        )
    }
}

/** Builds a playlist from a [PlaylistPrompt] by scoring the library against its mood/genre/energy signals. */
class PromptPlaylistBuilder(
    private val genres: GenreDetector = GenreDetector(),
    private val moods: MoodClassifier = MoodClassifier(genres),
) {
    fun build(prompt: PlaylistPrompt, pool: List<Track>, limit: Int = 40): List<Track> {
        if (prompt.mood == null && prompt.genreId == null && prompt.energyMin == null) return emptyList()
        return pool.map { t ->
            var score = 0f
            if (prompt.genreId != null) { val g = genres.detect(t)?.genre; if (g?.id == prompt.genreId) score += 3f }
            if (prompt.mood != null && moods.classify(t).mood == prompt.mood) score += 2f
            if (prompt.energyMin != null && prompt.energyMax != null) {
                val e = t.energy
                score += if (e != null && e in prompt.energyMin..prompt.energyMax) 1.5f else -0.5f
            }
            t to score
        }.filter { it.second > 0f }.sortedByDescending { it.second }.take(limit).map { it.first }
    }
}
