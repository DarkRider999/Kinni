package com.nocternal.playz.fx.analysis

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WaveformPeaksTest {
    @Test fun emptyInputGivesEmptyOutput() {
        assertEquals(emptyList<Float>(), WaveformPeaks.normalize(FloatArray(0)))
    }

    @Test fun scalesToTheLoudestBinWithAFloorForSilence() {
        val result = WaveformPeaks.normalize(floatArrayOf(0f, 0.5f, 1f))
        assertEquals(3, result.size)
        assertEquals(0.08f, result[0], 1e-6f)
        assertEquals(1f, result[2], 1e-6f)
        assertTrue(result[1] in 0.08f..1f)
    }

    @Test fun neverExceedsOneOrGoesBelowFloor() {
        val result = WaveformPeaks.normalize(floatArrayOf(-3f, 0f, 2f, 9999f))
        result.forEach { assertTrue(it in 0.08f..1f) }
    }
}
