package com.nocternal.playz.lighting

import com.nocternal.playz.model.EdgeLightingMode
import com.nocternal.playz.model.EdgeLightingSettings
import com.nocternal.playz.model.LightBarSettings
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.theme.LightingEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class LightingState(
    val lightBarEnabled: Boolean = true,
    val lightBarAnimation: LightingAnimation = LightingAnimation.PULSE_WAVE_SPECTRUM,
    /** Null = follow theme accent. */
    val lightBarColor: NeonColor? = null,
    val lightBarGlow: Float = 0.8f,
    val edgeEnabled: Boolean = true,
    val edgeMode: EdgeLightingMode = EdgeLightingMode.MUSIC_REACTIVE,
    val edgeThickness: Float = 4f,
    val edgeBrightness: Float = 0.8f,
    /** Full-screen animation behind the player ("visualizer" mode). */
    val backdropAnimation: LightingAnimation? = null,
)

/**
 * LightingEngine sink for the theme switcher plus the user's own lighting settings. Values the user has set
 * explicitly are pinned: genre themes can't overwrite them (only "Follow theme" releases them).
 */
class LightingEngineImpl(initial: LightingState = LightingState()) : LightingEngine {
    private val _state = MutableStateFlow(initial)
    val state: StateFlow<LightingState> = _state.asStateFlow()

    @Volatile private var pinnedStyle: Pair<Float, Float>? = null
    @Volatile private var pinnedMode: EdgeLightingMode? = null
    @Volatile private var pinnedAnimation: LightingAnimation? = null

    // Theme-driven values, remembered so releasing a pin falls back to the current theme.
    private var themeStyle = initial.edgeThickness to initial.edgeBrightness
    private var themeMode = initial.edgeMode
    private var themeAnimation = initial.lightBarAnimation

    override fun setEdgeMode(mode: EdgeLightingMode) {
        themeMode = mode
        _state.update { it.copy(edgeMode = pinnedMode ?: mode) }
    }

    override fun setEdgeStyle(thickness: Float, brightness: Float) {
        themeStyle = thickness to brightness
        val (t, b) = pinnedStyle ?: themeStyle
        _state.update { it.copy(edgeThickness = t, edgeBrightness = b) }
    }

    override fun setLightBarAnimation(animation: LightingAnimation) {
        themeAnimation = animation
        _state.update { it.copy(lightBarAnimation = pinnedAnimation ?: animation) }
    }

    /** Applies the user's saved edge-lighting and light-bar choices (called whenever settings change). */
    fun applyUserSettings(edge: EdgeLightingSettings, bar: LightBarSettings) {
        pinnedStyle = if (edge.customStyle) edge.thickness to edge.brightness else null
        pinnedMode = if (edge.customMode) edge.mode else null
        pinnedAnimation = if (bar.customAnimation) bar.animation else null
        val (t, b) = pinnedStyle ?: themeStyle
        _state.update {
            it.copy(
                edgeEnabled = edge.enabled, edgeThickness = t, edgeBrightness = b, edgeMode = pinnedMode ?: themeMode,
                lightBarEnabled = bar.enabled, lightBarColor = bar.color, lightBarGlow = bar.glowIntensity,
                lightBarAnimation = pinnedAnimation ?: themeAnimation,
            )
        }
    }

    fun update(block: (LightingState) -> LightingState) = _state.update(block)
}
