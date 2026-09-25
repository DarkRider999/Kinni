package com.nocternal.playz.model

/**
 * One analysis frame of the audio that is actually playing (post-FX). Drives the light bar, edge lighting
 * and all ten lighting animations. All values are 0..1.
 */
data class SpectrumFrame(
    /** Log-spaced bands from ~30 Hz to ~16 kHz. */
    val bands: FloatArray,
    val bass: Float,
    val mid: Float,
    val treble: Float,
    /** Overall level. */
    val level: Float,
    /** True on a detected beat/bass onset. */
    val beat: Boolean,
    val timestampMs: Long = 0,
) {
    override fun equals(other: Any?): Boolean = other is SpectrumFrame && other.timestampMs == timestampMs && other.bands.contentEquals(bands)
    override fun hashCode(): Int = bands.contentHashCode() * 31 + timestampMs.hashCode()

    companion object {
        const val BAND_COUNT = 32
        val SILENT = SpectrumFrame(FloatArray(BAND_COUNT), 0f, 0f, 0f, 0f, false)
    }
}
