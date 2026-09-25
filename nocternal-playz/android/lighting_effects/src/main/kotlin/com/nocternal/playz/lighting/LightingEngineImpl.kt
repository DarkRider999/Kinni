package com.nocternal.playz.lighting

import com.nocternal.playz.model.EdgeLightingMode
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

/** LightingEngine sink for the theme switcher plus the user's manual lighting settings. */
class LightingEngineImpl(initial: LightingState = LightingState()) : LightingEngine {
    private val _state = MutableStateFlow(initial)
    val state: StateFlow<LightingState> = _state.asStateFlow()

    override fun setEdgeMode(mode: EdgeLightingMode) = _state.update { it.copy(edgeMode = mode, edgeEnabled = mode != EdgeLightingMode.OFF) }
    override fun setEdgeStyle(thickness: Float, brightness: Float) = _state.update { it.copy(edgeThickness = thickness, edgeBrightness = brightness) }
    override fun setLightBarAnimation(animation: LightingAnimation) = _state.update { it.copy(lightBarAnimation = animation) }

    fun update(block: (LightingState) -> LightingState) = _state.update(block)
}
