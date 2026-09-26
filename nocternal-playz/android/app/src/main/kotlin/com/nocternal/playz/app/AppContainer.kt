package com.nocternal.playz.app

import android.content.Context
import com.nocternal.playz.ai.AlbumArtGenerator
import com.nocternal.playz.ai.AssistantEngine
import com.nocternal.playz.ai.ClaudeAssistantLlm
import com.nocternal.playz.ai.MoodDetector
import com.nocternal.playz.ai.RecommendationEngine
import com.nocternal.playz.app.voice.MusicRecognizer
import com.nocternal.playz.app.voice.VoiceInput
import com.nocternal.playz.audio.AudioEngine
import com.nocternal.playz.audio.PlaybackEvent
import com.nocternal.playz.backup.BackupManager
import com.nocternal.playz.library.LibraryRepository
import com.nocternal.playz.lighting.LightingEngineImpl
import com.nocternal.playz.lyrics.EmbeddedLyricsProvider
import com.nocternal.playz.lyrics.LrcLibProvider
import com.nocternal.playz.lyrics.Lyrics
import com.nocternal.playz.lyrics.LyricsRepository
import com.nocternal.playz.lyrics.LyricWeaver
import com.nocternal.playz.lyrics.LyricsGenerator
import com.nocternal.playz.lyrics.LyricsOrigin
import com.nocternal.playz.lyrics.LyricsQuery
import com.nocternal.playz.lyrics.LyricsTiming
import com.nocternal.playz.ai.LlmRole
import com.nocternal.playz.ai.LlmTurn
import com.nocternal.playz.model.Track
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.offline.FileLyricsCache
import com.nocternal.playz.offline.OfflineManager
import com.nocternal.playz.playlists.SmartPlaylistEngine
import com.nocternal.playz.plugin.BeatCounterPlugin
import com.nocternal.playz.plugin.PluginHost
import com.nocternal.playz.plugin.PluginRegistry
import com.nocternal.playz.plugin.PomodoroPlugin
import com.nocternal.playz.plugin.ScrobblerPlugin
import com.nocternal.playz.theme.GenreDetector
import com.nocternal.playz.theme.ThemeApplier
import com.nocternal.playz.theme.ThemeEvent
import com.nocternal.playz.theme.ThemeStateStore
import com.nocternal.playz.theme.ThemeSwitcher
import com.nocternal.playz.radio.RadioDirectory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * Manual dependency wiring for the whole app, and the glue between modules:
 *  song start → theme switcher, mood detection, lyrics, plugins
 *  song end   → history (unless private mode), plugins
 *  settings   → audio engine, lighting, offline/auto-download, plugins
 */
class AppContainer(val context: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    val settingsRepo = SettingsRepository(context, scope)
    val library = LibraryRepository(context, scope)
    val genreDetector = GenreDetector()
    val moodDetector = MoodDetector(genreDetector)
    val smartPlaylists = SmartPlaylistEngine(genreDetector) { moodDetector.detect(it)?.mood }
    val recommender = RecommendationEngine(genreDetector, moodDetector)
    val artGenerator = AlbumArtGenerator(genreDetector)

    val audio = AudioEngine(context, scope, autoMixPool = { library.data.value.tracks })
    val themeStore = ThemeStateStore()
    val lighting = LightingEngineImpl()
    val themeSwitcher = ThemeSwitcher(ThemeApplier(themeStore, lighting, audio, themeStore), { settingsRepo.settings.value }, genreDetector)

    val offline = OfflineManager(context)
    val lyricsCache = FileLyricsCache(context)
    val lyricsRepo = LyricsRepository(
        cache = lyricsCache,
        offline = listOf(EmbeddedLyricsProvider { null }),
        online = listOf(LrcLibProvider()),
        isOnlineAllowed = { offline.canUseNetwork(settingsRepo.settings.value) },
        generators = listOf(ClaudeLyricsGenerator(), LyricWeaver()),
    )
    private val _lyricsLoading = MutableStateFlow(false)
    val lyricsLoading: StateFlow<Boolean> = _lyricsLoading.asStateFlow()

    /** Writes original lyrics with Claude when a key is set and no real lyrics exist (cached for offline). */
    private inner class ClaudeLyricsGenerator : LyricsGenerator {
        override val cacheable = true
        override suspend fun find(track: Track): Lyrics? {
            val s = settingsRepo.settings.value
            val key = s.assistantApiKey?.takeIf { it.isNotBlank() } ?: return null
            if (!offline.canUseNetwork(s)) return null
            val (title, artist) = LyricsQuery.of(track)
            val genre = genreDetector.detect(track)?.genre?.displayName ?: "pop"
            val mood = moodDetector.detect(track)?.mood?.label ?: "any"
            val prompt = "Write ORIGINAL song lyrics for a song titled \"$title\"" + (artist?.let { " (artist: $it)" } ?: "") +
                ", genre $genre, mood $mood. Do not reproduce, quote or paraphrase the real lyrics of any existing song; " +
                "write new words inspired only by the title and mood. If the title is Hindi or Hinglish, write in Hinglish (Latin script). " +
                "18 to 26 short lines with verse and chorus. Output only the lyric lines, one per line, no headings or notes."
            val text = ClaudeAssistantLlm(key).complete("You write song lyrics.", listOf(LlmTurn(LlmRole.USER, prompt)))
            val lines = text.lines().map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("[") && !it.startsWith("#") && !it.startsWith("(") }.take(40)
            return if (lines.size < 4) null else LyricsTiming.spread(lines, track.durationMs, LyricsOrigin.AI_GENERATED)
        }
    }
    private val _lyrics = MutableStateFlow<Lyrics?>(null)
    val lyrics: StateFlow<Lyrics?> = _lyrics.asStateFlow()

    val backup = BackupManager(appVersion = "1.0.0")
    val radio = RadioDirectory()
    val voice = VoiceInput(context)
    val recognizer = MusicRecognizer { settingsRepo.recognitionToken.value }

    /** One-line toasts from plugins and background work. */
    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    private val pluginStorage = HashMap<String, MutableMap<String, String>>()
    val plugins = PluginRegistry(object : PluginHost {
        override fun showMessage(text: String) { _messages.tryEmit(text) }
        override fun playPause() = audio.togglePlay()
        override fun skipNext() = audio.next()
        override fun setSleepTimerMinutes(minutes: Int) = audio.sleepTimer.start(minutes)
        override fun storage(pluginId: String) = pluginStorage.getOrPut(pluginId) { mutableMapOf() }
        override val isPrivateMode: Boolean get() = settingsRepo.settings.value.privateMode
    }).apply {
        register(ScrobblerPlugin()); register(PomodoroPlugin()); register(BeatCounterPlugin())
        discover()
    }
    private val _assistant = MutableStateFlow(buildAssistant(null))
    val assistant: StateFlow<AssistantEngine> = _assistant.asStateFlow()

    /** Pending search to hand to the YouTube / Radio panels (set by the assistant). */
    val panelSearch = MutableStateFlow<Pair<AudioSource, String>?>(null)
    val requestedSource = MutableStateFlow<AudioSource?>(null)

    private fun buildAssistant(apiKey: String?) = AssistantEngine(
        llm = apiKey?.takeIf { it.isNotBlank() }?.let { ClaudeAssistantLlm(it) },
        pluginHandler = { plugins.dispatchAssistantCommand(it) },
        genres = genreDetector, moods = moodDetector, recommender = recommender, art = artGenerator,
    )

    fun start() {
        scope.launch { library.load() }
        offline.start()
        OfflineManager.candidates = {
            val snap = library.snapshot()
            (smartPlaylists.mostPlayed(snap).trackIds + smartPlaylists.recentlyPlayed(snap).trackIds).distinct().mapNotNull(library::track)
        }

        scope.launch {
            settingsRepo.settings.collect { s ->
                audio.applySettings(s)
                library.privateMode = s.privateMode
                plugins.syncEnabled(s.enabledPlugins)
                // User-set lighting values are pinned so genre themes can't reset them.
                lighting.applyUserSettings(s.edgeLighting, s.lightBar)
                themeStore.setThemeMode(s.themeMode)
                s.customAccent?.let(themeStore::setAccentColor)
                offline.scheduleAutoDownload(s)
            }
        }
        scope.launch { settingsRepo.settings.map { it.assistantApiKey }.distinctUntilChanged().collect { _assistant.value = buildAssistant(it) } }

        scope.launch {
            audio.events.collect { e ->
                when (e) {
                    is PlaybackEvent.TrackStarted -> {
                        themeSwitcher.onEvent(ThemeEvent.SongStarted(e.track, e.queueGenreId))
                        moodDetector.detect(e.track, hour())?.let { themeSwitcher.onEvent(ThemeEvent.MoodDetected(it.mood, it.confidence, hour())) }
                        plugins.dispatchTrackStarted(e.track)
                        _lyrics.value = null
                        if (e.track.source == AudioSource.LOCAL) launch {
                            _lyricsLoading.value = true
                            val l = lyricsRepo.lyricsFor(e.track)
                            if (audio.state.value.track?.id == e.track.id) _lyrics.value = l
                            _lyricsLoading.value = false
                        }
                    }
                    is PlaybackEvent.TrackFinished -> {
                        library.recordPlay(PlayEvent(e.track.id, System.currentTimeMillis() - e.listenedMs, e.listenedMs, e.track.source, completed = e.track.durationMs > 0 && e.listenedMs >= e.track.durationMs * 0.8))
                        plugins.dispatchTrackFinished(e.track, e.listenedMs)
                    }
                }
            }
        }
        scope.launch {
            var last = 0L
            audio.spectrum.collect { f -> if (f.timestampMs - last >= 33) { plugins.dispatchSpectrum(f); last = f.timestampMs } }
        }
        // Time-of-day auto theme, checked every 10 minutes.
        scope.launch { while (true) { themeSwitcher.onEvent(ThemeEvent.TimeTick(hour())); delay(10 * 60_000L) } }
    }

    fun hour(): Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
}
