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
    data class ToggleSetting(val setting: AppSettingKey, val on: Boolean) : AssistantIntent
    data class SetCrossfade(val seconds: Float) : AssistantIntent
    data class Unknown(val text: String) : AssistantIntent
}

/** Every on/off app setting the bot can change directly, with the words it recognizes for each. */
enum class AppSettingKey(val label: String, val aliases: List<String>) {
    GAPLESS("Gapless playback", listOf("gapless")),
    NORMALIZATION("Smart normalization", listOf("normalization", "normalisation", "normalize", "normalise")),
    SPEAKER_SAFE_MODE("Speaker safe mode", listOf("speaker safe mode", "safe mode")),
    PRIVATE_MODE("Private mode", listOf("private mode", "incognito mode", "incognito")),
    AUTO_THEME_BY_GENRE("Auto theme by genre", listOf("auto theme by genre", "theme by genre", "genre theme")),
    AUTO_THEME_BY_MOOD("Auto theme by mood", listOf("auto theme by mood", "theme by mood", "mood theme")),
    AUTO_THEME_BY_TIME("Auto theme by time of day", listOf("auto theme by time", "theme by time", "time of day theme")),
    EQ_FOLLOWS_THEME("Theme also sets the EQ", listOf("eq follows theme", "theme sets the eq", "theme sets eq")),
    USE_WIFI("Use Wi-Fi for online features", listOf("wifi", "wi-fi")),
    USE_MOBILE_DATA("Use mobile data for online features", listOf("mobile data", "cellular data")),
    AUTO_DOWNLOAD_LYRICS("Auto-download lyrics", listOf("auto download lyrics", "download lyrics")),
    AUTO_DOWNLOAD_ARTWORK("Auto-download artwork", listOf("auto download artwork", "download artwork")),
    ;

    companion object {
        /** Longest alias first, so "speaker safe mode" matches before a looser "safe mode". */
        val byAlias: List<Pair<String, AppSettingKey>> = entries
            .flatMap { k -> k.aliases.map { it to k } }
            .sortedByDescending { it.first.length }
    }
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
    data class UpdateSetting(val setting: AppSettingKey, val on: Boolean) : AssistantAction
    data class SetCrossfadeSeconds(val seconds: Float) : AssistantAction
}

data class AssistantResponse(
    val reply: String,
    val actions: List<AssistantAction> = emptyList(),
    /** Quick-action chips shown under the reply. */
    val suggestions: List<String> = emptyList(),
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
