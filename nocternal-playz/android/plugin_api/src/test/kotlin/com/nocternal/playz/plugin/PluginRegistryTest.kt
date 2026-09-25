package com.nocternal.playz.plugin

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PluginRegistryTest {
    private class Host : PluginHost {
        var sleep = 0
        override fun showMessage(text: String) {}
        override fun playPause() {}
        override fun skipNext() {}
        override fun setSleepTimerMinutes(minutes: Int) { sleep = minutes }
        override fun storage(pluginId: String) = mutableMapOf<String, String>()
        override var isPrivateMode = false
    }

    @Test fun crashingPluginIsDisabled() {
        val reg = PluginRegistry(Host())
        reg.register(object : NocternalPlugin {
            override val id = "bad"; override val name = "Bad"; override val description = ""
            override fun onTrackStarted(track: Track) = error("boom")
        })
        reg.setEnabled("bad", true)
        reg.dispatchTrackStarted(Track("1", "", "x"))
        assertFalse(reg.isEnabled("bad"))
    }

    @Test fun pomodoroCommand() {
        val host = Host()
        val reg = PluginRegistry(host).apply { register(PomodoroPlugin()); setEnabled("pomodoro", true) }
        assertTrue(reg.dispatchAssistantCommand("start pomodoro for 30 min")!!.contains("30"))
        assertEquals(30, host.sleep)
    }

    @Test fun scrobblerRespectsPrivateMode() {
        val sent = mutableListOf<String>()
        val host = Host()
        val reg = PluginRegistry(host).apply { register(ScrobblerPlugin { _, t, _ -> sent += t }); setEnabled("scrobbler", true) }
        val t = Track("1", "", "Song", durationMs = 200_000)
        reg.dispatchTrackFinished(t, 150_000)
        host.isPrivateMode = true
        reg.dispatchTrackFinished(t, 150_000)
        assertEquals(listOf("Song"), sent)
    }
}
