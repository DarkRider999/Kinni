package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track
import org.junit.Assert.assertTrue
import org.junit.Test

class SongDnaAnalyzerTest {
    private val analyzer = SongDnaAnalyzer()

    @Test fun highEnergyDanceTrackScoresHigh() {
        val dna = analyzer.analyze(Track("t1", "", "Club Anthem", genreTag = "EDM", bpm = 128f, energy = 0.9f, camelotKey = "8B"))
        assertTrue(dna.energy > 0.8f)
        assertTrue(dna.danceability > 0.6f)
        assertTrue(dna.groove > 0.6f)
    }

    @Test fun podcastIsHighVocalLowInstrumental() {
        val dna = analyzer.analyze(Track("t2", "", "Episode 12", isPodcast = true))
        assertTrue(dna.vocalIntensity > 0.9f)
        assertTrue(dna.instrumentalness < 0.1f)
    }

    @Test fun instrumentalTagLowersVocalIntensity() {
        val dna = analyzer.analyze(Track("t3", "", "Main Theme (Instrumental)", energy = 0.5f))
        assertTrue(dna.instrumentalness > 0.8f)
        assertTrue(dna.vocalIntensity < 0.2f)
    }

    @Test fun minorKeyLowEnergyIsEmotionallyHeavy() {
        val dna = analyzer.analyze(Track("t4", "", "Sad Song", energy = 0.2f, camelotKey = "5A"))
        assertTrue(dna.emotion >= 0.8f)
    }

    @Test fun missingSignalsStillProduceValidRanges() {
        val dna = analyzer.analyze(Track("t5", "", "Unknown Track"))
        listOf(dna.energy, dna.danceability, dna.emotion, dna.instrumentalness, dna.vocalIntensity, dna.complexity, dna.groove)
            .forEach { assertTrue(it in 0f..1f) }
    }
}
