package com.nocternal.playz.ai

import com.nocternal.playz.fx.OutputRoute
import com.nocternal.playz.model.EqPreset
import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.PlaylistKind
import com.nocternal.playz.model.Track
import com.nocternal.playz.playlists.SmartPlaylistEngine
import com.nocternal.playz.theme.EqPresets
import com.nocternal.playz.theme.GenreCatalog
import com.nocternal.playz.theme.GenreDetector
import com.nocternal.playz.theme.TimeOfDayThemes

/** Playlist suggestions by genre, mood, BPM and time of day (spec §4). */
class RecommendationEngine(
    private val genres: GenreDetector = GenreDetector(),
    private val moods: MoodDetector = MoodDetector(genres),
) {
    data class Criteria(val genreId: String? = null, val mood: Mood? = null, val bpmMin: Float? = null, val bpmMax: Float? = null, val hourOfDay: Int? = null)

    fun suggest(ctx: AssistantContext, c: Criteria, size: Int = 40): Playlist {
        val genre = c.genreId?.let(GenreCatalog::byId) ?: if (c.mood == null && c.bpmMin == null) c.hourOfDay?.let(TimeOfDayThemes::genreForHour) else null
        val counts = SmartPlaylistEngine.playCounts(ctx.history)
        val maxCount = (counts.values.maxOrNull() ?: 1).toFloat()
        val scored = ctx.tracks.map { t ->
            var s = 0f
            val g = genres.detect(t)
            if (genre != null) s += if (g?.genre?.id == genre.id) 3f * g.confidence else -1f
            if (c.mood != null) { val m = moods.detect(t, c.hourOfDay); if (m?.mood == c.mood) s += 2f * m.confidence }
            if (c.bpmMin != null && c.bpmMax != null) {
                val bpm = t.bpm
                s += when {
                    bpm == null -> -0.5f
                    bpm in c.bpmMin..c.bpmMax -> 2f
                    bpm * 2 in c.bpmMin..c.bpmMax || bpm / 2 in c.bpmMin..c.bpmMax -> 1f
                    else -> -2f
                }
            }
            if (t.id in ctx.favorites) s += 0.6f
            s += 0.4f * (counts[t.id] ?: 0) / maxCount
            // Deterministic variety so the same request doesn't always return the same order.
            s += ((t.id.hashCode() xor (c.hashCode())) and 0xFF) / 2550f
            t to s
        }.filter { it.second > 0.5f }.sortedByDescending { it.second }.take(size).map { it.first }

        val name = listOfNotNull(genre?.displayName, c.mood?.label, c.bpmMin?.let { "${it.toInt()}–${c.bpmMax?.toInt()} BPM" }).joinToString(" · ").ifEmpty { "For you" }
        return Playlist(
            id = "ai_" + name.lowercase().replace(Regex("[^a-z0-9]+"), "_"),
            name = "AI · $name", trackIds = scored.map { it.id }, kind = PlaylistKind.AI, genreId = genre?.id,
            description = genre?.aiSuggestions?.firstOrNull() ?: "Picked by Nocternal AI",
        )
    }

    /** Headline suggestions for the Home screen and the assistant's chips. */
    fun ideasFor(hourOfDay: Int, nowPlaying: Track?): List<String> {
        val g: GenreDefinition = nowPlaying?.let { genres.detect(it)?.genre } ?: TimeOfDayThemes.genreForHour(hourOfDay)
        return g.aiSuggestions.take(3)
    }
}

/** EQ recommendations: genre preset adjusted for the output device (spec §4). */
object EqAdvisor {
    data class Advice(val preset: EqPreset, val reason: String)

    fun recommend(track: Track?, route: OutputRoute, genres: GenreDetector = GenreDetector()): Advice {
        val genre = track?.let { genres.detect(it)?.genre }
        val base = genre?.let { EqPresets.byId(it.eqPresetId) } ?: EqPresets.FLAT
        return when (route) {
            OutputRoute.SPEAKER -> {
                // Phone speakers can't reproduce sub-bass; move energy to 125–250 Hz and lift presence.
                val g = base.bandGainsDb.toMutableList()
                val sub = (g[0] + g[1]) / 2
                g[0] = minOf(g[0], -2f); g[1] = minOf(g[1], 0f)
                g[2] = (g[2] + sub * 0.5f).coerceIn(-12f, 6f)
                g[6] = (g[6] + 1.5f).coerceAtMost(12f)
                Advice(base.copy(id = base.id + "_speaker", name = base.name + " (speaker)", bandGainsDb = g, bassBoost = 0f),
                    "${genre?.displayName ?: "This track"} on the phone speaker: sub-bass moved up to where the speaker can play it")
            }
            OutputRoute.BLUETOOTH -> Advice(base, "${base.name} for ${genre?.displayName ?: "this track"}; Bluetooth codecs keep the lows, so no speaker correction")
            else -> Advice(base, "${base.name} suits ${genre?.displayName ?: "this track"} on headphones")
        }
    }
}
