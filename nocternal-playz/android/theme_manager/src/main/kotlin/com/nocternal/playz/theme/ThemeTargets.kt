package com.nocternal.playz.theme

import com.nocternal.playz.model.BackgroundStyle
import com.nocternal.playz.model.EdgeLightingMode
import com.nocternal.playz.model.EqPreset
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.ThemeMode
import com.nocternal.playz.model.ThemePreset

/*
 * The four sinks a theme is applied to. Names follow the product spec:
 *   ThemeManager.setAccentColor / setGlowIntensity
 *   LightingEngine.setEdgeMode / setLightBarAnimation
 *   EQManager.applyPreset
 *   BackgroundManager.setStyle
 * The UI implements ThemeManager/BackgroundManager (ThemeStateStore), lighting_effects implements
 * LightingEngine and audio_engine implements EQManager.
 */

interface ThemeManager {
    fun setAccentColor(color: NeonColor)
    fun setSecondaryAccentColor(color: NeonColor)
    fun setGlowIntensity(intensity: Float)
    fun setThemeMode(mode: ThemeMode)
}

interface LightingEngine {
    fun setEdgeMode(mode: EdgeLightingMode)
    fun setEdgeStyle(thickness: Float, brightness: Float)
    fun setLightBarAnimation(animation: LightingAnimation)
}

interface EQManager {
    fun applyPreset(preset: EqPreset)
}

interface BackgroundManager {
    fun setStyle(style: BackgroundStyle)
}

/** Applies a [ThemePreset] to every sink in one step (spec §9 "Theme application"). */
class ThemeApplier(
    private val themeManager: ThemeManager,
    private val lightingEngine: LightingEngine,
    private val eqManager: EQManager,
    private val backgroundManager: BackgroundManager,
) {
    fun applyTheme(theme: ThemePreset, applyEq: Boolean = true, respectThemeMode: Boolean = false) {
        themeManager.setAccentColor(theme.accent)
        themeManager.setSecondaryAccentColor(theme.secondaryAccent)
        themeManager.setGlowIntensity(theme.glowIntensity)
        if (respectThemeMode) themeManager.setThemeMode(theme.themeMode)
        lightingEngine.setEdgeMode(theme.edgeLightingMode)
        lightingEngine.setEdgeStyle(theme.edgeThickness, theme.edgeBrightness)
        lightingEngine.setLightBarAnimation(theme.lightBarAnimation)
        if (applyEq) eqManager.applyPreset(EqPresets.byId(theme.eqPresetId))
        backgroundManager.setStyle(theme.backgroundStyle)
    }
}
