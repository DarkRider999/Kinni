package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CrowdEnergyModeTest {
    private val pool = listOf(
        Track("low1", "", "Soft Intro", energy = 0.2f),
        Track("mid1", "", "Groove", energy = 0.5f),
        Track("high1", "", "Peak Drop", energy = 0.9f),
        Track("high2", "", "Second Peak", energy = 0.85f),
    )

    @Test fun sixPresetsExist() {
        assertEquals(6, CrowdEnergyPresets.all.size)
    }

    @Test fun buildFollowsRisingShape() {
        val curve = CrowdEnergyPresets.BUILD
        val queue = CrowdEnergyBuilder().build(curve, pool)
        assertTrue(queue.isNotEmpty())
        assertEquals("low1", queue.first().id)
    }

    @Test fun eachTrackUsedAtMostOnce() {
        val queue = CrowdEnergyBuilder().build(CrowdEnergyPresets.PEAK_TIME, pool)
        assertEquals(queue.size, queue.map { it.id }.distinct().size)
    }

    @Test fun emptyPoolYieldsEmptyQueue() {
        assertTrue(CrowdEnergyBuilder().build(CrowdEnergyPresets.WARM_UP, emptyList()).isEmpty())
    }

    @Test fun byIdLooksUpKnownPreset() {
        assertEquals(CrowdEnergyPresets.COOL_DOWN, CrowdEnergyPresets.byId("cool_down"))
        assertEquals(null, CrowdEnergyPresets.byId("nonexistent"))
    }
}
