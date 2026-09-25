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

    @Test fun keywordsAreWholeWords() {
        assertEquals("sleep", detector.detect(t("Gentle rain for sleeping", folder = "Music/Nature"))!!.genre.id)
        // "rain" must not match inside "trance"; "chill" must not match "chillhop".
        assertEquals("trance", detector.detect(t("Trance Nation 04"))!!.genre.id)
        assertEquals("lofi", detector.detect(t("Chillhop Essentials"))!!.genre.id)
        assertEquals("hindi_classics", detector.detect(t("Chaudhvin Ka Chand", artist = "Mohammed Rafi"))!!.genre.id)
    }

    @Test fun tempoFallbackAndUnknown() {
        assertEquals("trance", detector.detect(t("untitled", bpm = 140f, energy = 0.8f))!!.genre.id)
        assertEquals("workout", detector.detect(t("untitled", bpm = 172f, energy = 0.9f))!!.genre.id)
        assertNull(detector.detect(t("untitled")))
        assertEquals("podcast_mode", detector.detect(t("Episode", podcast = true))!!.genre.id)
    }
}
