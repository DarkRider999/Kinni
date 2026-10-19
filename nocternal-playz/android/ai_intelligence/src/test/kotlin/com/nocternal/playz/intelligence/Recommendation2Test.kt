package com.nocternal.playz.intelligence

import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Recommendation2Test {
    private val engine = RecommendationEngine2()
    private val pool = listOf(
        Track("edm1", "", "Club Anthem", genreTag = "EDM", bpm = 128f, energy = 0.9f),
        Track("edm2", "", "Rave Drop", genreTag = "EDM", bpm = 130f, energy = 0.88f),
        Track("calm1", "", "Quiet Morning", energy = 0.1f, camelotKey = "4B"),
        Track("calm2", "", "Soft Rain", energy = 0.12f, camelotKey = "4B"),
    )

    @Test fun similarToRanksSameEnergyTracksAboveOpposite() {
        val results = engine.similarTo(pool[0], pool, limit = 3)
        assertEquals("edm2", results.first().track.id)
    }

    @Test fun distanceIsZeroForIdenticalDna() {
        val dna = SongDnaAnalyzer().analyze(pool[0])
        assertEquals(0f, engine.distance(dna, dna), 0.0001f)
    }

    @Test fun profileFromAveragesTraits() {
        val profile = engine.profileFrom(listOf(pool[2], pool[3]))!!
        assertTrue(profile.dna.energy < 0.3f)
        assertEquals(2, profile.sampleSize)
    }

    @Test fun profileFromEmptyListIsNull() {
        assertEquals(null, engine.profileFrom(emptyList()))
    }

    @Test fun futureCastPrefersTracksLikeNowPlayingWhenNoHistory() {
        val cast = FutureCast(engine).predict(nowPlaying = pool[0], hourOfDay = 22, history = emptyList(), tracks = emptyMap(), pool = pool)
        assertTrue(cast.isNotEmpty())
        assertTrue(cast.first().track.id.startsWith("edm"))
    }

    @Test fun futureCastReturnsEmptyWithNoSignal() {
        val cast = FutureCast(engine).predict(nowPlaying = null, hourOfDay = 10, history = emptyList(), tracks = emptyMap(), pool = pool)
        assertTrue(cast.isEmpty())
    }

    @Test fun discoveryRadarOnlySurfacesUnplayedTracks() {
        val history = listOf(PlayEvent("edm1", 0L, 60_000, AudioSource.LOCAL))
        val gems = DiscoveryRadar(engine).forgottenGems(pool, history, favorites = setOf("edm1"))
        assertTrue(gems.none { it.track.id == "edm1" })
        assertTrue(gems.isNotEmpty())
    }
}
