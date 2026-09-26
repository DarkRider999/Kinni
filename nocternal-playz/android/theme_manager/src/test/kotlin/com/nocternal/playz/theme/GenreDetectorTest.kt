package com.nocternal.playz.theme

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GenreDetectorTest {
    private val detector = GenreDetector()
    private fun t(title: String, tag: String? = null, folder: String = "", artist: String = "", bpm: Float? = null, energy: Float? = null, podcast: Boolean = false) =
        Track(id = title, uri = "", title = title, genreTag = tag, folder = folder, artist = artist, bpm = bpm, energy = energy, isPodcast = podcast)

    @Test fun tags() {
        assertEquals("devotional", detector.detect(t("x", tag = "Bhajan"))!!.genre.id)
        assertEquals("techno", detector.detect(t("x", tag = "Hard Techno"))!!.genre.id)
        assertEquals("lofi", detector.detect(t("x", tag = "Lo-Fi Hip Hop"))!!.genre.id)
        assertEquals("trance", detector.detect(t("x", tag = "Psytrance"))!!.genre.id)
    }

    @Test fun storeTagFamilies() {
        val y = { tag: String, year: Int?, energy: Float? -> detector.detect(Track("x", "", "x", genreTag = tag, year = year, energy = energy))!!.genre.id }
        assertEquals("hindi_classics", y("Bollywood", 1975, null))
        assertEquals("romantic", y("Bollywood", 2015, 0.4f))
        assertEquals("party_mix", y("Hindi", 2019, 0.8f))
        assertEquals("workout", y("Hip-Hop/Rap", null, null))
        assertEquals("workout", y("Alternative Rock", null, null))
        assertEquals("chillout", y("Jazz", null, null))
        assertEquals("party_mix", y("Punjabi", null, null))
        assertEquals("morning_vibes", y("Pop", null, 0.4f))
        assertEquals("instrumental", y("Soundtrack", null, null))
        assertNull(detector.detect(Track("x", "", "x", genreTag = "Other")))
    }

    @Test fun keywordsAreWholeWords() {
        assertEquals("sleep", detector.detect(t("Gentle rain", folder = "Music/Sleep Sounds"))!!.genre.id)
        // Everyday words in a title are not genre evidence.
        assertNull(detector.detect(t("Purple Rain", artist = "Prince")))
        // "rain" must not match inside "trance"; "chill" must not match "chillhop".
        assertEquals("trance", detector.detect(t("Trance Nation 04"))!!.genre.id)
        assertEquals("lofi", detector.detect(t("Chillhop Essentials"))!!.genre.id)
        assertEquals("hindi_classics", detector.detect(t("Chaudhvin Ka Chand", artist = "Mohammed Rafi"))!!.genre.id)
    }

    @Test fun tempoFallbackAndUnknown() {
        assertEquals("trance", detector.detect(t("untitled", bpm = 140f, energy = 0.8f))!!.genre.id)
        assertEquals("workout", detector.detect(t("untitled", bpm = 172f, energy = 0.9f))!!.genre.id)
        assertNull(detector.detect(t("untitled")))
        // Every analysed song gets a genre.
        assertEquals("lofi", detector.detect(t("untitled", bpm = 85f, energy = 0.5f))!!.genre.id)
        assertEquals("podcast_mode", detector.detect(t("Episode", podcast = true))!!.genre.id)
    }
}
