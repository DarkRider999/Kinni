package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JourneyPlannerTest {
    private val planner = JourneyPlanner()

    private fun house(id: String, bpm: Float, energy: Float, key: String) =
        Track(id, "", id, genreTag = "EDM", bpm = bpm, energy = energy, camelotKey = key, durationMs = 180_000)

    private val library = listOf(
        house("h1", 124f, 0.7f, "8A"), house("h2", 124f, 0.72f, "9A"), house("h3", 125f, 0.75f, "8B"),
        house("h4", 126f, 0.8f, "10A"), house("h5", 123f, 0.68f, "7A"),
        Track("calm1", "", "Quiet Piano", energy = 0.1f, durationMs = 180_000),
    )

    @Test fun honorsRequestedDurationWithTrackCount() {
        // 5 three-minute (180s) tracks fill 15 minutes; ask for 15 minutes, expect close to 5 slots.
        val plan = planner.plan("15 minute progressive house journey", library, emptyList(), hourOfDay = 22, nowPlaying = null)!!
        assertTrue(plan.trackCount in 3..5)
        assertTrue(plan.steps.all { it.track.id.startsWith("h") })
    }

    @Test fun firstStepHasNoTransitionIn() {
        val plan = planner.plan("house journey", library, emptyList(), hourOfDay = 22, nowPlaying = null)!!
        assertEquals(null, plan.steps.first().transitionIn)
    }

    @Test fun laterStepsCarryATransitionExplanation() {
        val plan = planner.plan("house journey", library, emptyList(), hourOfDay = 22, nowPlaying = null)!!
        plan.steps.drop(1).forEach { assertTrue(it.transitionIn != null) }
    }

    @Test fun energyCurveMatchesStepEnergies() {
        val plan = planner.plan("house journey", library, emptyList(), hourOfDay = 22, nowPlaying = null)!!
        assertEquals(plan.steps.map { it.energy }, plan.energyCurve)
    }

    @Test fun fallsBackToWholeLibraryWhenPromptMatchesNothing() {
        val plan = planner.plan("asdkjhasdasd", library, emptyList(), hourOfDay = 12, nowPlaying = null)
        assertTrue(plan != null && plan.trackCount > 0)
    }

    @Test fun emptyLibraryYieldsNoPlan() {
        assertEquals(null, planner.plan("house journey", emptyList(), emptyList(), hourOfDay = 12, nowPlaying = null))
    }
}
