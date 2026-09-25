package com.nocternal.playz.app

import com.nocternal.playz.ai.AssistantAction
import com.nocternal.playz.ai.AssistantContext
import com.nocternal.playz.ai.EqAdvisor
import com.nocternal.playz.ai.TransportCommand
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.theme.EqPresets
import com.nocternal.playz.theme.ThemeEvent
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/** Runs assistant actions and the UI's own commands against the engine, theme and library. */
class ActionExecutor(private val c: AppContainer) {
    private val _recognitionRequests = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val recognitionRequests: SharedFlow<Unit> = _recognitionRequests.asSharedFlow()

    fun context(): AssistantContext {
        val d = c.library.data.value
        val s = c.settingsRepo.settings.value
        return AssistantContext(d.tracks, d.favorites, if (s.privateMode) emptyList() else d.history, c.audio.state.value.track, c.hour(), c.audio.state.value.source, c.audio.route.value, s.privateMode)
    }

    fun playPlaylist(p: Playlist, startIndex: Int = 0) {
        val tracks = p.trackIds.mapNotNull(c.library::track)
        if (tracks.isEmpty()) return
        p.genreId?.let { c.themeSwitcher.onEvent(ThemeEvent.GenrePlaylistOpened(it)) }
        c.audio.playQueue(tracks, startIndex, p.genreId)
    }

    fun openGenre(genreId: String) {
        c.themeSwitcher.onEvent(ThemeEvent.GenreTileSelected(genreId))
    }

    fun run(actions: List<AssistantAction>) = actions.forEach(::run)

    fun run(a: AssistantAction) {
        when (a) {
            is AssistantAction.PlayQueue -> playPlaylist(a.playlist.copy(genreId = a.genreId ?: a.playlist.genreId))
            is AssistantAction.Search -> { c.requestedSource.value = a.source; c.panelSearch.value = a.source to a.query }
            is AssistantAction.SetEq -> {
                val preset = if (a.presetId.endsWith("_speaker")) EqAdvisor.recommend(c.audio.state.value.track, c.audio.route.value, c.genreDetector).preset else EqPresets.byId(a.presetId)
                c.audio.applyPreset(preset)
            }
            is AssistantAction.ChangeBass -> c.audio.updateFx { it.copy(bassBoost = (it.bassBoost + a.delta).coerceIn(0f, 1f)) }
            is AssistantAction.ApplyGenreTheme -> c.themeSwitcher.onEvent(ThemeEvent.GenreTileSelected(a.genreId))
            is AssistantAction.SwitchSource -> c.requestedSource.value = a.source
            is AssistantAction.SetSleepTimer -> c.audio.sleepTimer.start(a.minutes)
            is AssistantAction.Transport -> when (a.command) {
                TransportCommand.PLAY -> c.audio.play()
                TransportCommand.PAUSE -> c.audio.pause()
                TransportCommand.NEXT -> c.audio.next()
                TransportCommand.PREVIOUS -> c.audio.previous()
                TransportCommand.SHUFFLE -> c.audio.setShuffle(!c.audio.state.value.shuffle)
                TransportCommand.REPEAT -> c.audio.cycleRepeat()
                TransportCommand.VOLUME_UP -> c.audio.volumeStep(true)
                TransportCommand.VOLUME_DOWN -> c.audio.volumeStep(false)
                TransportCommand.LIKE -> c.audio.state.value.track?.let { c.library.toggleFavorite(it.id) }
            }
            is AssistantAction.Enhance -> c.audio.enhance(a.mode)
            is AssistantAction.SetVocalRemover -> c.audio.updateFx { it.copy(vocalRemover = a.amount) }
            AssistantAction.StartRecognition -> _recognitionRequests.tryEmit(Unit)
            is AssistantAction.ShowAlbumArt -> Unit // rendered inline in the chat
            is AssistantAction.EnableAutoMix -> c.audio.setAutoMix(a.on)
        }
    }
}
