package com.nocternal.playz.model

import kotlinx.serialization.Serializable

/** Centre frequencies (Hz) of the 10-band graphic equalizer, shared by both platforms. */
val EQ_BAND_FREQUENCIES: List<Float> = listOf(31f, 62f, 125f, 250f, 500f, 1000f, 2000f, 4000f, 8000f, 16000f)

@Serializable
data class EqPreset(
    val id: String,
    val name: String,
    /** Ten gains in dB, one per [EQ_BAND_FREQUENCIES] entry, clamped to ±12 dB. */
    val bandGainsDb: List<Float>,
    val preampDb: Float = 0f,
    /** 0..1 */
    val bassBoost: Float = 0f,
    /** 0..1 3D surround / virtualizer strength. */
    val surround: Float = 0f,
    /** Loudness enhancer gain in dB (limited afterwards). */
    val loudnessDb: Float = 0f,
) {
    init {
        require(bandGainsDb.size == EQ_BAND_FREQUENCIES.size) { "EQ preset $id needs 10 bands" }
    }
}

/**
 * A neon theme preset. Every genre maps to one. Applying it sets the accent colour, glow,
 * edge lighting, light bar animation, EQ preset and background in one step.
 */
@Serializable
data class ThemePreset(
    val id: String,
    val name: String,
    val accent: NeonColor,
    val secondaryAccent: NeonColor,
    /** 0..1 */
    val glowIntensity: Float,
    val edgeLightingMode: EdgeLightingMode,
    /** Edge thickness in dp/pt. */
    val edgeThickness: Float = 4f,
    /** 0..1 */
    val edgeBrightness: Float = 0.8f,
    val lightBarAnimation: LightingAnimation,
    val eqPresetId: String,
    val backgroundStyle: BackgroundStyle,
    val themeMode: ThemeMode = ThemeMode.NEON,
)

/** A built-in, auto-curated genre. */
@Serializable
data class GenreDefinition(
    val id: String,
    val displayName: String,
    val emoji: String,
    val themePresetId: String,
    val eqPresetId: String,
    /** Lower-case substrings matched against genre tags, titles and folder names. */
    val aliases: List<String>,
    /** Suggestions shown by the AI assistant for this genre. */
    val aiSuggestions: List<String>,
    /** Tags used to find stations in the Radio Hub. */
    val radioTags: List<String>,
    val defaultMood: Mood,
    /** Typical tempo range, used by detection and smart playlists. */
    val bpmMin: Float = 0f,
    val bpmMax: Float = 999f,
)
