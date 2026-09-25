package com.nocternal.playz.ai

import com.nocternal.playz.fx.EnhancerMode
import com.nocternal.playz.fx.OutputRoute
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.Track

/** What the user asked for, parsed from text or a voice transcript. */
sealed interface AssistantIntent {
    data class PlayGenre(val genreId: String) : AssistantIntent
    data class PlayMood(val mood: Mood) : AssistantIntent
    data class PlaySearch(val query: String) : AssistantIntent
    data class SuggestPlaylist(val genreId: String?, val mood: Mood?, val bpmMin: Float?, val bpmMax: Float?) : AssistantIntent
    data class AdjustBass(val up: Boolean) : AssistantIntent
    data class ApplyEqPreset(val presetId: String) : AssistantIntent
    data object RecommendEq : AssistantIntent
    data object OptimizeEq : AssistantIntent
    data class ActivateTheme(val genreId: String) : AssistantIntent
    data class SwitchSource(val source: AudioSource) : AssistantIntent
    data class SleepTimer(val minutes: Int) : AssistantIntent
    data class Transport(val command: TransportCommand) : AssistantIntent
    data class Enhance(val mode: EnhancerMode) : AssistantIntent
    data class VocalRemover(val on: Boolean) : AssistantIntent
    data class ExplainFeature(val topic: String) : AssistantIntent
    data object IdentifySong : AssistantIntent
    data object GenerateAlbumArt : AssistantIntent
    data object AutoMix : AssistantIntent
    data class Unknown(val text: String) : AssistantIntent
}

enum class TransportCommand { PLAY, PAUSE, NEXT, PREVIOUS, SHUFFLE, REPEAT, VOLUME_UP, VOLUME_DOWN, LIKE }

/** Side effects the app performs for a reply. The UI layer executes these; the engine stays pure. */
sealed interface AssistantAction {
    data class PlayQueue(val playlist: Playlist, val genreId: String? = null) : AssistantAction
    data class Search(val query: String, val source: AudioSource) : AssistantAction
    data class SetEq(val presetId: String) : AssistantAction
    data class ChangeBass(val delta: Float) : AssistantAction
    data class ApplyGenreTheme(val genreId: String) : AssistantAction
    data class SwitchSource(val source: AudioSource) : AssistantAction
    data class SetSleepTimer(val minutes: Int) : AssistantAction
    data class Transport(val command: TransportCommand) : AssistantAction
    data class Enhance(val mode: EnhancerMode) : AssistantAction
    data class SetVocalRemover(val amount: Float) : AssistantAction
    data object StartRecognition : AssistantAction
    data class ShowAlbumArt(val spec: NeonArtSpec) : AssistantAction
    data class EnableAutoMix(val on: Boolean) : AssistantAction
}

data class AssistantResponse(
    val reply: String,
    val actions: List<AssistantAction> = emptyList(),
    /** Quick-action chips shown under the reply. */
    val suggestions: List<String> = emptyList(),
    val fromLlm: Boolean = false,
)

/** Everything the assistant may look at. Built by the app on each request. */
data class AssistantContext(
    val tracks: List<Track> = emptyList(),
    val favorites: Set<String> = emptySet(),
    val history: List<PlayEvent> = emptyList(),
    val nowPlaying: Track? = null,
    val hourOfDay: Int = 12,
    val source: AudioSource = AudioSource.LOCAL,
    val route: OutputRoute = OutputRoute.SPEAKER,
    val privateMode: Boolean = false,
)
