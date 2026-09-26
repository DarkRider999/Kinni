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
    /** Overlap between songs. 0 = true gapless (no fade). 5 s default: long enough to feel continuous. */
    val crossfadeSeconds: Float = 5f,
    val gapless: Boolean = true,
    val normalization: Boolean = true,
    val speakerSafeMode: Boolean = true,
    val privateMode: Boolean = false,
    val smartOfflineMode: Boolean = true,
    /** Online features (lyrics, radio, YouTube Music, AI) may use Wi-Fi. */
    val useWifi: Boolean = true,
    /** Online features may use mobile data. On by default; uncheck to stay on Wi-Fi only. */
    val useMobileData: Boolean = true,
    /** Background auto-downloads wait for Wi-Fi. */
    val autoDownloadOnWifiOnly: Boolean = false,
    val autoDownloadLyrics: Boolean = true,
    val autoDownloadArtwork: Boolean = true,
    val lightBar: LightBarSettings = LightBarSettings(),
    val edgeLighting: EdgeLightingSettings = EdgeLightingSettings(),
    val enabledPlugins: Set<String> = emptySet(),
    val assistantApiKey: String? = null,
    /** Free Jamendo developer client ID (devportal.jamendo.com) for Creative Commons music search. */
    val jamendoClientId: String? = null,
)

@Serializable
data class LightBarSettings(
    val enabled: Boolean = true,
    val color: NeonColor? = null,
    val glowIntensity: Float = 0.8f,
    val animation: LightingAnimation = LightingAnimation.PULSE_WAVE_SPECTRUM,
    /** True once the user picks an animation; genre themes then stop changing it. */
    val customAnimation: Boolean = false,
)

@Serializable
data class EdgeLightingSettings(
    val enabled: Boolean = true,
    val mode: EdgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE,
    val thickness: Float = 4f,
    val brightness: Float = 0.8f,
    /** True once the user sets thickness/brightness; genre themes then keep the user's values. */
    val customStyle: Boolean = false,
    /** True once the user picks a mode; genre themes then keep it. */
    val customMode: Boolean = false,
)
