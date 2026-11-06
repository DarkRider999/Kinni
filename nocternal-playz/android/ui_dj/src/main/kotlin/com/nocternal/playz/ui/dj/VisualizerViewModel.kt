package com.nocternal.playz.ui.dj

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.random.Random

class VisualizerViewModel : ViewModel() {
    // Simulated spectrum; in production this would come from android.media.audiofx.Visualizer.
    private val _spectrumBands = MutableStateFlow(List(BAND_COUNT) { 0f })

    /** 8 bands: sub, bass, low-mid, mid, upper-mid, presence, brilliance, air. Each 0f..1f. */
    val spectrumBands: StateFlow<List<Float>> = _spectrumBands.asStateFlow()
    val bpm = MutableStateFlow(128f)
    val isPlaying = MutableStateFlow(false)
    val currentKey = MutableStateFlow("4B")
    val energyLevel = MutableStateFlow(0.7f)

    private var spectrumJob: Job? = null

    fun startVisualization() {
        if (spectrumJob?.isActive == true) return
        isPlaying.value = true
        spectrumJob = viewModelScope.launch {
            while (isActive) {
                _spectrumBands.value = List(BAND_COUNT) { Random.nextFloat() }
                delay(UPDATE_INTERVAL_MS)
            }
        }
    }

    fun stopVisualization() {
        spectrumJob?.cancel()
        spectrumJob = null
        isPlaying.value = false
        _spectrumBands.value = List(BAND_COUNT) { 0f }
    }

    override fun onCleared() {
        stopVisualization()
        super.onCleared()
    }

    companion object {
        const val BAND_COUNT = 8
        const val UPDATE_INTERVAL_MS = 100L
        val BAND_LABELS = listOf("SUB", "BASS", "LO-MID", "MID", "HI-MID", "PRES", "BRIL", "AIR")
    }
}
