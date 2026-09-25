package com.nocternal.playz.audio

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Sleep timer with a gentle fade over the last [fadeMs]. [fadeLevel] is multiplied into the FX fader;
 * [onExpire] pauses playback. "End of track" mode stops when the current song finishes.
 */
class SleepTimer(private val scope: CoroutineScope, private val onExpire: () -> Unit, private val fadeMs: Long = 30_000) {
    private val _remainingMs = MutableStateFlow<Long?>(null)
    val remainingMs: StateFlow<Long?> = _remainingMs.asStateFlow()
    private val _endOfTrack = MutableStateFlow(false)
    val endOfTrack: StateFlow<Boolean> = _endOfTrack.asStateFlow()

    @Volatile var fadeLevel: Float = 1f
        private set
    private var job: Job? = null

    fun start(minutes: Int) {
        cancel()
        val end = System.currentTimeMillis() + minutes * 60_000L
        job = scope.launch {
            while (true) {
                val left = end - System.currentTimeMillis()
                if (left <= 0) break
                _remainingMs.value = left
                fadeLevel = if (left < fadeMs) left.toFloat() / fadeMs else 1f
                delay(250)
            }
            onExpire()
            reset()
        }
    }

    fun stopAtEndOfTrack(on: Boolean) { cancel(); _endOfTrack.value = on }

    /** Called by the engine when a track ends; returns true if playback should stop. */
    fun consumeEndOfTrack(): Boolean = _endOfTrack.value.also { if (it) _endOfTrack.value = false }

    fun cancel() { job?.cancel(); reset() }

    private fun reset() { job = null; _remainingMs.value = null; fadeLevel = 1f }
}
