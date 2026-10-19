package com.nocternal.playz.automix

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AutoSetBuilderTest {
    private fun t(id: String, bpm: Float?, key: String?, energy: Float = 0.6f) =
        Track(id = id, uri = "", title = id, bpm = bpm, camelotKey = key, energy = energy, durationMs = 240_000)

    private val pool = listOf(
        t("a", 128f, "8A"), t("b", 128f, "9A"), t("c", 128f, "8B"), t("d", 90f, "2B"), t("e", 128f, "10A"),
    )

    @Test fun firstStepHasNoTransitionIn() {
        val set = AutoSetBuilder().build(pool[0], pool, length = 3)
        assertEquals(pool[0].id, set.first().track.id)
        assertEquals(null, set.first().transitionIn)
    }

    @Test fun neverRepeatsATrack() {
        val set = AutoSetBuilder().build(pool[0], pool, length = 10)
        assertEquals(set.size, set.map { it.track.id }.distinct().size)
    }

    @Test fun stopsWhenPoolIsExhausted() {
        val set = AutoSetBuilder().build(pool[0], pool, length = 20)
        assertTrue(set.size <= pool.size)
    }

    @Test fun eachFollowingStepCarriesATransitionPlan() {
        val set = AutoSetBuilder().build(pool[0], pool, length = 4)
        set.drop(1).forEach { assertTrue(it.transitionIn != null) }
    }
}
