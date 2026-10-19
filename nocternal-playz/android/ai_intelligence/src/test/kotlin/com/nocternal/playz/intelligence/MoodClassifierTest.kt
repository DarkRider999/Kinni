package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MoodClassifierTest {
    private val classifier = MoodClassifier()

    @Test fun devotionalGenreTagWinsAsSpiritual() {
        val c = classifier.classify(Track("t1", "", "Morning Aarti", genreTag = "Bhajan", energy = 0.3f))
        assertEquals(Mood.SPIRITUAL, c.mood)
    }

    @Test fun highEnergyHeavyTrackIsAggressive() {
        val c = classifier.classify(Track("t2", "", "Hard Techno Drop", bpm = 150f, energy = 0.9f, camelotKey = "2A"))
        assertEquals(Mood.AGGRESSIVE, c.mood)
    }

    @Test fun lowEnergyTrackIsCalmOrSleepy() {
        val c = classifier.classify(Track("t3", "", "Ambient Drift", energy = 0.1f, camelotKey = "4B"))
        assertTrue(c.mood == Mood.CALM || c.mood == Mood.SLEEPY)
    }

    @Test fun confidenceStaysInBounds() {
        val c = classifier.classify(Track("t4", "", "Random Track"))
        assertTrue(c.confidence in 0f..0.95f)
    }

    @Test fun reasonIsNeverBlank() {
        val c = classifier.classify(Track("t5", "", "Another Track"))
        assertTrue(c.reason.isNotBlank())
    }
}
