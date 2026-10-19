package com.nocternal.playz.intelligence

import com.nocternal.playz.model.MusicalKey
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector

/**
 * A track's audio "DNA": seven 0..1 traits used to power mood classification, recommendations and
 * Discovery Radar. Every trait traces back to a concrete, already-known signal (BPM, on-device energy,
 * musical key, genre, title/tag words) — a transparent scoring model, not a black box, the same spirit
 * as [com.nocternal.playz.theme.GenreDetector] and the assistant's `MoodDetector`.
 */
data class SongDna(
    val energy: Float,
    val danceability: Float,
    /** How emotionally heavy the track leans — low key-signature/energy combinations score higher. */
    val emotion: Float,
    val instrumentalness: Float,
    val vocalIntensity: Float,
    val complexity: Float,
    val groove: Float,
)

/** Derives [SongDna] from data already on [Track] — no audio decode of its own, no network. */
class SongDnaAnalyzer(private val genres: GenreDetector = GenreDetector()) {
    private val instrumentalWords = listOf("instrumental", "karaoke", "backing track", "no vocals", "orchestral", "theme song", "score")
    private val vocalWords = listOf("acapella", "a cappella", "unplugged", "vocal mix")

    fun analyze(track: Track): SongDna {
        val energy = (track.energy ?: 0.5f).coerceIn(0f, 1f)
        val bpm = track.bpm
        val genre = genres.detect(track)?.genre

        val bpmFit = bpm?.let { b ->
            val mid = ((genre?.bpmMin ?: 90f) + (genre?.bpmMax ?: 140f)) / 2f
            (1f - (kotlin.math.abs(b - mid) / 80f)).coerceIn(0f, 1f)
        } ?: 0.4f
        val danceability = (0.5f * energy + 0.5f * bpmFit).coerceIn(0f, 1f)

        val minor = track.camelotKey?.let(MusicalKey::fromCamelot)?.minor
        val emotion = when {
            minor == true && energy < 0.5f -> 0.8f
            minor == true -> 0.6f
            minor == false && energy >= 0.6f -> 0.3f
            else -> 0.5f
        }

        val text = listOf(track.title, track.album, track.artist, track.genreTag.orEmpty()).joinToString(" ").lowercase()
        val saysInstrumental = instrumentalWords.any { it in text }
        val saysVocal = vocalWords.any { it in text }
        val instrumentalness = when {
            track.isPodcast -> 0.05f
            saysInstrumental -> 0.9f
            saysVocal -> 0.15f
            else -> 0.45f
        }
        val vocalIntensity = when {
            track.isPodcast -> 0.95f
            saysInstrumental -> 0.05f
            else -> (0.4f + 0.3f * energy).coerceIn(0f, 1f)
        }

        val bpmSpread = bpm?.let { (it / 200f).coerceIn(0f, 1f) } ?: 0.4f
        val complexity = (0.5f * bpmSpread + 0.5f * (1f - kotlin.math.abs(energy - 0.5f) * 2f)).coerceIn(0f, 1f)

        val tempoGroove = if (bpm == null) 0.4f else when {
            bpm in 90f..128f -> 0.8f
            bpm in 70f..150f -> 0.55f
            else -> 0.3f
        }
        val groove = (0.6f * tempoGroove + 0.4f * danceability).coerceIn(0f, 1f)

        return SongDna(energy, danceability, emotion, instrumentalness, vocalIntensity, complexity, groove)
    }
}
