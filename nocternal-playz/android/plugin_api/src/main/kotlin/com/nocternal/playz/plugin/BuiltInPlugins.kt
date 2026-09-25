package com.nocternal.playz.plugin

import com.nocternal.playz.model.SpectrumFrame
import com.nocternal.playz.model.Track

/** Logs finished plays for a scrobble service; respects private mode. Swap [submit] for a Last.fm/ListenBrainz client. */
class ScrobblerPlugin(private val submit: (artist: String, title: String, timestampSec: Long) -> Unit = { _, _, _ -> }) : NocternalPlugin {
    override val id = "scrobbler"
    override val name = "Scrobbler"
    override val description = "Sends plays over 50% or 4 minutes to your scrobble service"
    private var host: PluginHost? = null

    override fun onEnable(host: PluginHost) { this.host = host }
    override fun onTrackFinished(track: Track, listenedMs: Long) {
        val h = host ?: return
        if (h.isPrivateMode) return
        if (listenedMs >= 240_000 || (track.durationMs > 30_000 && listenedMs * 2 >= track.durationMs)) {
            submit(track.artist, track.title, System.currentTimeMillis() / 1000)
        }
    }
}

/** "start pomodoro" → 25 minutes of music, then a sleep-timer stop. */
class PomodoroPlugin : NocternalPlugin {
    override val id = "pomodoro"
    override val name = "Pomodoro focus"
    override val description = "Say “start pomodoro” to play focus music for 25 minutes"
    private var host: PluginHost? = null

    override fun onEnable(host: PluginHost) { this.host = host }
    override fun onAssistantCommand(text: String): String? {
        if (!text.contains("pomodoro", ignoreCase = true)) return null
        val minutes = Regex("(\\d+)\\s*min").find(text)?.groupValues?.get(1)?.toIntOrNull() ?: 25
        host?.setSleepTimerMinutes(minutes)
        return "Pomodoro started: $minutes minutes of focus. I’ll stop the music when it’s break time."
    }
}

/** Counts beats per minute of listening, a tiny example of a spectrum consumer. */
class BeatCounterPlugin : NocternalPlugin {
    override val id = "beat_counter"
    override val name = "Beat counter"
    override val description = "Counts the beats you listened to (shown in stats)"
    var beats = 0L
        private set
    override fun onSpectrum(frame: SpectrumFrame) { if (frame.beat) beats++ }
}
