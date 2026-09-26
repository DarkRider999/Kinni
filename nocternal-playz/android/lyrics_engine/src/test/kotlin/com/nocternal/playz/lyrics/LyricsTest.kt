package com.nocternal.playz.lyrics

import com.nocternal.playz.model.Track
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricsTest {
    private val lrc = """
        [ti:Test]
        [offset:0]
        [00:01.00]First line
        [00:05.50][00:20.00]Chorus line
        [00:10.00]<00:10.00>Kara <00:10.50>oke <00:11.25>words
    """.trimIndent()

    @Test fun parsesSyncedAndRepeatedStamps() {
        val l = LrcParser.parse(lrc, LyricsOrigin.SIDECAR_LRC)
        assertTrue(l.synced)
        assertEquals(listOf(1000L, 5500L, 10000L, 20000L), l.lines.map { it.startMs })
        assertEquals("Kara oke words", l.lines[2].text)
        assertEquals(listOf(10000L, 10500L, 11250L), l.lines[2].words.map { it.startMs })
    }

    @Test fun syncFindsLineAndWord() {
        val l = LrcParser.parse(lrc, LyricsOrigin.SIDECAR_LRC)
        assertEquals(-1, LyricsSync.at(l, 500).lineIndex)
        assertEquals(1, LyricsSync.at(l, 6000).lineIndex)
        val p = LyricsSync.at(l, 10_750)
        assertEquals(2, p.lineIndex); assertEquals(1, p.wordIndex)
        assertEquals(1f / 3f, p.wordProgress, 0.01f)
    }

    @Test fun plainTextIsUnsynced() {
        val l = LrcParser.parse("Just words\nNo timing", LyricsOrigin.EMBEDDED)
        assertFalse(l.synced); assertEquals(2, l.lines.size)
    }

    @Test fun roundTrip() {
        val l = LrcParser.parse(lrc, LyricsOrigin.ONLINE)
        val again = LrcParser.parse(LrcParser.toLrc(l), LyricsOrigin.CACHE)
        assertEquals(l.lines, again.lines)
    }

    @Test fun repositoryIsOfflineFirstAndCachesOnline() = runTest {
        val cache = InMemoryLyricsCache()
        var onlineCalls = 0
        val online = LrcLibProvider(httpGet = { onlineCalls++; """{"syncedLyrics":"[00:01.00]Hello","plainLyrics":"Hello"}""" })
        var allowed = false
        val repo = LyricsRepository(cache, offline = listOf(SidecarLrcProvider { null }), online = listOf(online), isOnlineAllowed = { allowed })
        val t = Track("id", "/music/a.mp3", "Song", "Artist")
        assertNull(repo.lyricsFor(t))
        allowed = true
        assertEquals("Hello", repo.lyricsFor(t)!!.lines.single().text)
        allowed = false
        assertEquals(LyricsOrigin.CACHE, repo.lyricsFor(t)!!.origin)
        assertEquals(1, onlineCalls)
    }
}

class LyricsFallbackTest {
    @Test fun searchFallbackAndQueryCleaning() = kotlinx.coroutines.test.runTest {
        val (title, artist) = LyricsQuery.of(com.nocternal.playz.model.Track("1", "", "03 - Arijit Singh - Tum Hi Ho (Official Video)", "Unknown artist"))
        org.junit.Assert.assertEquals("Tum Hi Ho", title)
        org.junit.Assert.assertEquals("Arijit Singh", artist)
        val urls = mutableListOf<String>()
        val p = LrcLibProvider(httpGet = { u -> urls += u; if ("/api/get" in u) null else """[{"duration":260,"plainLyrics":"a"},{"duration":262,"syncedLyrics":"[00:01.00]Hello"}]""" })
        val l = p.find(com.nocternal.playz.model.Track("1", "", "Tum Hi Ho", "Arijit Singh", durationMs = 262_000))!!
        org.junit.Assert.assertTrue(l.synced)
        org.junit.Assert.assertTrue(urls.first().contains("/api/get"))
    }

    @Test fun everySongGetsLyricsAndRealOnesReplaceAi() = kotlinx.coroutines.test.runTest {
        val cache = InMemoryLyricsCache()
        var online = false
        val claude = object : LyricsGenerator {
            override val cacheable = true
            override suspend fun find(track: com.nocternal.playz.model.Track) = LyricsTiming.spread(listOf("one", "two", "three", "four"), 200_000, LyricsOrigin.AI_GENERATED)
        }
        val real = LrcLibProvider(httpGet = { """{"syncedLyrics":"[00:01.00]Real"}""" })
        val repo = LyricsRepository(cache, emptyList(), listOf(real), { online }, listOf(claude, LyricWeaver()))
        val t = com.nocternal.playz.model.Track("id", "", "Song", "Artist", durationMs = 200_000)
        org.junit.Assert.assertEquals(LyricsOrigin.AI_GENERATED, repo.lyricsFor(t)!!.origin)
        online = true
        org.junit.Assert.assertEquals("Real", repo.lyricsFor(t)!!.lines.single().text)
        org.junit.Assert.assertEquals(LyricsOrigin.CACHE, repo.lyricsFor(t)!!.origin)
        // On-device writer always produces something.
        org.junit.Assert.assertTrue(LyricWeaver().find(t).lines.size >= 8)
    }
}
