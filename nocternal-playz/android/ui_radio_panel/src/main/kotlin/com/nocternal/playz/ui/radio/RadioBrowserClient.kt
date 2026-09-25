package com.nocternal.playz.ui.radio

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

@Serializable
data class RadioStation(
    @SerialName("stationuuid") val id: String,
    val name: String,
    @SerialName("url_resolved") val streamUrl: String = "",
    val favicon: String = "",
    val tags: String = "",
    val country: String = "",
    @SerialName("countrycode") val countryCode: String = "",
    val codec: String = "",
    val bitrate: Int = 0,
    @SerialName("clickcount") val clicks: Int = 0,
) {
    /** FM frequency parsed from the name ("Radio City 91.1 FM" → 91.1), if any. */
    val fmFrequency: Float? get() = FM_REGEX.find(name)?.let { m -> "${m.groupValues[1]}.${m.groupValues[2]}".toFloatOrNull() }?.takeIf { it in 87.5f..108f }

    companion object { private val FM_REGEX = Regex("""\b(8[7-9]|9\d|10[0-8])[.,](\d)\b""") }
}

/**
 * Radio Hub backend: the community Radio Browser directory (radio-browser.info, ~50k stations, free, no key).
 * Tries several mirrors. [httpGet] is injectable for tests.
 */
class RadioBrowserClient(private val httpGet: (String) -> String? = ::defaultGet) {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val mirrors = listOf("https://de1.api.radio-browser.info", "https://nl1.api.radio-browser.info", "https://at1.api.radio-browser.info")
    private val common = "hidebroken=true&order=clickcount&reverse=true"

    suspend fun byTag(tag: String, limit: Int = 40) = get("/json/stations/bytag/${enc(tag)}?$common&limit=$limit")
    suspend fun search(name: String, limit: Int = 40) = get("/json/stations/search?name=${enc(name)}&$common&limit=$limit")

    /** FM stations of a country that stream online, sorted by frequency for the FM dial. */
    suspend fun fmStations(countryCode: String): List<RadioStation> =
        get("/json/stations/search?countrycode=${enc(countryCode)}&name=fm&$common&limit=300")
            .filter { it.fmFrequency != null }
            .groupBy { it.fmFrequency }.map { (_, v) -> v.maxBy { it.clicks } }
            .sortedBy { it.fmFrequency }

    private suspend fun get(path: String): List<RadioStation> = withContext(Dispatchers.IO) {
        for (m in mirrors) {
            val body = runCatching { httpGet(m + path) }.getOrNull() ?: continue
            return@withContext runCatching { json.decodeFromString(ListSerializer(RadioStation.serializer()), body) }.getOrDefault(emptyList())
                .filter { it.streamUrl.startsWith("http") }
        }
        emptyList()
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    companion object {
        fun defaultGet(url: String): String? {
            val c = URL(url).openConnection() as HttpURLConnection
            return try {
                c.connectTimeout = 7000; c.readTimeout = 10000
                c.setRequestProperty("User-Agent", "NocternalPlayz/1.0")
                if (c.responseCode == 200) c.inputStream.bufferedReader().readText() else null
            } finally { c.disconnect() }
        }
    }
}
