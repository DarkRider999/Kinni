package com.nocternal.playz.plugin

import com.nocternal.playz.model.SpectrumFrame
import com.nocternal.playz.model.Track

/**
 * Plugin system (spec §11.14). A plugin is a small class compiled into the app or shipped in a separate
 * module and discovered with java.util.ServiceLoader. Plugins get a narrow [PluginHost] instead of app
 * internals, and every callback is wrapped so a crashing plugin is disabled instead of taking the player down.
 */
interface NocternalPlugin {
    val id: String
    val name: String
    val description: String
    val version: String get() = "1.0"

    fun onEnable(host: PluginHost) {}
    fun onDisable() {}
    fun onTrackStarted(track: Track) {}
    fun onTrackFinished(track: Track, listenedMs: Long) {}
    /** Called ~30×/s with post-FX audio analysis while playing. Must be cheap. */
    fun onSpectrum(frame: SpectrumFrame) {}
    /** Extra assistant commands, e.g. "start pomodoro". Return a reply if handled, else null. */
    fun onAssistantCommand(text: String): String? = null
}

/** What a plugin may do. Implemented by the app. */
interface PluginHost {
    fun showMessage(text: String)
    fun playPause()
    fun skipNext()
    fun setSleepTimerMinutes(minutes: Int)
    /** Private per-plugin key/value storage. */
    fun storage(pluginId: String): MutableMap<String, String>
    val isPrivateMode: Boolean
}

class PluginRegistry(private val host: PluginHost, private val log: (String) -> Unit = {}) {
    private val available = LinkedHashMap<String, NocternalPlugin>()
    private val enabled = LinkedHashSet<String>()

    val plugins: List<NocternalPlugin> get() = available.values.toList()
    fun isEnabled(id: String) = id in enabled

    fun register(plugin: NocternalPlugin) { available[plugin.id] = plugin }

    /** Registers plugins found on the classpath (META-INF/services/com.nocternal.playz.plugin.NocternalPlugin). */
    fun discover(loader: ClassLoader = javaClass.classLoader) {
        java.util.ServiceLoader.load(NocternalPlugin::class.java, loader).forEach(::register)
    }

    fun setEnabled(id: String, on: Boolean) {
        val p = available[id] ?: return
        if (on && enabled.add(id)) safe(p) { onEnable(host) }
        if (!on && enabled.remove(id)) safe(p) { onDisable() }
    }

    fun syncEnabled(ids: Set<String>) {
        available.keys.forEach { setEnabled(it, it in ids) }
    }

    fun dispatchTrackStarted(track: Track) = each { onTrackStarted(track) }
    fun dispatchTrackFinished(track: Track, listenedMs: Long) = each { onTrackFinished(track, listenedMs) }
    fun dispatchSpectrum(frame: SpectrumFrame) = each { onSpectrum(frame) }
    fun dispatchAssistantCommand(text: String): String? {
        for (id in enabled.toList()) {
            val p = available[id] ?: continue
            var reply: String? = null
            safe(p) { reply = onAssistantCommand(text) }
            if (reply != null) return reply
        }
        return null
    }

    private fun each(block: NocternalPlugin.() -> Unit) = enabled.toList().forEach { id -> available[id]?.let { safe(it, block) } }

    private inline fun safe(p: NocternalPlugin, block: NocternalPlugin.() -> Unit) {
        try { p.block() } catch (t: Throwable) {
            log("Plugin ${p.id} crashed and was disabled: $t")
            enabled.remove(p.id)
        }
    }
}
