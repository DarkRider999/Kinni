package com.nocternal.playz.fx.analysis

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BeatGridTest {
    @Test fun beatsAreSpacedByTheBpmPeriod() {
        // 120 BPM = 500ms per beat.
        val beats = BeatGrid.beatsMs(durationMs = 2000, bpm = 120f)
        assertEquals(listOf(0L, 500L, 1000L, 1500L), beats)
    }

    @Test fun barsAreEveryFourthBeat() {
        val bars = BeatGrid.barsMs(durationMs = 4000, bpm = 120f)
        assertEquals(listOf(0L, 2000L), bars)
    }

    @Test fun invalidInputsGiveNoBeats() {
        assertTrue(BeatGrid.beatsMs(1000, 0f).isEmpty())
        assertTrue(BeatGrid.beatsMs(0, 120f).isEmpty())
    }

    @Test fun firstBeatOffsetShiftsTheGrid() {
        val beats = BeatGrid.beatsMs(durationMs = 1500, bpm = 120f, firstBeatMs = 200f)
        assertEquals(listOf(200L, 700L, 1200L), beats)
    }
}
