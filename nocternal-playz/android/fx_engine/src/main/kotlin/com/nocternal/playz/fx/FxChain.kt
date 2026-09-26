package com.nocternal.playz.fx

import com.nocternal.playz.fx.dsp.BassBoost
import com.nocternal.playz.fx.dsp.Biquad
import com.nocternal.playz.fx.dsp.Compressor
import com.nocternal.playz.fx.dsp.Flanger
import com.nocternal.playz.fx.dsp.Limiter
import com.nocternal.playz.fx.dsp.NoiseReducer
import com.nocternal.playz.fx.dsp.Phaser
import com.nocternal.playz.fx.dsp.PitchShifter
import com.nocternal.playz.fx.dsp.Reverb
import com.nocternal.playz.fx.dsp.SmoothGain
import com.nocternal.playz.fx.dsp.StereoWidener
import com.nocternal.playz.fx.dsp.Surround3D
import com.nocternal.playz.fx.dsp.TenBandEqualizer
import com.nocternal.playz.fx.dsp.VocalRemover
import kotlin.math.pow

/**
 * The full effect chain, run on the audio thread over interleaved stereo floats:
 *
 *   normalization → noise reduction → vocal remover → 10-band EQ → bass boost → compressor
 *   → pitch shift → flanger → phaser → stereo width → 3D surround → reverb → speaker HPF
 *   → boost (loudness + speaker) → fader (auto-fader / crossfade / sleep fade) → limiter
 *
 * Settings are swapped with [update] from any thread; the audio thread picks up the new snapshot at the next
 * buffer. Effects that are off cost nothing.
 */
class FxChain {
    @Volatile private var pending: FxSettings = FxSettings()
    private var applied: FxSettings? = null
    private var sampleRate = 48000

    private val normalization = SmoothGain()
    private val noise = NoiseReducer()
    private val vocal = VocalRemover()
    private val eq = TenBandEqualizer()
    private val bass = BassBoost()
    private val compressor = Compressor()
    private val pitch = PitchShifter()
    private val flanger = Flanger()
    private val phaser = Phaser()
    private val widener = StereoWidener()
    private val surround = Surround3D()
    private val reverb = Reverb()
    private val speakerHpf = Biquad()
    private val boost = SmoothGain()
    private val fader = SmoothGain()
    private val limiter = Limiter()

    private val all = listOf(normalization, noise, vocal, eq, bass, compressor, pitch, flanger, phaser, widener, surround, reverb, boost, fader, limiter)

    val settings: FxSettings get() = pending

    /** 0..1 fader driven by the auto-fader, crossfader and sleep timer. */
    @Volatile var faderLevel: Float = 1f

    fun prepare(sampleRate: Int) {
        this.sampleRate = sampleRate
        all.forEach { it.prepare(sampleRate) }
        speakerHpf.setHighPass(sampleRate.toFloat(), 120f)
        applied = null
    }

    fun update(settings: FxSettings) { pending = settings }

    fun reset() { all.forEach { it.reset() }; speakerHpf.reset() }

    /** Processes [frames] interleaved stereo frames in place. */
    fun process(buffer: FloatArray, frames: Int) {
        val s = pending
        if (s !== applied) { apply(s); applied = s }
        fader.target = faderLevel.coerceIn(0f, 1f) // callers pass equal-power / perceptual gains
        normalization.process(buffer, frames)
        noise.process(buffer, frames)
        vocal.process(buffer, frames)
        if (s.eqEnabled) eq.process(buffer, frames)
        bass.process(buffer, frames)
        compressor.process(buffer, frames)
        pitch.process(buffer, frames)
        flanger.process(buffer, frames)
        phaser.process(buffer, frames)
        widener.process(buffer, frames)
        surround.process(buffer, frames)
        reverb.process(buffer, frames)
        if (s.speakerBoost && s.route == OutputRoute.SPEAKER) {
            for (f in 0 until frames) {
                buffer[2 * f] = speakerHpf.processL(buffer[2 * f]); buffer[2 * f + 1] = speakerHpf.processR(buffer[2 * f + 1])
            }
        }
        boost.process(buffer, frames)
        fader.process(buffer, frames)
        limiter.process(buffer, frames)
    }

    /** Convenience for 16-bit PCM sinks (Android AudioProcessor). [pcm] is interleaved stereo. */
    fun process16(pcm: ShortArray, frames: Int, scratch: FloatArray) {
        for (i in 0 until frames * 2) scratch[i] = pcm[i] / 32768f
        process(scratch, frames)
        for (i in 0 until frames * 2) pcm[i] = (scratch[i] * 32767f).toInt().coerceIn(-32768, 32767).toShort()
    }

    private fun apply(s: FxSettings) {
        normalization.target = 10f.pow(s.normalizationDb() / 20f)
        noise.amount = s.noiseReduction
        vocal.amount = s.vocalRemover
        eq.setGains(s.eqGainsDb, s.preampDb)
        bass.set(s.bassBoost)
        with(compressor) {
            enabled = s.compressor.enabled; thresholdDb = s.compressor.thresholdDb; ratio = s.compressor.ratio
            kneeDb = s.compressor.kneeDb; attackMs = s.compressor.attackMs; releaseMs = s.compressor.releaseMs; makeupDb = s.compressor.makeupDb
        }
        pitch.semitones = s.pitchSemitones
        with(flanger) { mix = if (s.flanger.enabled) s.flanger.mix else 0f; rateHz = s.flanger.rateHz; depthMs = s.flanger.depthMs; feedback = s.flanger.feedback }
        with(phaser) { mix = if (s.phaser.enabled) s.phaser.mix else 0f; rateHz = s.phaser.rateHz; depth = s.phaser.depth; feedback = s.phaser.feedback; stages = s.phaser.stages }
        widener.width = s.stereoWidth
        surround.amount = s.surround3d
        with(reverb) { wet = if (s.reverb.enabled) s.reverb.wet else 0f; roomSize = s.reverb.roomSize; damping = s.reverb.damping }
        boost.target = 10f.pow(s.boostDb() / 20f)
        limiter.ceilingDb = s.limiterCeilingDb()
    }

    /** EQ curve for the UI (dB at each frequency). */
    fun eqResponseDb(frequencies: FloatArray): FloatArray = FloatArray(frequencies.size) { eq.responseDb(frequencies[it]).toFloat() }
}
