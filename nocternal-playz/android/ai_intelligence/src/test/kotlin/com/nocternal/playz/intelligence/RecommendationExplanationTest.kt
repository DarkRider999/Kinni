package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track
import org.junit.Assert.assertTrue
import org.junit.Test

class RecommendationExplanationTest {
    private val explain = RecommendationExplanation()

    @Test fun flagsSimilarBpm() {
        val why = explain.explain(
            Track("a", "", "Seed", bpm = 128f, energy = 0.8f),
            Track("b", "", "Candidate", bpm = 130f, energy = 0.8f),
        )
        assertTrue(why.reasons.any { it.contains("BPM") })
    }

    @Test fun flagsCompatibleKey() {
        val why = explain.explain(
            Track("a", "", "Seed", camelotKey = "8A", energy = 0.5f),
            Track("b", "", "Candidate", camelotKey = "9A", energy = 0.5f),
        )
        assertTrue(why.reasons.any { it.contains("key", ignoreCase = true) })
    }

    @Test fun flagsSameArtist() {
        val why = explain.explain(
            Track("a", "", "Seed", artist = "DJ Nova", energy = 0.5f),
            Track("b", "", "Candidate", artist = "DJ Nova", energy = 0.5f),
        )
        assertTrue(why.reasons.any { it.contains("artist", ignoreCase = true) })
    }

    @Test fun alwaysReturnsAtLeastOneReason() {
        val why = explain.explain(Track("a", "", "Seed"), Track("b", "", "Candidate"))
        assertTrue(why.reasons.isNotEmpty())
        assertTrue(why.headline.isNotBlank())
    }
}
