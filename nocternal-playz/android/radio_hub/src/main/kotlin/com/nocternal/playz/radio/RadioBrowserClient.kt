package com.nocternal.playz.radio

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Where a station listing came from. All are free, public, open directories. */
@Serializable
enum class RadioProvider(val label: String) {
    RADIO_BROWSER("Radio Browser"),
    SOMAFM("SomaFM"),
    ICECAST("Icecast directory"),
}

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
    val provider: RadioProvider = RadioProvider.RADIO_BROWSER,
    val description: String = "",
) {
    /** FM frequency parsed from the name ("Radio City 91.1 FM" → 91.1), if any. */
    val fmFrequency: Float? get() = FM_REGEX.find(name)?.let { m -> "${m.groupValues[1]}.${m.groupValues[2]}".toFloatOrNull() }?.takeIf { it in 87.5f..108f }

    val tagList: List<String> get() = tags.split(',', '|', ';').map { it.trim().lowercase() }.filter { it.isNotEmpty() }

    companion object { private val FM_REGEX = Regex("""\b(8[7-9]|9\d|10[0-8])[.,](\d)\b""") }
}

@Serializable
data class RadioCountry(
    val name: String,
    @SerialName("iso_3166_1") val code: String,
    @SerialName("stationcount") val stationCount: Int = 0,
) {
    /** Regional-indicator flag emoji from the ISO code ("IN" → 🇮🇳). */
    val flag: String get() = if (code.length == 2 && code.all { it.isLetter() })
        code.uppercase().map { String(Character.toChars(0x1F1E6 + (it - 'A'))) }.joinToString("") else "🌐"
}

@Serializable
data class RadioTag(val name: String, @SerialName("stationcount") val stationCount: Int = 0)

/** Blocking HTTP GET used by all directory clients (swap in tests). */
typealias HttpGet = (String) -> String?

fun defaultHttpGet(url: String): String? {
    val c = URL(url).openConnection() as HttpURLConnection
    return try {
        c.connectTimeout = 8000; c.readTimeout = 15000
        c.setRequestProperty("User-Agent", "NocternalPlayz/1.0 (https://github.com/DarkRider999/Kinni)")
        if (c.responseCode == 200) c.inputStream.bufferedReader().readText() else null
    } finally { c.disconnect() }
}

/**
 * Radio Browser (radio-browser.info): the open, community-run directory of ~50,000 stations with countries,
 * languages and tags. Free, no key, open-source server. Tries several mirrors.
 */
class RadioBrowserClient(private val httpGet: HttpGet = ::defaultHttpGet) {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val mirrors = listOf("https://de1.api.radio-browser.info", "https://nl1.api.radio-browser.info", "https://at1.api.radio-browser.info", "https://fi1.api.radio-browser.info")
    private val common = "hidebroken=true&order=clickcount&reverse=true"

    suspend fun byTag(tag: String, limit: Int = 60) = stations(get("/json/stations/bytag/${enc(tag)}?$common&limit=$limit"))
    suspend fun search(name: String, limit: Int = 60) = stations(get("/json/stations/search?name=${enc(name)}&$common&limit=$limit"))

    /** Stations filtered by country and/or tag (either may be null). */
    suspend fun stations(countryCode: String?, tag: String?, limit: Int = 100): List<RadioStation> {
        val q = buildString {
            append("/json/stations/search?").append(common).append("&limit=").append(limit)
            countryCode?.let { append("&countrycode=").append(enc(it)) }
            tag?.let { append("&tag=").append(enc(it)) }
        }
        return stations(get(q))
    }

    /** All countries with stations, most stations first. */
    suspend fun countries(): List<RadioCountry> =
        get("/json/countries?hidebroken=true&order=stationcount&reverse=true")
            ?.let { runCatching { json.decodeFromString(ListSerializer(RadioCountry.serializer()), it) }.getOrNull() }
            .orEmpty().filter { it.stationCount > 0 && it.code.length == 2 }

    /** The most used genre tags. */
    suspend fun tags(limit: Int = 80): List<RadioTag> =
        get("/json/tags?hidebroken=true&order=stationcount&reverse=true&limit=$limit")
            ?.let { runCatching { json.decodeFromString(ListSerializer(RadioTag.serializer()), it) }.getOrNull() }
            .orEmpty().filter { it.name.length in 2..24 }

    /** FM stations of a country that stream online, sorted by frequency for the FM dial. */
    suspend fun fmStations(countryCode: String): List<RadioStation> =
        stations(get("/json/stations/search?countrycode=${enc(countryCode)}&name=fm&$common&limit=300"))
            .filter { it.fmFrequency != null }
            .groupBy { it.fmFrequency }.map { (_, v) -> v.maxBy { it.clicks } }
            .sortedBy { it.fmFrequency }

    private fun stations(body: String?): List<RadioStation> =
        body?.let { runCatching { json.decodeFromString(ListSerializer(RadioStation.serializer()), it) }.getOrNull() }
            .orEmpty().filter { it.streamUrl.startsWith("http") }

    private suspend fun get(path: String): String? = withContext(Dispatchers.IO) {
        for (m in mirrors) runCatching { httpGet(m + path) }.getOrNull()?.let { return@withContext it }
        null
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")
}
