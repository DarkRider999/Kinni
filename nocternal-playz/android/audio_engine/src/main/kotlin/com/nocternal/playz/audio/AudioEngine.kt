package com.nocternal.playz.audio

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import com.nocternal.playz.automix.AutoFader
import com.nocternal.playz.automix.AutoMixPlanner
import com.nocternal.playz.fx.EnhancerMode
import com.nocternal.playz.fx.FxChain
import com.nocternal.playz.fx.FxSettings
import com.nocternal.playz.fx.SongEnhancer
import com.nocternal.playz.fx.analysis.LoudnessNormalizer
import com.nocternal.playz.model.AppSettings
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.EqPreset
import com.nocternal.playz.model.RepeatMode
import com.nocternal.playz.model.SpectrumFrame
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.EQManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class PlaybackState(
    val track: Track? = null,
    val isPlaying: Boolean = false,
    val buffering: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val queue: List<Track> = emptyList(),
    val index: Int = -1,
    val shuffle: Boolean = false,
    val repeat: RepeatMode = RepeatMode.OFF,
    val source: AudioSource = AudioSource.LOCAL,
    /** Genre of the playlist the queue came from, for theme context. */
    val queueGenreId: String? = null,
    val autoMix: Boolean = false,
    val error: String? = null,
)

sealed interface PlaybackEvent {
    data class TrackStarted(val track: Track, val queueGenreId: String?) : PlaybackEvent
    data class TrackFinished(val track: Track, val listenedMs: Long) : PlaybackEvent
}

/**
 * The audio engine (spec §2): ExoPlayer + the Kotlin FX chain, with gapless playback, the 3 s auto-fader,
 * crossfade duration, smart normalization, sleep timer, speaker boost/safe mode, DJ auto-mix queueing and a
 * live spectrum for the lighting. One instance per process, created by the Application on the main thread.
 */
@OptIn(UnstableApi::class)
class AudioEngine(
    context: Context,
    private val scope: CoroutineScope,
    /** Library tracks the auto-mixer may pick from. */
    private val autoMixPool: () -> List<Track> = { emptyList() },
) : EQManager {
    val fx = FxChain()
    private val processor = FxAudioProcessor(fx)
    private val routeMonitor = OutputRouteMonitor(context)

    val player: ExoPlayer = ExoPlayer.Builder(context, object : DefaultRenderersFactory(context) {
        override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioTrackPlaybackParams: Boolean): AudioSink =
            DefaultAudioSink.Builder(context)
                .setAudioProcessors(arrayOf<AudioProcessor>(processor))
                .build()
    })
        .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_NETWORK)
        .build()

    private val _state = MutableStateFlow(PlaybackState())
    val state: StateFlow<PlaybackState> = _state.asStateFlow()

    private val _fxSettings = MutableStateFlow(FxSettings())
    val fxSettings: StateFlow<FxSettings> = _fxSettings.asStateFlow()

    private val _spectrum = MutableStateFlow(SpectrumFrame.SILENT)
    val spectrum: StateFlow<SpectrumFrame> = _spectrum.asStateFlow()

    private val _events = MutableSharedFlow<PlaybackEvent>(extraBufferCapacity = 32)
    val events: SharedFlow<PlaybackEvent> = _events.asSharedFlow()

    val sleepTimer = SleepTimer(scope, onExpire = { player.pause() })
    val route get() = routeMonitor.route

    private var settings = AppSettings()
    private val autoFader = AutoFader()
    private val planner = AutoMixPlanner()
    private val queueTracks = LinkedHashMap<String, Track>()
    private var listenedMs = 0L
    private var lastTick = 0L
    private val recentlyMixed = ArrayDeque<String>()

    init {
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = onTrackChanged()
            override fun onIsPlayingChanged(isPlaying: Boolean) = _state.update { it.copy(isPlaying = isPlaying) }
            override fun onPlaybackStateChanged(playbackState: Int) {
                _state.update { it.copy(buffering = playbackState == Player.STATE_BUFFERING) }
                if (playbackState == Player.STATE_ENDED) finishCurrent()
            }
            override fun onPlayerError(error: PlaybackException) = _state.update { it.copy(error = error.message ?: "Playback error") }
        })
        routeMonitor.start()
        scope.launch { routeMonitor.route.collect { r -> updateFx { it.copy(route = r) } } }
        startTicker()
    }

    // ---- Queue & transport -------------------------------------------------------------------------

    fun playQueue(tracks: List<Track>, startIndex: Int = 0, queueGenreId: String? = null, source: AudioSource = AudioSource.LOCAL) {
        if (tracks.isEmpty()) return
        finishCurrent()
        queueTracks.clear()
        tracks.forEach { queueTracks[it.id] = it }
        _state.update { it.copy(queue = tracks, queueGenreId = queueGenreId, source = source, error = null) }
        player.setMediaItems(tracks.map(::toMediaItem), startIndex.coerceIn(0, tracks.size - 1), 0L)
        player.prepare()
        player.play()
    }

    /** Internet radio or any direct stream URL. */
    fun playStream(url: String, title: String, subtitle: String, genreTag: String? = null, artworkUrl: String? = null) {
        val t = Track(id = "stream:$url", uri = url, title = title, artist = subtitle, genreTag = genreTag, artworkUri = artworkUrl, source = AudioSource.RADIO)
        playQueue(listOf(t), source = AudioSource.RADIO)
    }

    fun togglePlay() = if (player.isPlaying) player.pause() else { if (player.playbackState == Player.STATE_IDLE) player.prepare(); player.play() }
    fun play() = player.play()
    fun pause() = player.pause()
    fun next() = player.seekToNextMediaItem()
    fun previous() = player.seekToPrevious()
    fun seekTo(ms: Long) = player.seekTo(ms)
    fun skipTo(index: Int) = player.seekTo(index, 0L)

    fun setShuffle(on: Boolean) { player.shuffleModeEnabled = on; _state.update { it.copy(shuffle = on) } }
    fun cycleRepeat() {
        val next = when (_state.value.repeat) { RepeatMode.OFF -> RepeatMode.ALL; RepeatMode.ALL -> RepeatMode.ONE; RepeatMode.ONE -> RepeatMode.OFF }
        player.repeatMode = when (next) { RepeatMode.OFF -> Player.REPEAT_MODE_OFF; RepeatMode.ALL -> Player.REPEAT_MODE_ALL; RepeatMode.ONE -> Player.REPEAT_MODE_ONE }
        _state.update { it.copy(repeat = next) }
    }

    fun volumeStep(up: Boolean) { player.volume = (player.volume + if (up) 0.1f else -0.1f).coerceIn(0f, 1f) }

    fun addNext(track: Track) {
        queueTracks[track.id] = track
        val at = (player.currentMediaItemIndex + 1).coerceAtMost(player.mediaItemCount)
        player.addMediaItem(at, toMediaItem(track))
        _state.update { it.copy(queue = currentQueue()) }
    }

    fun setAutoMix(on: Boolean) { _state.update { it.copy(autoMix = on) }; if (on) queueAutoMixNext() }

    // ---- FX ----------------------------------------------------------------------------------------

    fun updateFx(block: (FxSettings) -> FxSettings) {
        val next = block(_fxSettings.value)
        _fxSettings.value = next
        fx.update(next)
    }

    override fun applyPreset(preset: EqPreset) = updateFx { it.withEqPreset(preset) }

    fun enhance(mode: EnhancerMode) = updateFx { SongEnhancer.apply(it, mode) }

    fun applySettings(s: AppSettings) {
        settings = s
        autoFader.fadeOutMs = if (s.autoFaderEnabled) (s.crossfadeSeconds * 1000).toLong() else 0
        autoFader.fadeInMs = autoFader.fadeOutMs
        updateFx { it.copy(safeMode = s.speakerSafeMode) }
        applyNormalization(_state.value.track)
    }

    fun setSpeakerBoost(on: Boolean) = updateFx { it.copy(speakerBoost = on) }

    // ---- Internals ---------------------------------------------------------------------------------

    private fun onTrackChanged() {
        finishCurrent()
        val id = player.currentMediaItem?.mediaId
        val track = id?.let { queueTracks[it] }
        _state.update { it.copy(track = track, index = player.currentMediaItemIndex, durationMs = 0, positionMs = 0, queue = currentQueue(), error = null) }
        // Beat-match the auto-mixed track to the previous tempo (time-stretch keeps the pitch).
        val ratio = pendingTempo?.takeIf { it.first == track?.id }?.second ?: 1f
        player.playbackParameters = if (ratio != 1f) PlaybackParameters(ratio) else PlaybackParameters.DEFAULT
        pendingTempo = null
        if (track != null) {
            applyNormalization(track)
            _events.tryEmit(PlaybackEvent.TrackStarted(track, _state.value.queueGenreId))
            if (_state.value.autoMix) queueAutoMixNext()
        }
        if (sleepTimer.consumeEndOfTrack() && player.currentMediaItemIndex > 0) player.pause()
    }

    private fun finishCurrent() {
        val t = _state.value.track ?: return
        if (listenedMs > 0) _events.tryEmit(PlaybackEvent.TrackFinished(t, listenedMs))
        listenedMs = 0
    }

    private fun applyNormalization(track: Track?) {
        val gain = if (settings.normalization && track != null && track.source == AudioSource.LOCAL) LoudnessNormalizer.gainDb(track.replayGainDb, track.loudnessDb) else 0f
        updateFx { it.copy(normalizationGainDb = gain) }
    }

    /** DJ auto-mix: make sure the next item is the best key/tempo match from the library and beat-match it. */
    private fun queueAutoMixNext() {
        val current = _state.value.track ?: return
        if (current.source != AudioSource.LOCAL) return
        recentlyMixed.addLast(current.id); while (recentlyMixed.size > 30) recentlyMixed.removeFirst()
        val pick = planner.next(current, autoMixPool(), recentlyMixed.toSet()) ?: return
        val nextIndex = player.currentMediaItemIndex + 1
        val alreadyNext = nextIndex < player.mediaItemCount && player.getMediaItemAt(nextIndex).mediaId == pick.track.id
        if (!alreadyNext) addNext(pick.track)
        val plan = planner.plan(current, pick.track, defaultFadeMs = (settings.crossfadeSeconds * 1000).toLong())
        autoFader.fadeOutMs = plan.durationMs.coerceAtMost(12_000)
        autoFader.fadeInMs = autoFader.fadeOutMs
        pendingTempo = pick.track.id to plan.tempoRatio
    }

    /** Beat-match rate for the auto-mixed track, applied when that track starts. */
    private var pendingTempo: Pair<String, Float>? = null

    private fun startTicker() = scope.launch {
        var frame = 0
        while (isActive) {
            val now = System.currentTimeMillis()
            if (player.isPlaying && lastTick != 0L) listenedMs += now - lastTick
            lastTick = now
            val pos = player.currentPosition
            val dur = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0L
            // Fader = auto-fader envelope × sleep fade. Streams and gapless mode skip the envelope.
            val t = _state.value.track
            val envelope = if (t != null && t.source == AudioSource.LOCAL && dur > 0 && autoFader.fadeOutMs > 0) autoFader.volumeAt(pos, dur) else 1f
            fx.faderLevel = envelope * sleepTimer.fadeLevel
            processor.analyzer?.let { a ->
                _spectrum.value = if (player.isPlaying) a.compute(now) else decay(_spectrum.value)
            }
            if (frame++ % 8 == 0) _state.update { it.copy(positionMs = pos, durationMs = dur) }
            delay(33)
        }
    }

    private fun decay(f: SpectrumFrame) = SpectrumFrame(FloatArray(f.bands.size) { f.bands[it] * 0.85f }, f.bass * 0.85f, f.mid * 0.85f, f.treble * 0.85f, f.level * 0.85f, false, f.timestampMs)

    private fun currentQueue(): List<Track> = (0 until player.mediaItemCount).mapNotNull { queueTracks[player.getMediaItemAt(it).mediaId] }

    private fun toMediaItem(t: Track): MediaItem = MediaItem.Builder()
        .setMediaId(t.id)
        .setUri(t.uri)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(t.title)
                .setArtist(t.artist)
                .setAlbumTitle(t.album)
                .setGenre(t.genreTag)
                .setArtworkUri(t.artworkUri?.let(Uri::parse))
                .setIsPlayable(true)
                .setIsBrowsable(false)
                .build(),
        )
        .build()

    fun release() {
        routeMonitor.stop()
        player.release()
    }
}
