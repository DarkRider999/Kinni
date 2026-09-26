package com.nocternal.playz.radio

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * SomaFM (somafm.com): ~30 listener-supported, commercial-free channels (ambient, lo-fi, electronica, jazz…).
 * The public channel list is JSON; streams use SomaFM's documented ice servers.
 */
class SomaFmClient(private val httpGet: HttpGet = ::defaultHttpGet) {
    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var cache: List<RadioStation>? = null

    suspend fun channels(): List<RadioStation> = cache ?: withContext(Dispatchers.IO) {
        val body = runCatching { httpGet("https://somafm.com/channels.json") }.getOrNull() ?: return@withContext emptyList()
        parse(body).also { if (it.isNotEmpty()) cache = it }
    }

    fun parse(body: String): List<RadioStation> {
        val root = runCatching { json.parseToJsonElement(body) as? JsonObject }.getOrNull() ?: return emptyList()
        val arr = root["channels"] as? JsonArray ?: return emptyList()
        return arr.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            fun s(k: String) = o[k]?.jsonPrimitive?.contentOrNull.orEmpty()
            val id = s("id").ifBlank { return@mapNotNull null }
            RadioStation(
                id = "somafm:$id", name = "SomaFM · " + s("title"), streamUrl = "https://ice1.somafm.com/$id-128-mp3",
                favicon = s("largeimage").ifBlank { s("image") }, tags = s("genre").replace('|', ','),
                country = "United States", countryCode = "US", codec = "MP3", bitrate = 128,
                clicks = o["listeners"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 0,
                provider = RadioProvider.SOMAFM, description = s("description"),
            )
        }.sortedByDescending { it.clicks }
    }
}

/**
 * The Icecast directory (dir.xiph.org), the open directory of the open-source Icecast streaming server.
 * Its full listing is one XML file; it is fetched once per session and filtered locally by genre.
 */
class IcecastDirectoryClient(private val httpGet: HttpGet = ::defaultHttpGet) {
    @Volatile private var cache: List<RadioStation>? = null
    private val entry = Regex("<entry>(.*?)</entry>", RegexOption.DOT_MATCHES_ALL)

    suspend fun all(): List<RadioStation> = cache ?: withContext(Dispatchers.IO) {
        val body = runCatching { httpGet("https://dir.xiph.org/yp.xml") }.getOrNull() ?: return@withContext emptyList()
        parse(body).also { if (it.isNotEmpty()) cache = it }
    }

    suspend fun byGenre(tags: List<String>, limit: Int = 60): List<RadioStation> {
        val wanted = tags.map { it.lowercase() }
        return all().filter { st -> st.tagList.any { t -> wanted.any { w -> t == w || t.contains(w) } } }.take(limit)
    }

    fun parse(xml: String): List<RadioStation> = entry.findAll(xml).mapNotNull { m ->
        val e = m.groupValues[1]
        fun tag(name: String) = Regex("<$name>(.*?)</$name>", RegexOption.DOT_MATCHES_ALL).find(e)?.groupValues?.get(1)?.let(::unescape)?.trim().orEmpty()
        val url = tag("listen_url").ifBlank { return@mapNotNull null }
        val type = tag("server_type").lowercase()
        if (!url.startsWith("http") || !(type.contains("mpeg") || type.contains("aac") || type.contains("ogg"))) return@mapNotNull null
        RadioStation(
            id = "icecast:" + url.hashCode().toUInt().toString(16), name = tag("server_name").ifBlank { url.substringAfterLast('/') },
            streamUrl = url, tags = tag("genre").replace(' ', ','),
            codec = when { type.contains("aac") -> "AAC"; type.contains("ogg") -> "OGG"; else -> "MP3" },
            bitrate = tag("bitrate").toIntOrNull() ?: 0, provider = RadioProvider.ICECAST,
        )
    }.toList()

    private fun unescape(s: String) = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'")
}

/**
 * One Radio Hub over all open directories: stations per genre and per country (and both combined), with
 * duplicates removed across sources.
 */
class RadioDirectory(
    val radioBrowser: RadioBrowserClient = RadioBrowserClient(),
    val somaFm: SomaFmClient = SomaFmClient(),
    val icecast: IcecastDirectoryClient = IcecastDirectoryClient(),
) {
    /** Stations for a genre's tags, optionally within one country. Radio Browser first, then SomaFM and Icecast. */
    suspend fun byGenre(tags: List<String>, countryCode: String? = null, limit: Int = 120): List<RadioStation> {
        val rb = tags.firstNotNullOfOrNull { t -> radioBrowser.stations(countryCode, t).takeIf { it.isNotEmpty() } }.orEmpty()
        val extra = if (countryCode == null || countryCode.equals("US", true)) {
            somaFm.channels().filter { st -> st.tagList.any { t -> tags.any { w -> t.contains(w.lowercase()) } } }
        } else emptyList()
        val ice = if (countryCode == null) icecast.byGenre(tags, 40) else emptyList()
        return dedupe(rb + extra + ice).take(limit)
    }

    suspend fun byCountry(countryCode: String, tag: String? = null): List<RadioStation> =
        dedupe(radioBrowser.stations(countryCode, tag, 150) + if (countryCode.equals("US", true) && tag == null) somaFm.channels() else emptyList())

    suspend fun search(query: String): List<RadioStation> {
        val q = query.lowercase()
        return dedupe(radioBrowser.search(query) + somaFm.channels().filter { q in it.name.lowercase() || q in it.tags.lowercase() })
    }

    companion object {
        /** Same stream or same name+country counts once. */
        fun dedupe(list: List<RadioStation>): List<RadioStation> {
            val seen = HashSet<String>()
            return list.filter { st ->
                val url = st.streamUrl.lowercase().removePrefix("https://").removePrefix("http://").trimEnd('/')
                seen.add(url) && seen.add(st.name.lowercase().trim() + "|" + st.countryCode.lowercase())
            }
        }
    }
}
