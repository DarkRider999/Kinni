package com.nocternal.playz.theme

import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track

/** Result of genre detection with a confidence in 0..1 and a short reason for the UI/AI explanations. */
data class GenreMatch(val genre: GenreDefinition, val confidence: Float, val reason: String)

/**
 * Detects a built-in genre for a track, strongest evidence first:
 *  1. The genre tag, via the genre aliases ("Bhajan", "Psytrance").
 *  2. The genre tag, via common music-store tag families ("Bollywood", "Pop", "Rock", "Hip-Hop/Rap", "Jazz").
 *  3. The folder name (all aliases: "Music/Sleep" is intentional).
 *  4. Title, album and artist, using only specific aliases — ordinary words like "rain" or "love" in a title
 *     don't decide the genre ("Purple Rain" is not a sleep track).
 *  5. Podcast flag.
 *  6. Tempo and energy from on-device analysis, so every analysed song lands in a genre playlist.
 * Tags and aliases are normalised ("Hip-Hop/Rap" → "hip hop rap", "Lo-Fi" → "lo fi"). The alias that appears
 * first wins; on a tie the longer alias wins ("hard techno" over "techno").
 */
class GenreDetector(private val genres: List<GenreDefinition> = GenreCatalog.all) {

    private val aliasIndex: List<Pair<String, GenreDefinition>> =
        genres.flatMap { g -> g.aliases.map { normalize(it) to g } }.distinctBy { it.first to it.second.id }
    private val strongAliases = aliasIndex.filter { it.first !in GENERIC_WORDS }

    fun detect(track: Track): GenreMatch? {
        val tag = track.genreTag?.let(::normalize)?.takeIf { it.isNotBlank() && it !in MEANINGLESS_TAGS }
        if (tag != null) {
            match(tag, aliasIndex)?.let { return GenreMatch(it.second, 0.95f, "genre tag “${track.genreTag}”") }
            tagFamily(tag, track)?.let { return GenreMatch(it, 0.8f, "genre tag “${track.genreTag}”") }
        }
        if (track.isPodcast) return GenreMatch(GenreCatalog.PODCAST_MODE, 0.9f, "podcast episode")

        match(normalize(track.folder), aliasIndex)?.let { return GenreMatch(it.second, 0.8f, "folder “${track.folder}”") }
        val text = normalize(listOf(track.title, track.album, track.artist).joinToString(" | "))
        match(text, strongAliases)?.let { return GenreMatch(it.second, 0.7f, "“${it.first}” in title/artist") }

        return byTempo(track)
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

    /** Maps broad store/ID3 genres onto the built-in genres. */
    private fun tagFamily(tag: String, t: Track): GenreDefinition? {
        val energy = t.energy ?: 0.5f
        val bpm = t.bpm ?: 0f
        fun has(vararg w: String) = w.any { wordIndex(tag, it) >= 0 }
        return when {
            has("bollywood", "hindi", "filmi", "indian", "desi", "tamil", "telugu", "kannada", "malayalam", "marathi", "bengali",
                "bhojpuri", "gujarati", "tollywood", "kollywood", "hindustani film") -> when {
                (t.year ?: 3000) < 2000 -> GenreCatalog.HINDI_CLASSICS
                energy > 0.65f || bpm >= 118f -> GenreCatalog.PARTY_MIX
                else -> GenreCatalog.ROMANTIC
            }
            has("punjabi", "bhangra", "haryanvi") -> GenreCatalog.PARTY_MIX
            has("rock", "metal", "punk", "grunge", "alternative", "alt rock", "hardcore") -> GenreCatalog.WORKOUT
            has("electronic", "electronica", "electro", "dance", "club", "idm") -> if (energy < 0.4f) GenreCatalog.CHILLOUT else GenreCatalog.EDM
            has("jazz", "blues", "bossa", "swing", "reggae", "easy listening") -> GenreCatalog.CHILLOUT
            has("classical", "ost", "film score", "orchestra", "opera", "baroque") -> GenreCatalog.INSTRUMENTAL
            has("country", "singer songwriter", "americana", "bluegrass") -> GenreCatalog.MORNING_VIBES
            has("k pop", "kpop", "j pop", "latin", "world", "afrobeat", "afrobeats") -> GenreCatalog.PARTY_MIX
            has("pop", "indie", "top 40") -> if (energy > 0.6f || bpm >= 118f) GenreCatalog.PARTY_MIX else GenreCatalog.MORNING_VIBES
            has("new age", "relaxation", "nature") -> GenreCatalog.MEDITATION
            has("children", "kids", "nursery") -> GenreCatalog.MORNING_VIBES
            has("audiobook", "spoken", "comedy", "radio show") -> GenreCatalog.PODCAST_MODE
            else -> null
        }
    }

    /** Tempo/energy placement for analysed songs without useful tags. */
    private fun byTempo(t: Track): GenreMatch? {
        val bpm = t.bpm
        val energy = t.energy
        if (bpm == null && energy == null) return null
        val e = energy ?: 0.5f
        val b = bpm ?: 100f
        val g = when {
            b >= 165 && e > 0.6f -> GenreCatalog.WORKOUT
            b in 136f..150f && e > 0.6f -> GenreCatalog.TRANCE
            b in 122f..136f && e > 0.7f -> GenreCatalog.EDM
            b in 118f..135f && e > 0.55f -> GenreCatalog.PARTY_MIX
            b < 70f && e < 0.3f -> GenreCatalog.SLEEP
            b < 90f && e < 0.45f -> GenreCatalog.CHILLOUT
            e >= 0.7f -> if (b > 140f) GenreCatalog.WORKOUT else GenreCatalog.PARTY_MIX
            e < 0.3f -> GenreCatalog.AMBIENT
            b < 100f -> GenreCatalog.LOFI
            else -> GenreCatalog.MORNING_VIBES
        }
        return GenreMatch(g, 0.4f, "tempo ${b.toInt()} BPM, energy ${(e * 100).toInt()}%")
    }

    private fun match(text: String, index: List<Pair<String, GenreDefinition>>): Pair<String, GenreDefinition>? =
        index
            .mapNotNull { entry -> wordIndex(text, entry.first).takeIf { it >= 0 }?.let { it to entry } }
            .minWithOrNull(compareBy<Pair<Int, Pair<String, GenreDefinition>>> { it.first }.thenByDescending { it.second.first.length })
            ?.second

    /** Index of a whole-word match (so "rain" does not match inside "trance" or "chill" inside "chillhop"), or -1. */
    private fun wordIndex(text: String, alias: String): Int {
        if (alias.isEmpty()) return -1
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

    companion object {
        fun normalize(s: String): String = s.lowercase().replace(Regex("[-_/\\\\.,;:+]"), " ").replace(Regex("\\s+"), " ").trim()

        /** Everyday words that only count as genre evidence in a genre tag or folder name, never in a title. */
        val GENERIC_WORDS = setOf(
            "rain", "love", "chill", "dance", "party", "morning", "focus", "study", "sleep", "gym", "fitness", "running", "cardio",
            "motivation", "coding", "zen", "trap", "soul", "ballad", "romance", "romantic", "club", "feel good", "coffee", "sunrise",
            "acoustic", "folk", "guitar", "piano", "flute", "score", "episode", "news", "talk", "speech", "interview", "thunder",
            "house", "minimal", "acid", "industrial", "drone", "bedroom", "deep work", "concentration", "productivity", "evergreen",
            "disco", "slow jam", "healing", "yoga", "mindful", "lullaby", "ocean waves", "night sounds", "uplifting", "space music",
            "soundscape", "sitar", "retro bollywood", "golden era", "rap", "hip hop", "chillout", "chill out", "downtempo", "lounge",
        )
        val MEANINGLESS_TAGS = setOf("other", "unknown", "misc", "miscellaneous", "genre", "none", "general", "various", "music", "<unknown>")
    }
}
