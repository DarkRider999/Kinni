package com.nocternal.playz.fx

/** AI Song Enhancer modes (spec §4). Each maps to a tuned combination of the DSP blocks. */
enum class EnhancerMode(val label: String, val description: String) {
    CLARITY("Clarity", "Lifts presence and air, tames boxy low-mids, gentle glue compression"),
    NOISE_REMOVAL("Noise removal", "Cuts rumble and hiss and pushes background noise down between phrases"),
    BASS_ENHANCEMENT("Bass enhancement", "Tight sub and kick boost with saturation, limiter-safe"),
    VOCAL_FOCUS("Vocal focus", "Brings voices forward for podcasts, bhajans and old recordings"),
    OLD_RECORDING("Restore old recording", "Noise removal + warmth + mild widening for mono-era classics"),
}

object SongEnhancer {
    fun apply(base: FxSettings, mode: EnhancerMode, strength: Float = 1f): FxSettings {
        val k = strength.coerceIn(0f, 1f)
        fun add(gains: List<Float>) = base.eqGainsDb.zip(gains) { a, b -> (a + b * k).coerceIn(-12f, 12f) }
        return when (mode) {
            EnhancerMode.CLARITY -> base.copy(
                eqGainsDb = add(listOf(0f, 0f, -1f, -2f, -1f, 0f, 2f, 3f, 3f, 2f)),
                compressor = CompressorParams(enabled = true, thresholdDb = -20f, ratio = 2f, makeupDb = 2f),
            )
            EnhancerMode.NOISE_REMOVAL -> base.copy(noiseReduction = 0.7f * k)
            EnhancerMode.BASS_ENHANCEMENT -> base.copy(
                bassBoost = (base.bassBoost + 0.5f * k).coerceAtMost(1f),
                eqGainsDb = add(listOf(2f, 2f, 1f, -1f, 0f, 0f, 0f, 0f, 0f, 0f)),
                preampDb = base.preampDb - 2f * k,
            )
            EnhancerMode.VOCAL_FOCUS -> base.copy(
                eqGainsDb = add(listOf(-3f, -2f, -1f, 0f, 1f, 3f, 3f, 2f, 0f, -1f)),
                compressor = CompressorParams(enabled = true, thresholdDb = -22f, ratio = 3f, makeupDb = 3f),
                stereoWidth = 0.9f,
            )
            EnhancerMode.OLD_RECORDING -> base.copy(
                noiseReduction = 0.6f * k,
                eqGainsDb = add(listOf(1f, 2f, 2f, 1f, 0f, 0f, 1f, 1f, -1f, -3f)),
                stereoWidth = 1f + 0.3f * k,
                surround3d = (base.surround3d + 0.2f * k).coerceAtMost(1f),
            )
        }
    }
}
