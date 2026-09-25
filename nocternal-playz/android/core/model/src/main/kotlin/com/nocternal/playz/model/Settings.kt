package com.nocternal.playz.model

import kotlinx.serialization.Serializable

/** User settings that are backed up and restored. Platform stores map these 1:1. */
@Serializable
data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.NEON,
    /** When set, overrides the preset accent. */
    val customAccent: NeonColor? = null,
    val autoThemeByGenre: Boolean = true,
    val autoThemeByMood: Boolean = true,
    val autoThemeByTime: Boolean = false,
    /** When on, a theme switch also applies the genre EQ preset. */
    val eqFollowsTheme: Boolean = true,
    val autoFaderEnabled: Boolean = true,
    /** 0 = gapless (no fade). Auto-fader default is 3 s out + 3 s in. */
    val crossfadeSeconds: Float = 3f,
    val gapless: Boolean = true,
    val normalization: Boolean = true,
    val speakerSafeMode: Boolean = true,
    val privateMode: Boolean = false,
    val smartOfflineMode: Boolean = true,
    val autoDownloadOnWifiOnly: Boolean = true,
    val autoDownloadLyrics: Boolean = true,
    val autoDownloadArtwork: Boolean = true,
    val lightBar: LightBarSettings = LightBarSettings(),
    val edgeLighting: EdgeLightingSettings = EdgeLightingSettings(),
    val enabledPlugins: Set<String> = emptySet(),
    val assistantApiKey: String? = null,
)

@Serializable
data class LightBarSettings(
    val enabled: Boolean = true,
    val color: NeonColor? = null,
    val glowIntensity: Float = 0.8f,
    val animation: LightingAnimation = LightingAnimation.PULSE_WAVE_SPECTRUM,
)

@Serializable
data class EdgeLightingSettings(
    val enabled: Boolean = true,
    val mode: EdgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE,
    val thickness: Float = 4f,
    val brightness: Float = 0.8f,
)
