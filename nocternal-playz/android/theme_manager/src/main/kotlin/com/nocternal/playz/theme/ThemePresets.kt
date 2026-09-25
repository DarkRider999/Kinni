package com.nocternal.playz.theme

import com.nocternal.playz.model.BackgroundStyle
import com.nocternal.playz.model.EdgeLightingMode
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.ThemeMode
import com.nocternal.playz.model.ThemePreset

/** Neon theme presets. The first ten are the genre presets from the product spec; the rest cover the other built-in genres. */
object ThemePresets {
    val SACRED_GOLD_AURA = ThemePreset(
        id = "sacred_gold_aura", name = "Sacred Gold Aura",
        accent = NeonColor.hex("#FFC940"), secondaryAccent = NeonColor.hex("#FF8A00"),
        glowIntensity = 0.75f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeThickness = 5f, edgeBrightness = 0.7f,
        lightBarAnimation = LightingAnimation.AURORA_RIBBON, eqPresetId = "vocal_clarity",
        backgroundStyle = BackgroundStyle.SACRED_MANDALA,
    )
    val EMERALD_TRANQUILITY = ThemePreset(
        id = "emerald_tranquility", name = "Emerald Tranquility",
        accent = NeonColor.hex("#00F5A0"), secondaryAccent = NeonColor.hex("#00B37A"),
        glowIntensity = 0.55f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeThickness = 4f, edgeBrightness = 0.55f,
        lightBarAnimation = LightingAnimation.INFINITY_LOOP, eqPresetId = "airy_highs",
        backgroundStyle = BackgroundStyle.AURORA_HAZE,
    )
    val MOONLIT_CYAN_DRIFT = ThemePreset(
        id = "moonlit_cyan_drift", name = "Moonlit Cyan Drift",
        accent = NeonColor.hex("#7FE7FF"), secondaryAccent = NeonColor.hex("#3A6EA5"),
        glowIntensity = 0.2f, edgeLightingMode = EdgeLightingMode.STATIC, edgeThickness = 2f, edgeBrightness = 0.25f,
        lightBarAnimation = LightingAnimation.AURORA_RIBBON, eqPresetId = "balanced_lows",
        backgroundStyle = BackgroundStyle.AMOLED_BLACK, themeMode = ThemeMode.AMOLED,
    )
    val ROYAL_PURPLE_GOLD = ThemePreset(
        id = "royal_purple_gold", name = "Royal Purple Gold",
        accent = NeonColor.hex("#B14CFF"), secondaryAccent = NeonColor.hex("#FFC940"),
        glowIntensity = 0.7f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeThickness = 5f, edgeBrightness = 0.75f,
        lightBarAnimation = LightingAnimation.PRISM_CYCLE, eqPresetId = "warm_mids",
        backgroundStyle = BackgroundStyle.NEBULA,
    )
    val ELECTRIC_BLUE_PULSE = ThemePreset(
        id = "electric_blue_pulse", name = "Electric Blue Pulse",
        accent = NeonColor.hex("#00A3FF"), secondaryAccent = NeonColor.hex("#00FFF0"),
        glowIntensity = 1f, edgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE, edgeThickness = 6f, edgeBrightness = 1f,
        lightBarAnimation = LightingAnimation.PULSE_WAVE_SPECTRUM, eqPresetId = "edm_punch",
        backgroundStyle = BackgroundStyle.GRID_HORIZON,
    )
    val VIOLET_HYPERSPACE = ThemePreset(
        id = "violet_hyperspace", name = "Violet Hyperspace",
        accent = NeonColor.hex("#8F00FF"), secondaryAccent = NeonColor.hex("#FF00E5"),
        glowIntensity = 0.9f, edgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE, edgeThickness = 5f, edgeBrightness = 0.9f,
        lightBarAnimation = LightingAnimation.VORTEX_SPIRAL, eqPresetId = "trance_wide",
        backgroundStyle = BackgroundStyle.STARFIELD,
    )
    val CYBER_RED_PULSE = ThemePreset(
        id = "cyber_red_pulse", name = "Cyber Red Pulse",
        accent = NeonColor.hex("#FF1744"), secondaryAccent = NeonColor.hex("#FF6D00"),
        glowIntensity = 1f, edgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE, edgeThickness = 6f, edgeBrightness = 1f,
        lightBarAnimation = LightingAnimation.BASS_SHOCK_FLASH, eqPresetId = "techno_sub",
        backgroundStyle = BackgroundStyle.GRID_HORIZON, themeMode = ThemeMode.AMOLED,
    )
    val BLUE_PURPLE_GALAXY = ThemePreset(
        id = "blue_purple_galaxy", name = "Blue-Purple Galaxy",
        accent = NeonColor.hex("#4D7CFF"), secondaryAccent = NeonColor.hex("#A64DFF"),
        glowIntensity = 0.8f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeThickness = 5f, edgeBrightness = 0.8f,
        lightBarAnimation = LightingAnimation.HYPERBEAM_EDGE_FLOW, eqPresetId = "night_drive",
        backgroundStyle = BackgroundStyle.NEBULA,
    )
    val SOFT_PINK_GLOW = ThemePreset(
        id = "soft_pink_glow", name = "Soft Pink Glow",
        accent = NeonColor.hex("#FF8AD8"), secondaryAccent = NeonColor.hex("#B388FF"),
        glowIntensity = 0.45f, edgeLightingMode = EdgeLightingMode.STATIC, edgeThickness = 3f, edgeBrightness = 0.5f,
        lightBarAnimation = LightingAnimation.EQ_BAR_MIRAGE, eqPresetId = "lofi_warm",
        backgroundStyle = BackgroundStyle.RAIN_GLASS,
    )
    val AQUA_DRIFT = ThemePreset(
        id = "aqua_drift", name = "Aqua Drift",
        accent = NeonColor.hex("#00E5D4"), secondaryAccent = NeonColor.hex("#00A3FF"),
        glowIntensity = 0.55f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeThickness = 4f, edgeBrightness = 0.6f,
        lightBarAnimation = LightingAnimation.STARFALL_REACTIVE, eqPresetId = "chill_smooth",
        backgroundStyle = BackgroundStyle.AURORA_HAZE,
    )

    // Presets for the remaining built-in genres.
    val DEEP_SPACE_INDIGO = ThemePreset(
        id = "deep_space_indigo", name = "Deep Space Indigo",
        accent = NeonColor.hex("#5C6BFF"), secondaryAccent = NeonColor.hex("#00E5FF"),
        glowIntensity = 0.5f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeBrightness = 0.5f,
        lightBarAnimation = LightingAnimation.CRYSTAL_GRID, eqPresetId = "ambient_space",
        backgroundStyle = BackgroundStyle.STARFIELD,
    )
    val VOLT_LIME_SURGE = ThemePreset(
        id = "volt_lime_surge", name = "Volt Lime Surge",
        accent = NeonColor.hex("#B6FF00"), secondaryAccent = NeonColor.hex("#00FF85"),
        glowIntensity = 1f, edgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE, edgeThickness = 6f, edgeBrightness = 1f,
        lightBarAnimation = LightingAnimation.BASS_SHOCK_FLASH, eqPresetId = "workout_bass",
        backgroundStyle = BackgroundStyle.GRID_HORIZON,
    )
    val LASER_FOCUS_TEAL = ThemePreset(
        id = "laser_focus_teal", name = "Laser Focus Teal",
        accent = NeonColor.hex("#1DE9B6"), secondaryAccent = NeonColor.hex("#80CBC4"),
        glowIntensity = 0.3f, edgeLightingMode = EdgeLightingMode.STATIC, edgeThickness = 2f, edgeBrightness = 0.35f,
        lightBarAnimation = LightingAnimation.EQ_BAR_MIRAGE, eqPresetId = "focus_neutral",
        backgroundStyle = BackgroundStyle.DEEP_SPACE, themeMode = ThemeMode.DARK,
    )
    val ROSE_NEON_HEART = ThemePreset(
        id = "rose_neon_heart", name = "Rose Neon Heart",
        accent = NeonColor.hex("#FF2E88"), secondaryAccent = NeonColor.hex("#FF8A80"),
        glowIntensity = 0.7f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeBrightness = 0.7f,
        lightBarAnimation = LightingAnimation.INFINITY_LOOP, eqPresetId = "romantic_warm",
        backgroundStyle = BackgroundStyle.SOFT_GLOW,
    )
    val RAINBOW_RAVE = ThemePreset(
        id = "rainbow_rave", name = "Rainbow Rave",
        accent = NeonColor.hex("#FF00E5"), secondaryAccent = NeonColor.hex("#00FFF0"),
        glowIntensity = 1f, edgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE, edgeThickness = 7f, edgeBrightness = 1f,
        lightBarAnimation = LightingAnimation.PULSE_WAVE_SPECTRUM, eqPresetId = "party_loud",
        backgroundStyle = BackgroundStyle.GRID_HORIZON,
    )
    val SUNRISE_AMBER = ThemePreset(
        id = "sunrise_amber", name = "Sunrise Amber",
        accent = NeonColor.hex("#FFAB40"), secondaryAccent = NeonColor.hex("#FF6E6E"),
        glowIntensity = 0.6f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeBrightness = 0.65f,
        lightBarAnimation = LightingAnimation.AURORA_RIBBON, eqPresetId = "morning_bright",
        backgroundStyle = BackgroundStyle.SOFT_GLOW, themeMode = ThemeMode.LIGHT,
    )
    val SILVER_STRINGS = ThemePreset(
        id = "silver_strings", name = "Silver Strings",
        accent = NeonColor.hex("#CFD8FF"), secondaryAccent = NeonColor.hex("#82B1FF"),
        glowIntensity = 0.45f, edgeLightingMode = EdgeLightingMode.GRADIENT, edgeBrightness = 0.5f,
        lightBarAnimation = LightingAnimation.CRYSTAL_GRID, eqPresetId = "instrumental_natural",
        backgroundStyle = BackgroundStyle.DEEP_SPACE,
    )
    val STUDIO_MONO_BLUE = ThemePreset(
        id = "studio_mono_blue", name = "Studio Mono Blue",
        accent = NeonColor.hex("#40C4FF"), secondaryAccent = NeonColor.hex("#B0BEC5"),
        glowIntensity = 0.25f, edgeLightingMode = EdgeLightingMode.OFF, edgeThickness = 0f, edgeBrightness = 0f,
        lightBarAnimation = LightingAnimation.EQ_BAR_MIRAGE, eqPresetId = "podcast_voice",
        backgroundStyle = BackgroundStyle.DEEP_SPACE, themeMode = ThemeMode.DARK,
    )

    /** App default when nothing genre-specific applies. */
    val NOCTERNAL_DEFAULT = ThemePreset(
        id = "nocternal_default", name = "Nocternal Default",
        accent = NeonColor.hex("#00F0FF"), secondaryAccent = NeonColor.hex("#FF00E5"),
        glowIntensity = 0.8f, edgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE,
        lightBarAnimation = LightingAnimation.PULSE_WAVE_SPECTRUM, eqPresetId = "flat",
        backgroundStyle = BackgroundStyle.DEEP_SPACE,
    )

    val all: List<ThemePreset> = listOf(
        SACRED_GOLD_AURA, EMERALD_TRANQUILITY, MOONLIT_CYAN_DRIFT, ROYAL_PURPLE_GOLD, ELECTRIC_BLUE_PULSE,
        VIOLET_HYPERSPACE, CYBER_RED_PULSE, BLUE_PURPLE_GALAXY, SOFT_PINK_GLOW, AQUA_DRIFT,
        DEEP_SPACE_INDIGO, VOLT_LIME_SURGE, LASER_FOCUS_TEAL, ROSE_NEON_HEART, RAINBOW_RAVE,
        SUNRISE_AMBER, SILVER_STRINGS, STUDIO_MONO_BLUE, NOCTERNAL_DEFAULT,
    )

    private val byId = all.associateBy { it.id }
    fun byId(id: String): ThemePreset = byId[id] ?: NOCTERNAL_DEFAULT
}
