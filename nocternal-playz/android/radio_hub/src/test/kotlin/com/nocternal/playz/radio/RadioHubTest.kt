package com.nocternal.playz.radio

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RadioHubTest {
    private val rbStations = """[
      {"stationuuid":"a","name":"Radio Mirchi 98.3 FM","url_resolved":"http://mirchi.example/stream","countrycode":"IN","country":"India","tags":"bollywood,hindi","clickcount":900},
      {"stationuuid":"b","name":"Broken","url_resolved":"","countrycode":"IN"},
      {"stationuuid":"c","name":"Chill Lofi","url_resolved":"https://lofi.example/live","countrycode":"US","tags":"lofi,chillhop","clickcount":50}
    ]"""
    private val soma = """{"channels":[{"id":"groovesalad","title":"Groove Salad","description":"Ambient beats","genre":"ambient|electronica","image":"https://somafm.com/img/g.png","listeners":"1500"},
      {"id":"fluid","title":"Fluid","genre":"hiphop|lofi","listeners":"300"}]}"""
    private val yp = """<directory><entry><server_name>Jazz &amp; Blues FM</server_name><listen_url>http://ice.example:8000/jazz</listen_url>
      <server_type>audio/mpeg</server_type><bitrate>192</bitrate><genre>jazz blues</genre></entry>
      <entry><server_name>Video</server_name><listen_url>http://x/v</listen_url><server_type>video/webm</server_type><genre>jazz</genre></entry></directory>"""

    private val urls = mutableListOf<String>()
    private val http: HttpGet = { u ->
        urls += u
        when {
            "somafm.com" in u -> soma
            "dir.xiph.org" in u -> yp
            "/json/countries" in u -> """[{"name":"India","iso_3166_1":"IN","stationcount":2500},{"name":"Nowhere","iso_3166_1":"","stationcount":3}]"""
            "/json/stations" in u -> rbStations
            else -> null
        }
    }
    private val dir = RadioDirectory(RadioBrowserClient(http), SomaFmClient(http), IcecastDirectoryClient(http))

    @Test fun countriesWithFlags() = runTest {
        val c = dir.radioBrowser.countries()
        assertEquals(listOf("IN"), c.map { it.code })
        assertEquals("🇮🇳", c.first().flag)
    }

    @Test fun countryAndGenreCombined() = runTest {
        val st = dir.byCountry("IN", "bollywood")
        assertTrue(urls.any { "countrycode=IN" in it && "tag=bollywood" in it })
        assertTrue(st.none { it.streamUrl.isBlank() })
    }

    @Test fun genreMergesOpenSources() = runTest {
        val st = dir.byGenre(listOf("lofi"))
        assertTrue(st.any { it.provider == RadioProvider.RADIO_BROWSER })
        assertTrue(st.any { it.provider == RadioProvider.SOMAFM && it.name.contains("Fluid") && it.streamUrl == "https://ice1.somafm.com/fluid-128-mp3" })
        val jazz = dir.icecast.byGenre(listOf("jazz"))
        assertEquals(listOf("Jazz & Blues FM"), jazz.map { it.name })
        assertEquals(192, jazz.single().bitrate)
    }

    @Test fun dedupeAcrossSources() {
        val a = RadioStation("1", "X", "http://s/live")
        val b = RadioStation("2", "X copy", "https://s/live/", provider = RadioProvider.ICECAST)
        assertEquals(1, RadioDirectory.dedupe(listOf(a, b)).size)
    }
}
