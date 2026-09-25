package com.nocternal.playz.ai

import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector
import com.nocternal.playz.theme.ThemePresets
import kotlin.random.Random

enum class ArtShape { RING, SUN, GRID_HORIZON, MOUNTAINS, WAVE, TRIANGLE, ORB, STARS, MANDALA, WAVEFORM }

data class ArtLayer(val shape: ArtShape, val x: Float, val y: Float, val size: Float, val rotation: Float, val colorIndex: Int, val glow: Float)

/**
 * Neon album art for tracks without artwork (spec §4 "smart album art generator"). The spec is deterministic
 * per track (same song → same art) and rendered natively by Compose/SwiftUI canvases, so it works offline.
 * [prompt] is a ready text prompt for an optional image-generation plugin.
 */
data class NeonArtSpec(
    val seed: Long,
    val background: NeonColor,
    val palette: List<NeonColor>,
    val layers: List<ArtLayer>,
    val title: String,
    val subtitle: String,
    val prompt: String,
)

class AlbumArtGenerator(private val genres: GenreDetector = GenreDetector()) {
    fun generate(track: Track): NeonArtSpec {
        val seed = (track.artist + "|" + track.title + "|" + track.album).hashCode().toLong()
        val rnd = Random(seed)
        val genre = genres.detect(track)?.genre
        val preset = genre?.let { ThemePresets.byId(it.themePresetId) } ?: ThemePresets.NOCTERNAL_DEFAULT
        val palette = listOf(preset.accent, preset.secondaryAccent, preset.accent.lerp(preset.secondaryAccent, 0.5f), NeonColor.hex("#FFFFFF"))
        val motif = when (genre?.id) {
            "devotional" -> listOf(ArtShape.MANDALA, ArtShape.SUN, ArtShape.RING)
            "meditation", "ambient" -> listOf(ArtShape.ORB, ArtShape.RING, ArtShape.STARS)
            "sleep" -> listOf(ArtShape.ORB, ArtShape.STARS, ArtShape.MOUNTAINS)
            "night_drive" -> listOf(ArtShape.SUN, ArtShape.GRID_HORIZON, ArtShape.MOUNTAINS)
            "edm", "techno", "party_mix", "workout" -> listOf(ArtShape.TRIANGLE, ArtShape.WAVEFORM, ArtShape.GRID_HORIZON)
            "trance" -> listOf(ArtShape.RING, ArtShape.TRIANGLE, ArtShape.STARS)
            "lofi", "chillout" -> listOf(ArtShape.WAVE, ArtShape.SUN, ArtShape.STARS)
            "hindi_classics", "romantic" -> listOf(ArtShape.RING, ArtShape.MANDALA, ArtShape.WAVE)
            else -> ArtShape.entries.shuffled(rnd).take(3)
        }
        val layers = motif.mapIndexed { i, s ->
            ArtLayer(s, 0.5f + (rnd.nextFloat() - 0.5f) * 0.3f * i, 0.45f + (rnd.nextFloat() - 0.5f) * 0.3f, 0.3f + rnd.nextFloat() * 0.4f / (i + 1), rnd.nextFloat() * 360f, i % palette.size, 0.6f + rnd.nextFloat() * 0.4f)
        }
        val prompt = "Neon synthwave album cover for \"${track.title}\" by ${track.artist}: ${motif.joinToString { it.name.lowercase().replace('_', ' ') }}, " +
            "${preset.name} palette (${palette.take(2).joinToString { it.toHex() }}), glowing lines on ${if (preset.backgroundStyle.name.contains("AMOLED")) "pure black" else "deep space"} background, no text"
        return NeonArtSpec(seed, NeonColor.hex("#05050A"), palette, layers, track.title, track.artist, prompt)
    }
}
