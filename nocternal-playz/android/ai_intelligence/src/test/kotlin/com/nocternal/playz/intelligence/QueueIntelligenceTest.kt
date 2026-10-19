package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QueueIntelligenceTest {
    private val qi = QueueIntelligence()
    private val current = Track("now", "", "Now Playing", energy = 0.5f, bpm = 120f)
    private val pool = listOf(
        current,
        Track("high1", "", "Peak Energy", energy = 0.95f, bpm = 140f),
        Track("high2", "", "Big Drop", energy = 0.9f, bpm = 138f),
        Track("low1", "", "Soft Wind Down", energy = 0.1f, bpm = 80f),
        Track("low2", "", "Quiet Close", energy = 0.15f, bpm = 85f),
    )

    @Test fun buildEnergyPrefersHigherEnergyTracks() {
        val result = qi.apply(QueueAction.BUILD_ENERGY, current, pool)
        assertTrue(result.isNotEmpty())
        assertTrue(result.first().track.id.startsWith("high"))
    }

    @Test fun coolDownPrefersLowerEnergyTracks() {
        val result = qi.apply(QueueAction.COOL_DOWN, current, pool)
        assertTrue(result.isNotEmpty())
        assertTrue(result.first().track.id.startsWith("low"))
    }

    @Test fun neverSuggestsTheCurrentTrack() {
        QueueAction.entries.forEach { action ->
            val result = qi.apply(action, current, pool)
            assertTrue(result.none { it.track.id == "now" })
        }
    }

    @Test fun excludeSetIsRespected() {
        val result = qi.apply(QueueAction.SURPRISE_ME, current, pool, exclude = setOf("high1", "high2", "low1", "low2"))
        assertTrue(result.isEmpty())
    }

    @Test fun suggestionsCarryAnExplanation() {
        val result = qi.apply(QueueAction.KEEP_VIBE, current, pool)
        assertTrue(result.all { it.why.reasons.isNotEmpty() })
    }

    @Test fun emptyPoolYieldsNoSuggestions() {
        assertTrue(qi.apply(QueueAction.SURPRISE_ME, current, emptyList()).isEmpty())
    }
}
