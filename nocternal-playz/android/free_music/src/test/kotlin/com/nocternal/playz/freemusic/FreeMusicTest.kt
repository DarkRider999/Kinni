package com.nocternal.playz.freemusic

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FreeMusicTest {
    @Test fun licenceLabels() {
        assertEquals("CC BY-SA 4.0", FreeLicense.label("https://creativecommons.org/licenses/by-sa/4.0/"))
        assertEquals("CC BY-NC-ND 3.0", FreeLicense.label("http://creativecommons.org/licenses/by-nc-nd/3.0/"))
        assertEquals("CC0 (public domain)", FreeLicense.label("http://creativecommons.org/publicdomain/zero/1.0/"))
        assertNull(FreeLicense.label("https://example.com/all-rights-reserved"))
        assertNull(FreeLicense.label(null))
        assertEquals("AC_DC - Song_.mp3", FreeLicense.safeFileName("AC/DC - Song?", "MP3"))
    }

    @Test fun durations() {
        assertEquals(215_340L, parseDurationMs("215.34"))
        assertEquals(215_000L, parseDurationMs("3:35"))
        assertEquals(3_723_000L, parseDurationMs("01:02:03"))
        assertEquals(0L, parseDurationMs(null))
    }

    @Test fun archiveSearchKeepsOnlyFreeLicences() = runTest {
        val body = """{"response":{"numFound":3,"docs":[
            {"identifier":"netlabel1","title":"Night Drive","creator":["DJ A","DJ B"],"licenseurl":"http://creativecommons.org/licenses/by/3.0/"},
            {"identifier":"closed","title":"Closed","licenseurl":"http://example.com/rights"},
            {"identifier":"pd78","title":"Old 78","creator":"Band","licenseurl":"http://creativecommons.org/publicdomain/mark/1.0/"}]}}"""
        var asked = ""
        val items = InternetArchiveClient { url -> asked = url; body }.search("synthwave", genre = "electronic")
        assertEquals(listOf("netlabel1", "pd78"), items.map { it.id })
        assertEquals("DJ A, DJ B", items[0].artist)
        assertEquals("CC BY 3.0", items[0].license)
        assertTrue(asked.contains("mediatype"))
        assertTrue(asked.contains("licenseurl"))
    }

    @Test fun archiveFilesPickOneMp3PerSong() {
        val item = FreeCollection("netlabel1", FreeProvider.INTERNET_ARCHIVE, "Night Drive", "DJ A", license = "CC BY 3.0", licenseUrl = "http://creativecommons.org/licenses/by/3.0/")
        val body = """{"metadata":{"licenseurl":"http://creativecommons.org/licenses/by/3.0/","subject":["electronic","synthwave"]},"files":[
            {"name":"02 Neon Rain.flac","format":"Flac","track":"2"},
            {"name":"02 Neon Rain.mp3","format":"VBR MP3","title":"Neon Rain","length":"3:10","track":"2"},
            {"name":"02 Neon Rain.ogg","format":"Ogg Vorbis","track":"2"},
            {"name":"01 Intro.ogg","format":"Ogg Vorbis","title":"Intro","length":"61.5","track":"1/2"},
            {"name":"01 Intro_sample.mp3","format":"VBR MP3"},
            {"name":"cover.jpg","format":"JPEG"}]}"""
        val tracks = InternetArchiveClient.parseFiles(item, body)
        assertEquals(listOf("Intro", "Neon Rain"), tracks.map { it.title })
        assertEquals("ogg", tracks[0].extension)
        assertEquals("https://archive.org/download/netlabel1/02%20Neon%20Rain.mp3", tracks[1].audioUrl)
        assertEquals(190_000L, tracks[1].durationMs)
        assertEquals("electronic", tracks[1].genre)
        assertEquals("free:ia:netlabel1/02 Neon Rain.mp3", tracks[1].libraryId)
    }

    @Test fun jamendoNeedsKeyAndRespectsDownloadFlag() = runTest {
        assertTrue(JamendoClient({ null }) { error("no network without key") }.search("rock").isEmpty())
        val body = """{"headers":{"status":"success"},"results":[
            {"id":"1","name":"Sunrise","artist_name":"Indie","album_name":"Dawn","duration":200,"audio":"https://a/1","audiodownload":"https://d/1",
             "image":"https://i/1","license_ccurl":"http://creativecommons.org/licenses/by-nc/3.0/","shareurl":"https://j/1","audiodownload_allowed":true,
             "musicinfo":{"tags":{"genres":["pop"]}}},
            {"id":"2","name":"Locked","artist_name":"X","audio":"https://a/2","license_ccurl":"http://creativecommons.org/licenses/by/3.0/","audiodownload_allowed":false}]}"""
        val r = JamendoClient({ "abc" }) { body }.search("sun")
        assertEquals(1, r.size)
        assertEquals("https://d/1", r[0].audioUrl)
        assertEquals("CC BY-NC 3.0", r[0].license)
        assertEquals(200_000L, r[0].durationMs)
        assertEquals("pop", r[0].genre)
        assertTrue(JamendoClient.parse("""{"headers":{"status":"failed"},"results":[]}""").isEmpty())
    }

    @Test fun podcastSearchAndFeed() {
        val shows = PodcastClient.parseSearch("""{"resultCount":2,"results":[
            {"collectionId":7,"collectionName":"Beat Talk","artistName":"Studio","feedUrl":"https://f/rss","artworkUrl600":"https://img/7"},
            {"collectionId":8,"collectionName":"No feed"}]}""")
        assertEquals(1, shows.size)
        val rss = """<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
              <title>Beat Talk</title><itunes:author>Studio FM</itunes:author><copyright>© Studio</copyright>
              <itunes:image href="https://img/show.jpg"/>
              <item><title>Ep 2 &amp; more</title><guid>g2</guid><itunes:duration>45:30</itunes:duration>
                <enclosure url="https://cdn/ep2.m4a?x=1" type="audio/x-m4a" length="1"/></item>
              <item><title>Video ep</title><enclosure url="https://cdn/v.mp4" type="video/mp4"/></item>
              <item><title>No file</title></item>
            </channel></rss>"""
        val eps = PodcastClient.parseFeed(shows[0], rss)
        assertEquals(1, eps.size)
        val e = eps[0]
        assertEquals("Ep 2 & more", e.title)
        assertEquals("Studio FM", e.artist)
        assertEquals(2_730_000L, e.durationMs)
        assertEquals("m4a", e.extension)
        assertEquals("https://img/show.jpg", e.artworkUrl)
        assertEquals("Podcast · © Studio", e.license)
        assertTrue(e.isPodcast)
        assertFalse(PodcastClient.parseFeed(shows[0], "not xml").isNotEmpty())
    }
}
