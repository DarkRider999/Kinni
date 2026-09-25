package com.nocternal.playz.theme

import com.nocternal.playz.model.BackgroundStyle
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.ThemeMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** The visual theme the UI renders. Observed by Compose (Android) and mirrored in SwiftUI (iOS). */
data class NeonThemeState(
    val mode: ThemeMode = ThemeMode.NEON,
    val accent: NeonColor = ThemePresets.NOCTERNAL_DEFAULT.accent,
    val secondaryAccent: NeonColor = ThemePresets.NOCTERNAL_DEFAULT.secondaryAccent,
    val glowIntensity: Float = ThemePresets.NOCTERNAL_DEFAULT.glowIntensity,
    val background: BackgroundStyle = ThemePresets.NOCTERNAL_DEFAULT.backgroundStyle,
)

/** Default ThemeManager + BackgroundManager: a state holder the UI collects. */
class ThemeStateStore(initial: NeonThemeState = NeonThemeState()) : ThemeManager, BackgroundManager {
    private val _state = MutableStateFlow(initial)
    val state: StateFlow<NeonThemeState> = _state.asStateFlow()

    override fun setAccentColor(color: NeonColor) = _state.update { it.copy(accent = color) }
    override fun setSecondaryAccentColor(color: NeonColor) = _state.update { it.copy(secondaryAccent = color) }
    override fun setGlowIntensity(intensity: Float) = _state.update { it.copy(glowIntensity = intensity.coerceIn(0f, 1f)) }
    override fun setThemeMode(mode: ThemeMode) = _state.update { it.copy(mode = mode) }
    override fun setStyle(style: BackgroundStyle) = _state.update { it.copy(background = style) }
}
