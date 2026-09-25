package com.nocternal.playz.theme

import com.nocternal.playz.model.AppSettings
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.ThemePreset
import com.nocternal.playz.model.Track
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Why a theme switch was requested. Higher [priority] wins over lower until the context changes. */
enum class ThemeTrigger(val priority: Int) {
    TIME_OF_DAY(10),
    SOURCE_CHANGED(30),
    AI_MOOD_DETECTED(40),
    SONG_STARTED(60),
    GENRE_PLAYLIST_OPENED(80),
    GENRE_TILE_SELECTED(80),
    MANUAL(100),
}

sealed interface ThemeEvent {
    /** [queueGenreId] is set when the song plays from a genre playlist; that context wins over per-song detection. */
    data class SongStarted(val track: Track, val queueGenreId: String? = null) : ThemeEvent
    data class GenrePlaylistOpened(val genreId: String) : ThemeEvent
    data class MoodDetected(val mood: Mood, val confidence: Float, val hourOfDay: Int? = null) : ThemeEvent
    data class SourceChanged(val source: AudioSource, val nowPlaying: Track? = null) : ThemeEvent
    data class GenreTileSelected(val genreId: String) : ThemeEvent
    data class TimeTick(val hourOfDay: Int) : ThemeEvent
    data class ManualThemeSelected(val presetId: String) : ThemeEvent
    data object ManualLockReleased : ThemeEvent
}

data class ThemeDecision(
    val preset: ThemePreset,
    val genre: GenreDefinition?,
    val trigger: ThemeTrigger,
    val reason: String,
)

/**
 * Genre-based theme switching (spec §9):
 *
 *     val genre = detectGenre(currentSong)
 *     val theme = genreThemeMap[genre]
 *     applyTheme(theme)
 *
 * plus the rules that make it feel right in practice:
 *  - A manual theme choice locks auto switching until released.
 *  - A genre tile or genre playlist sets a context that per-song detection does not override.
 *  - Mood only switches the theme when the song's genre could not be detected.
 *  - Time-of-day only applies while nothing more specific is active.
 *  - Re-applying the same preset is a no-op (no flicker between songs of one genre).
 *  - A custom accent colour from settings always wins over the preset accent.
 */
class ThemeSwitcher(
    private val applier: ThemeApplier,
    private val settings: () -> AppSettings,
    private val detector: GenreDetector = GenreDetector(),
    private val genreThemeMap: Map<String, String> = GenreCatalog.genreThemeMap,
    private val moodConfidenceThreshold: Float = 0.6f,
) {
    private val _current = MutableStateFlow(
        ThemeDecision(ThemePresets.NOCTERNAL_DEFAULT, null, ThemeTrigger.TIME_OF_DAY, "default theme"),
    )
    val current: StateFlow<ThemeDecision> = _current.asStateFlow()

    private var manualLock = false
    private var contextGenreId: String? = null
    private var lastSongGenreKnown = false

    /** Handles an event; returns the decision if the theme changed, null if it was ignored or unchanged. */
    fun onEvent(event: ThemeEvent): ThemeDecision? {
        val s = settings()
        val decision: ThemeDecision = when (event) {
            is ThemeEvent.ManualThemeSelected -> {
                manualLock = true
                ThemeDecision(ThemePresets.byId(event.presetId), null, ThemeTrigger.MANUAL, "chosen by you")
            }
            ThemeEvent.ManualLockReleased -> {
                manualLock = false
                contextGenreId?.let { forGenre(it, ThemeTrigger.GENRE_PLAYLIST_OPENED, "back to playlist theme") }
                    ?: ThemeDecision(ThemePresets.NOCTERNAL_DEFAULT, null, ThemeTrigger.TIME_OF_DAY, "auto theme resumed")
            }
            else -> if (manualLock) null else autoDecision(event, s)
        } ?: return null

        if (decision.preset.id == _current.value.preset.id && event !is ThemeEvent.ManualThemeSelected) {
            _current.value = decision.copy(preset = _current.value.preset)
            return null
        }
        val preset = s.customAccent?.let { decision.preset.copy(accent = it) } ?: decision.preset
        applier.applyTheme(preset, applyEq = s.eqFollowsTheme)
        val applied = decision.copy(preset = preset)
        _current.value = applied
        return applied
    }

    fun detectGenre(track: Track): GenreDefinition? = detector.detect(track)?.genre

    private fun autoDecision(event: ThemeEvent, s: AppSettings): ThemeDecision? = when (event) {
        is ThemeEvent.GenreTileSelected -> {
            contextGenreId = event.genreId
            forGenre(event.genreId, ThemeTrigger.GENRE_TILE_SELECTED, "genre tile")
        }
        is ThemeEvent.GenrePlaylistOpened -> {
            contextGenreId = event.genreId
            forGenre(event.genreId, ThemeTrigger.GENRE_PLAYLIST_OPENED, "genre playlist")
        }
        is ThemeEvent.SongStarted -> onSongStarted(event, s)
        is ThemeEvent.MoodDetected -> {
            val weaker = _current.value.trigger.priority <= ThemeTrigger.AI_MOOD_DETECTED.priority
            if (s.autoThemeByMood && event.confidence >= moodConfidenceThreshold && (weaker || !lastSongGenreKnown) && contextGenreId == null) {
                val genre = detector.forMood(event.mood, event.hourOfDay)
                forGenre(genre.id, ThemeTrigger.AI_MOOD_DETECTED, "mood looks ${event.mood.label.lowercase()}")
            } else null
        }
        is ThemeEvent.SourceChanged -> {
            contextGenreId = null
            val genre = event.nowPlaying?.let { detector.detect(it)?.genre }
            if (genre != null) forGenre(genre.id, ThemeTrigger.SOURCE_CHANGED, "${event.source.label} · ${genre.displayName}")
            else ThemeDecision(sourcePreset(event.source), null, ThemeTrigger.SOURCE_CHANGED, "switched to ${event.source.label}")
        }
        is ThemeEvent.TimeTick -> {
            if (s.autoThemeByTime && _current.value.trigger.priority <= ThemeTrigger.TIME_OF_DAY.priority) {
                val genre = TimeOfDayThemes.genreForHour(event.hourOfDay)
                forGenre(genre.id, ThemeTrigger.TIME_OF_DAY, "time of day")
            } else null
        }
        is ThemeEvent.ManualThemeSelected, ThemeEvent.ManualLockReleased -> null
    }

    private fun onSongStarted(event: ThemeEvent.SongStarted, s: AppSettings): ThemeDecision? {
        event.queueGenreId?.let { contextGenreId = it }
        if (event.queueGenreId == null && contextGenreId != null) contextGenreId = null
        contextGenreId?.let { id ->
            lastSongGenreKnown = true
            return forGenre(id, ThemeTrigger.GENRE_PLAYLIST_OPENED, "playing from genre playlist")
        }
        if (!s.autoThemeByGenre) return null
        val match = detector.detect(event.track)
        lastSongGenreKnown = match != null
        return match?.let { forGenre(it.genre.id, ThemeTrigger.SONG_STARTED, it.reason) }
    }

    private fun forGenre(genreId: String, trigger: ThemeTrigger, reason: String): ThemeDecision? {
        val genre = GenreCatalog.byId(genreId) ?: return null
        val presetId = genreThemeMap[genreId] ?: genre.themePresetId
        return ThemeDecision(ThemePresets.byId(presetId), genre, trigger, reason)
    }

    private fun sourcePreset(source: AudioSource): ThemePreset = when (source) {
        AudioSource.LOCAL -> ThemePresets.NOCTERNAL_DEFAULT
        AudioSource.YOUTUBE -> ThemePresets.CYBER_RED_PULSE
        AudioSource.RADIO -> ThemePresets.BLUE_PURPLE_GALAXY
    }
}
