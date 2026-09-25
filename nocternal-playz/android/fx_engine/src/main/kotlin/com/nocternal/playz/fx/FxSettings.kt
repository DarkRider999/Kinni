package com.nocternal.playz.fx

import com.nocternal.playz.model.EqPreset
import kotlinx.serialization.Serializable

@Serializable
data class ReverbParams(val enabled: Boolean = false, val roomSize: Float = 0.5f, val damping: Float = 0.5f, val wet: Float = 0.25f)

@Serializable
data class FlangerParams(val enabled: Boolean = false, val rateHz: Float = 0.25f, val depthMs: Float = 2.5f, val feedback: Float = 0.5f, val mix: Float = 0.6f)

@Serializable
data class PhaserParams(val enabled: Boolean = false, val rateHz: Float = 0.5f, val depth: Float = 0.8f, val feedback: Float = 0.4f, val stages: Int = 6, val mix: Float = 0.7f)

@Serializable
data class CompressorParams(
    val enabled: Boolean = false, val thresholdDb: Float = -18f, val ratio: Float = 3f, val kneeDb: Float = 6f,
    val attackMs: Float = 10f, val releaseMs: Float = 120f, val makeupDb: Float = 3f,
)

/** Where audio is going. Affects speaker boost and safe-mode limits. */
@Serializable
enum class OutputRoute { SPEAKER, WIRED_HEADPHONES, BLUETOOTH, OTHER }

/** Every user-facing audio effect parameter. Immutable; the chain swaps snapshots atomically. */
@Serializable
data class FxSettings(
    val eqEnabled: Boolean = true,
    val eqGainsDb: List<Float> = List(10) { 0f },
    val preampDb: Float = 0f,
    val bassBoost: Float = 0f,
    val surround3d: Float = 0f,
    val loudnessDb: Float = 0f,
    val reverb: ReverbParams = ReverbParams(),
    val flanger: FlangerParams = FlangerParams(),
    val phaser: PhaserParams = PhaserParams(),
    val compressor: CompressorParams = CompressorParams(),
    /** 0 = mono, 1 = normal, 2 = extra wide. */
    val stereoWidth: Float = 1f,
    val pitchSemitones: Float = 0f,
    val vocalRemover: Float = 0f,
    val noiseReduction: Float = 0f,
    /** Per-track normalization gain from [LoudnessNormalizer]. */
    val normalizationGainDb: Float = 0f,
    val speakerBoost: Boolean = false,
    val safeMode: Boolean = true,
    val route: OutputRoute = OutputRoute.SPEAKER,
) {
    fun withEqPreset(p: EqPreset) = copy(
        eqGainsDb = p.bandGainsDb, preampDb = p.preampDb, bassBoost = p.bassBoost,
        surround3d = p.surround, loudnessDb = p.loudnessDb,
    )

    private val maxBoostDb: Float get() = if (safeMode) 6f else 12f

    /** Normalization gain actually applied; positive gain is limited in safe mode. */
    fun normalizationDb(): Float = normalizationGainDb.coerceIn(-12f, maxBoostDb)

    /**
     * Loudness enhancer + speaker boost gain. Together with positive normalization it never exceeds
     * 6 dB in safe mode (12 dB otherwise), protecting ears and small speakers.
     */
    fun boostDb(): Float {
        val speaker = if (speakerBoost && route == OutputRoute.SPEAKER) 4f else 0f
        val room = (maxBoostDb - normalizationDb().coerceAtLeast(0f)).coerceAtLeast(0f)
        return (loudnessDb + speaker).coerceIn(-12f, room)
    }

    fun limiterCeilingDb(): Float = if (safeMode) -1f else -0.3f
}
