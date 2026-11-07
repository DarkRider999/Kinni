package com.nocternal.playz.ui.dj

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.audio.SamplerEngine
import com.nocternal.playz.database.NocternalDatabase
import com.nocternal.playz.database.entity.CuePointEntity
import com.nocternal.playz.database.entity.TrackEntity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DjHubViewModel(
    private val db: NocternalDatabase,
    private val onFxUpdate: (reverb: Boolean, delay: Boolean, flanger: Boolean, echo: Boolean, phaser: Boolean, filter: Boolean) -> Unit = { _, _, _, _, _, _ -> },
    private val onAdvancedFxUpdate: (roll: Boolean, beatRepeat: Boolean, gate: Boolean, reverse: Boolean, brake: Boolean, spinBack: Boolean, vinylStop: Boolean) -> Unit = { _, _, _, _, _, _, _ -> },
    private val triggerSampler: (Int, Int) -> Unit = { _, _ -> },
) : ViewModel() {
    private val trackDao = db.trackDao()
    private val cuePointDao = db.cuePointDao()

    val availableTracks: StateFlow<List<TrackEntity>> = trackDao.getAllTracks()
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Deck A: manually loaded by the user. */
    val currentTrack = MutableStateFlow<TrackEntity?>(null)

    /** Deck B: manually loaded by the user. */
    val nextTrack = MutableStateFlow<TrackEntity?>(null)

    /** Deck C: fourth-deck slot (visible in 4-deck mode). */
    val deckCTrack = MutableStateFlow<TrackEntity?>(null)

    /** Deck D: fourth-deck slot (visible in 4-deck mode). */
    val deckDTrack = MutableStateFlow<TrackEntity?>(null)

    val showDeckAPicker = MutableStateFlow(false)
    val showDeckBPicker = MutableStateFlow(false)
    val showDeckCPicker = MutableStateFlow(false)
    val showDeckDPicker = MutableStateFlow(false)

    val fourDeckMode = MutableStateFlow(false)

    @OptIn(ExperimentalCoroutinesApi::class)
    val cuePoints: StateFlow<List<CuePointEntity>> = currentTrack
        .flatMapLatest { track ->
            if (track == null) flowOf(emptyList()) else cuePointDao.getCuePointsForTrack(track.id)
        }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Base BPM of the mix: 128 until the user loads a track into Deck A. */
    val masterBpm = MutableStateFlow(DEFAULT_BPM)
    val tempoMultiplier = MutableStateFlow(1.0f)

    val crossfaderPosition = MutableStateFlow(0.5f)
    val deckAVolume = MutableStateFlow(1.0f)
    val deckBVolume = MutableStateFlow(1.0f)
    val deckCVolume = MutableStateFlow(1.0f)
    val deckDVolume = MutableStateFlow(1.0f)
    val eqLow = MutableStateFlow(0f)
    val eqMid = MutableStateFlow(0f)
    val eqHigh = MutableStateFlow(0f)

    val manualBpmInput = MutableStateFlow("")

    // FX toggles: REVERB, DELAY, FLANGER, ECHO, PHASER, FILTER
    val fxReverb = MutableStateFlow(false)
    val fxDelay = MutableStateFlow(false)
    val fxFlanger = MutableStateFlow(false)
    val fxEcho = MutableStateFlow(false)
    val fxPhaser = MutableStateFlow(false)
    val fxFilter = MutableStateFlow(false)

    // Advanced FX toggles: ROLL, BEAT REPEAT, GATE, REVERSE, BRAKE, SPIN BACK, VINYL STOP
    val fxRoll = MutableStateFlow(false)
    val fxBeatRepeat = MutableStateFlow(false)
    val fxGate = MutableStateFlow(false)
    val fxReverse = MutableStateFlow(false)
    val fxBrake = MutableStateFlow(false)
    val fxSpinBack = MutableStateFlow(false)
    val fxVinylStop = MutableStateFlow(false)

    val selectedSamplerBank = MutableStateFlow(0)

    fun loadTrackToDeckA(track: TrackEntity) {
        currentTrack.value = track
        showDeckAPicker.value = false
        if (track.bpm > 0f) masterBpm.value = track.bpm
    }

    fun loadTrackToDeckB(track: TrackEntity) {
        nextTrack.value = track
        showDeckBPicker.value = false
    }

    fun loadTrackToDeckC(track: TrackEntity) {
        deckCTrack.value = track
        showDeckCPicker.value = false
    }

    fun loadTrackToDeckD(track: TrackEntity) {
        deckDTrack.value = track
        showDeckDPicker.value = false
    }

    fun setCuePoint(trackId: String, positionMs: Long, label: String, isHotCue: Boolean, hotCueIndex: Int?) {
        viewModelScope.launch {
            runCatching {
                cuePointDao.insertCuePoint(
                    CuePointEntity(
                        trackId = trackId,
                        positionMs = positionMs,
                        label = label,
                        isHotCue = isHotCue,
                        hotCueIndex = hotCueIndex,
                    ),
                )
            }
        }
    }

    /** Room's @Delete matches on the primary key only, so the other fields are placeholders. */
    fun deleteCuePoint(id: Long) {
        viewModelScope.launch {
            runCatching {
                cuePointDao.deleteCuePoint(CuePointEntity(id = id, trackId = "", positionMs = 0L))
            }
        }
    }

    /** 0.0 = full deck A, 1.0 = full deck B. */
    fun updateCrossfader(position: Float) {
        crossfaderPosition.value = position.coerceIn(0f, 1f)
    }

    fun updateTempo(multiplier: Float) {
        tempoMultiplier.value = multiplier.coerceIn(MIN_TEMPO, MAX_TEMPO)
    }

    fun applyManualBpm(bpmText: String) {
        bpmText.trim().toFloatOrNull()?.let { bpm ->
            if (bpm > 0f) {
                masterBpm.value = bpm
                tempoMultiplier.value = 1f
            }
        }
    }

    /** Sync tempo so deck B's BPM matches the master BPM. */
    fun autoSyncToDeckB() {
        val deckB = nextTrack.value ?: return
        if (deckB.bpm > 0f && masterBpm.value > 0f) {
            updateTempo(deckB.bpm / masterBpm.value)
        }
    }

    fun selectBank(bank: Int) { selectedSamplerBank.value = bank.coerceIn(0, SamplerEngine.BANK_COUNT - 1) }

    fun triggerPad(index: Int) { triggerSampler(selectedSamplerBank.value, index) }

    private fun syncFx() {
        onFxUpdate(fxReverb.value, fxDelay.value, fxFlanger.value, fxEcho.value, fxPhaser.value, fxFilter.value)
    }

    private fun syncAdvancedFx() {
        onAdvancedFxUpdate(fxRoll.value, fxBeatRepeat.value, fxGate.value, fxReverse.value, fxBrake.value, fxSpinBack.value, fxVinylStop.value)
    }

    init {
        listOf(fxReverb, fxDelay, fxFlanger, fxEcho, fxPhaser, fxFilter).forEach { flow ->
            viewModelScope.launch { flow.collect { syncFx() } }
        }
        listOf(fxRoll, fxBeatRepeat, fxGate, fxReverse, fxBrake, fxSpinBack, fxVinylStop).forEach { flow ->
            viewModelScope.launch { flow.collect { syncAdvancedFx() } }
        }
    }

    class Factory(
        private val db: NocternalDatabase,
        private val onFxUpdate: (reverb: Boolean, delay: Boolean, flanger: Boolean, echo: Boolean, phaser: Boolean, filter: Boolean) -> Unit = { _, _, _, _, _, _ -> },
        private val onAdvancedFxUpdate: (roll: Boolean, beatRepeat: Boolean, gate: Boolean, reverse: Boolean, brake: Boolean, spinBack: Boolean, vinylStop: Boolean) -> Unit = { _, _, _, _, _, _, _ -> },
        private val triggerSampler: (Int, Int) -> Unit = { _, _ -> },
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(DjHubViewModel::class.java)) {
                "Unknown ViewModel class: ${modelClass.name}"
            }
            return DjHubViewModel(db, onFxUpdate, onAdvancedFxUpdate, triggerSampler) as T
        }
    }

    companion object {
        const val DEFAULT_BPM = 128f
        const val MIN_TEMPO = 0.5f
        const val MAX_TEMPO = 2.0f
    }
}
