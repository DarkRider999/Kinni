package com.nocternal.playz.theme

import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track

/** Result of genre detection with a confidence in 0..1 and a short reason for the UI/AI explanations. */
data class GenreMatch(val genre: GenreDefinition, val confidence: Float, val reason: String)

/**
 * Detects a built-in genre for a track, strongest evidence first:
 *  1. The genre tag (e.g. "Bhajan", "Psytrance").
 *  2. Folder, title, album and artist keywords (e.g. "Music/Sleep/rain_01.mp3").
 *  3. Podcast flag.
 *  4. Tempo and energy (e.g. 138 BPM with high energy → Trance/EDM range).
 * The alias that appears first in the text wins ("Lo-Fi Hip Hop" is Lo-Fi, not Workout); on a tie the
 * longer alias wins ("hard techno" over "techno").
 */
class GenreDetector(private val genres: List<GenreDefinition> = GenreCatalog.all) {

    private val aliasIndex: List<Pair<String, GenreDefinition>> =
        genres.flatMap { g -> g.aliases.map { it to g } }

    fun detect(track: Track): GenreMatch? {
        track.genreTag?.lowercase()?.let { tag ->
            matchAlias(tag)?.let { return GenreMatch(it.second, 0.95f, "genre tag “${track.genreTag}” matches “${it.first}”") }
        }
        if (track.isPodcast) return GenreMatch(GenreCatalog.PODCAST_MODE, 0.9f, "podcast episode")

        val text = listOf(track.folder, track.title, track.album, track.artist).joinToString(" | ").lowercase()
        matchAlias(text)?.let { return GenreMatch(it.second, 0.75f, "keyword “${it.first}” in title/folder/artist") }

        val bpm = track.bpm ?: return null
        val energy = track.energy ?: 0.5f
        val byTempo = when {
            bpm >= 165 && energy > 0.6f -> GenreCatalog.WORKOUT
            bpm in 136f..150f && energy > 0.6f -> GenreCatalog.TRANCE
            bpm in 122f..136f && energy > 0.7f -> GenreCatalog.EDM
            bpm in 118f..135f && energy > 0.55f -> GenreCatalog.PARTY_MIX
            bpm < 70f && energy < 0.3f -> GenreCatalog.SLEEP
            bpm < 90f && energy < 0.45f -> GenreCatalog.CHILLOUT
            else -> null
        } ?: return null
        return GenreMatch(byTempo, 0.45f, "tempo ${bpm.toInt()} BPM, energy ${(energy * 100).toInt()}%")
    }

    /** Fallback used when only a mood is known (AI mood detection). */
    fun forMood(mood: Mood, hour: Int? = null): GenreDefinition = when (mood) {
        Mood.CALM -> if (hour != null && hour >= 21) GenreCatalog.AMBIENT else GenreCatalog.CHILLOUT
        Mood.ENERGETIC -> GenreCatalog.EDM
        Mood.HAPPY -> GenreCatalog.MORNING_VIBES
        Mood.MELANCHOLIC -> GenreCatalog.LOFI
        Mood.ROMANTIC -> GenreCatalog.ROMANTIC
        Mood.FOCUSED -> GenreCatalog.FOCUS
        Mood.SPIRITUAL -> GenreCatalog.DEVOTIONAL
        Mood.SLEEPY -> GenreCatalog.SLEEP
        Mood.PARTY -> GenreCatalog.PARTY_MIX
    }

    private fun matchAlias(text: String): Pair<String, GenreDefinition>? =
        aliasIndex
            .mapNotNull { entry -> wordIndex(text, entry.first).takeIf { it >= 0 }?.let { it to entry } }
            .minWithOrNull(compareBy<Pair<Int, Pair<String, GenreDefinition>>> { it.first }.thenByDescending { it.second.first.length })
            ?.second

    /** Index of a whole-word match (so "rain" does not match inside "trance" or "chill" inside "chillhop"), or -1. */
    private fun wordIndex(text: String, alias: String): Int {
        var from = 0
        while (true) {
            val i = text.indexOf(alias, from)
            if (i < 0) return -1
            val before = if (i == 0) ' ' else text[i - 1]
            val after = if (i + alias.length >= text.length) ' ' else text[i + alias.length]
            if (!before.isLetterOrDigit() && !after.isLetter()) return i
            from = i + 1
        }
    }
}
