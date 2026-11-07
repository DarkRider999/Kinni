package com.nocternal.playz.fx.analysis

/** Normalizes raw per-bin peak amplitudes into the 0..1 range the waveform view draws bars at. */
object WaveformPeaks {
    /** A silent bin still draws a visible sliver, matching the pseudo-waveform's minimum bar height. */
    private const val FLOOR = 0.08f

    fun normalize(raw: FloatArray): List<Float> {
        if (raw.isEmpty()) return emptyList()
        val max = raw.maxOf { it.coerceAtLeast(0f) }.coerceAtLeast(1e-6f)
        return raw.map { (FLOOR + (1f - FLOOR) * (it.coerceAtLeast(0f) / max)).coerceIn(FLOOR, 1f) }
    }
}
