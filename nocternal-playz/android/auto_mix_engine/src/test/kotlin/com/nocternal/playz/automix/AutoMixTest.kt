package com.nocternal.playz.automix

import com.nocternal.playz.model.MusicalKey
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AutoMixTest {
    private fun t(id: String, bpm: Float?, key: String?, energy: Float = 0.6f, dur: Long = 240_000) =
        Track(id = id, uri = "", title = id, bpm = bpm, camelotKey = key, energy = energy, durationMs = dur)

    @Test fun keyRelations() {
        val am = MusicalKey.fromCamelot("8A")
        assertEquals(KeyRelation.SAME, Harmonic.relation(am, MusicalKey.fromCamelot("8A")))
        assertEquals(KeyRelation.RELATIVE, Harmonic.relation(am, MusicalKey.fromCamelot("8B")))
        assertEquals(KeyRelation.ADJACENT, Harmonic.relation(am, MusicalKey.fromCamelot("9A")))
        assertEquals(KeyRelation.ADJACENT, Harmonic.relation(MusicalKey.fromCamelot("12A"), MusicalKey.fromCamelot("1A")))
        assertEquals(KeyRelation.ENERGY_BOOST, Harmonic.relation(am, MusicalKey.fromCamelot("10A")))
        assertEquals(KeyRelation.CLASH, Harmonic.relation(am, MusicalKey.fromCamelot("2B")))
    }

    @Test fun halfTimeTempoMatch() {
        val m = Tempo.match(140f, 70f)
        assertEquals(1f, m.ratio, 1e-4f)
        assertTrue(m.score > 0.9f)
        assertEquals(0f, Tempo.match(128f, 100f).score)
        assertEquals(128f / 126f, Tempo.match(128f, 126f).ratio, 1e-4f)
    }

    @Test fun plannerPrefersHarmonicAndTempoMatches() {
        val cur = t("cur", 128f, "8A")
        val pool = listOf(t("clash", 128f, "3B"), t("perfect", 127f, "9A"), t("slow", 90f, "8A"), t("cur", 128f, "8A"))
        val ranked = AutoMixPlanner().rank(cur, pool)
        assertEquals("perfect", ranked.first().track.id)
        assertTrue(ranked.none { it.track.id == "cur" })
    }

    @Test fun transitionIsBarAligned() {
        val p = AutoMixPlanner().plan(t("a", 120f, "8A"), t("b", 122f, "8A"))
        val barMs = 2000.0
        assertEquals(16000L, p.durationMs) // 8 bars at 120 BPM, capped at 16 s
        assertEquals(0.0, p.startAtMs % barMs, 1.0)
        assertTrue(p.bassSwap)
    }

    @Test fun autoFaderEnvelope() {
        val f = AutoFader(3000, 3000)
        assertEquals(0f, f.volumeAt(0, 60_000), 1e-4f)
        assertEquals(0.5f, f.volumeAt(1500, 60_000), 1e-4f)
        assertEquals(1f, f.volumeAt(30_000, 60_000), 1e-4f)
        assertEquals(0.5f, f.volumeAt(58_500, 60_000), 1e-4f)
    }

    @Test fun equalPowerKeepsEnergy() {
        for (i in 0..10) {
            val g = Crossfade.gains(i / 10f, CrossfadeCurve.EQUAL_POWER)
            assertEquals(1f, g.outgoing * g.outgoing + g.incoming * g.incoming, 1e-4f)
        }
    }
}
