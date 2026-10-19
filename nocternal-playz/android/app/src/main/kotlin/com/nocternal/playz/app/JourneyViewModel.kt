package com.nocternal.playz.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.intelligence.JourneyPlan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * AI Journey Mode's screen state (Phase 4A): generating a [JourneyPlan] from a prompt is enough
 * work (library scan + DNA analysis + set building) to want off the main thread and to survive a
 * configuration change while the preview is up, so this is a real `ViewModel` rather than
 * screen-local `remember` state like the rest of Phase 1-4B's screens.
 */
class JourneyViewModel(private val c: AppContainer) : ViewModel() {
    private val _plan = MutableStateFlow<JourneyPlan?>(null)
    val plan: StateFlow<JourneyPlan?> = _plan.asStateFlow()

    private val _generating = MutableStateFlow(false)
    val generating: StateFlow<Boolean> = _generating.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun generate(prompt: String) {
        if (prompt.isBlank()) return
        viewModelScope.launch(Dispatchers.Default) {
            _generating.value = true
            _error.value = null
            val lib = c.library.data.value
            val result = c.journeyPlanner.plan(prompt, lib.tracks, lib.history, c.hour(), c.audio.state.value.track)
            _plan.value = result
            if (result == null) _error.value = "Couldn't build a journey from that — try a different genre, mood, or a shorter duration."
            _generating.value = false
        }
    }

    fun clear() { _plan.value = null; _error.value = null }

    /** Commits the previewed plan to playback via the same playQueue() entry point every other screen uses. */
    fun start(): Boolean {
        val p = _plan.value ?: return false
        c.audio.playQueue(p.steps.map { it.track }, 0)
        return true
    }
}
