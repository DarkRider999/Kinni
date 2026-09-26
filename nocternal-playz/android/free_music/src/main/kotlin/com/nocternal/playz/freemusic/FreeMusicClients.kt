package com.nocternal.playz.freemusic

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.w3c.dom.Element
import javax.xml.parsers.DocumentBuilderFactory

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/** String value of a field that may be a string, number or array of strings ("creator": ["A", "B"]). */
private fun JsonObject.text(key: String): String? = when (val v = this[key]) {
    is JsonPrimitive -> v.contentOrNull
    is JsonArray -> v.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.joinToString(", ").ifBlank { null }
    else -> null
}?.trim()?.ifBlank { null }

/** "215.3" seconds, "3:35" or "1:02:03" → milliseconds. */
internal fun parseDurationMs(s: String?): Long {
    if (s.isNullOrBlank()) return 0
    val t = s.trim()
    if (':' in t) return t.split(':').fold(0L) { acc, part -> acc * 60 + (part.trim().toDoubleOrNull()?.toLong() ?: 0) } * 1000
    return ((t.toDoubleOrNull() ?: 0.0) * 1000).toLong()
}

/**
 * Internet Archive: millions of free audio items (netlabels, live sets, old-time radio, public-domain records).
 * Only items whose licence URL is Creative Commons or public domain are listed. Free, no key.
 */
class InternetArchiveClient(private val fetch: Fetch = ::defaultFetch) {
    suspend fun search(query: String, genre: String? = null, rows: Int = 40): List<FreeCollection> {
        val parts = buildList {
            if (query.isNotBlank()) add("(${query.trim()})")
            if (!genre.isNullOrBlank()) add("subject:(\"${genre.trim()}\")")
            add("mediatype:(audio)")
            add("licenseurl:(*creativecommons* OR *publicdomain*)")
        }
        val url = "https://archive.org/advancedsearch.php?q=${enc(parts.joinToString(" AND "))}" +
            listOf("identifier", "title", "creator", "licenseurl", "description").joinToString("") { "&fl[]=$it" } +
            "&sort[]=${enc("downloads desc")}&rows=$rows&page=1&output=json"
        return parseSearch(fetchIo(fetch, url) ?: return emptyList())
    }

    suspend fun tracks(item: FreeCollection): List<FreeTrack> {
        val body = fetchIo(fetch, "https://archive.org/metadata/${enc(item.id)}") ?: return emptyList()
        return parseFiles(item, body)
    }

    companion object {
        fun parseSearch(body: String): List<FreeCollection> = runCatching {
            json.parseToJsonElement(body).jsonObject["response"]!!.jsonObject["docs"]!!.jsonArray.mapNotNull { e ->
                val o = e.jsonObject
                val id = o.text("identifier") ?: return@mapNotNull null
                val lic = o.text("licenseurl")
                val label = FreeLicense.label(lic) ?: return@mapNotNull null
                FreeCollection(
                    id = id, provider = FreeProvider.INTERNET_ARCHIVE, title = o.text("title") ?: id, artist = o.text("creator") ?: "Unknown artist",
                    artworkUrl = "https://archive.org/services/img/$id", license = label, licenseUrl = lic,
                    pageUrl = "https://archive.org/details/$id", description = o.text("description")?.replace(Regex("<[^>]+>"), "")?.take(300).orEmpty(),
                )
            }
        }.getOrDefault(emptyList())

        /** Picks one playable file per song (MP3 preferred, then Ogg), skipping samples and duplicates. */
        fun parseFiles(item: FreeCollection, body: String): List<FreeTrack> = runCatching {
            val root = json.parseToJsonElement(body).jsonObject
            val meta = root["metadata"]?.jsonObject
            val lic = meta?.text("licenseurl") ?: item.licenseUrl
            val license = FreeLicense.label(lic) ?: return@runCatching emptyList()
            val files = root["files"]?.jsonArray?.map { it.jsonObject }.orEmpty()
            files.mapNotNull { f ->
                val name = f.text("name") ?: return@mapNotNull null
                val rank = formatRank(f.text("format").orEmpty(), name) ?: return@mapNotNull null
                if ("_sample" in name.lowercase() || name.lowercase().endsWith("_64kb.mp3")) return@mapNotNull null
                Triple(name, rank, f)
            }
                .groupBy { it.first.substringBeforeLast('.').removeSuffix("_vbr") }
                .values.map { g -> g.minBy { it.second } }
                .sortedWith(compareBy({ it.third.text("track")?.substringBefore('/')?.toIntOrNull() ?: Int.MAX_VALUE }, { it.first }))
                .map { (name, _, f) ->
                    val ext = name.substringAfterLast('.', "mp3")
                    FreeTrack(
                        id = "ia:${item.id}/$name", provider = FreeProvider.INTERNET_ARCHIVE,
                        title = f.text("title") ?: name.substringAfterLast('/').substringBeforeLast('.').replace('_', ' '),
                        artist = f.text("creator") ?: f.text("artist") ?: item.artist,
                        album = f.text("album") ?: item.title,
                        durationMs = parseDurationMs(f.text("length")),
                        audioUrl = "https://archive.org/download/${item.id}/" + name.split('/').joinToString("/") { enc(it).replace("+", "%20") },
                        artworkUrl = item.artworkUrl, license = license, licenseUrl = lic, pageUrl = item.pageUrl,
                        genre = meta?.text("subject")?.split(',', ';')?.firstOrNull()?.trim(), extension = ext,
                    )
                }
        }.getOrDefault(emptyList())

        private fun formatRank(format: String, name: String): Int? {
            val f = format.lowercase(); val n = name.lowercase()
            return when {
                f == "vbr mp3" -> 0
                "mp3" in f || n.endsWith(".mp3") -> 1
                "ogg" in f || n.endsWith(".ogg") -> 2
                else -> null
            }
        }
    }
}

/**
 * Jamendo: ~600,000 Creative Commons tracks by independent artists. Needs a free developer client ID
 * (devportal.jamendo.com), entered in Settings. Only tracks with downloads allowed are returned.
 */
class JamendoClient(private val clientId: () -> String?, private val fetch: Fetch = ::defaultFetch) {
    val isConfigured: Boolean get() = !clientId().isNullOrBlank()

    suspend fun search(query: String, genre: String? = null, limit: Int = 50): List<FreeTrack> {
        val id = clientId()?.trim()?.takeIf { it.isNotEmpty() } ?: return emptyList()
        val url = buildString {
            append("https://api.jamendo.com/v3.0/tracks/?client_id=").append(enc(id))
            append("&format=json&limit=$limit&audioformat=mp32&include=musicinfo&audiodlformat=mp32&order=popularity_total")
            if (query.isNotBlank()) append("&search=").append(enc(query.trim()))
            if (!genre.isNullOrBlank()) append("&tags=").append(enc(genre.trim()))
        }
        return parse(fetchIo(fetch, url) ?: return emptyList())
    }

    companion object {
        fun parse(body: String): List<FreeTrack> = runCatching {
            val root = json.parseToJsonElement(body).jsonObject
            val status = root["headers"]?.jsonObject?.text("status")
            if (status != null && status != "success") return@runCatching emptyList()
            root["results"]!!.jsonArray.mapNotNull { e ->
                val o = e.jsonObject
                if ((o["audiodownload_allowed"] as? JsonPrimitive)?.booleanOrNull == false) return@mapNotNull null
                val lic = o.text("license_ccurl")
                val label = FreeLicense.label(lic) ?: return@mapNotNull null
                val audio = o.text("audiodownload") ?: o.text("audio") ?: return@mapNotNull null
                val genres = (o["musicinfo"] as? JsonObject)?.get("tags")?.jsonObject?.get("genres") as? JsonArray
                FreeTrack(
                    id = "jamendo:${o.text("id")}", provider = FreeProvider.JAMENDO, title = o.text("name") ?: "Untitled",
                    artist = o.text("artist_name") ?: "Unknown artist", album = o.text("album_name").orEmpty(),
                    durationMs = parseDurationMs(o.text("duration")), audioUrl = audio, artworkUrl = o.text("image") ?: o.text("album_image"),
                    license = label, licenseUrl = lic, pageUrl = o.text("shareurl"),
                    genre = genres?.firstOrNull()?.let { (it as? JsonPrimitive)?.contentOrNull },
                )
            }
        }.getOrDefault(emptyList())
    }
}

/**
 * Podcasts: discovery through the public iTunes Search API, episodes straight from each show's own RSS feed
 * (episodes are published there for free download). Free, no key.
 */
class PodcastClient(private val fetch: Fetch = ::defaultFetch) {
    suspend fun search(query: String, limit: Int = 30): List<FreeCollection> {
        if (query.isBlank()) return emptyList()
        val body = fetchIo(fetch, "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=$limit&term=${enc(query.trim())}") ?: return emptyList()
        return parseSearch(body)
    }

    suspend fun episodes(show: FreeCollection, limit: Int = 100): List<FreeTrack> {
        val feed = show.feedUrl ?: return emptyList()
        return parseFeed(show, fetchIo(fetch, feed) ?: return emptyList()).take(limit)
    }

    companion object {
        fun parseSearch(body: String): List<FreeCollection> = runCatching {
            json.parseToJsonElement(body).jsonObject["results"]!!.jsonArray.mapNotNull { e ->
                val o = e.jsonObject
                val feed = o.text("feedUrl") ?: return@mapNotNull null
                FreeCollection(
                    id = "podcast:" + (o.text("collectionId") ?: feed), provider = FreeProvider.PODCAST,
                    title = o.text("collectionName") ?: "Podcast", artist = o.text("artistName") ?: "",
                    artworkUrl = o.text("artworkUrl600") ?: o.text("artworkUrl100"), license = "Free podcast · personal listening",
                    pageUrl = o.text("collectionViewUrl"), description = o.text("primaryGenreName").orEmpty(), feedUrl = feed,
                )
            }
        }.getOrDefault(emptyList())

        fun parseFeed(show: FreeCollection, xml: String): List<FreeTrack> = runCatching {
            val factory = DocumentBuilderFactory.newInstance().apply {
                isNamespaceAware = false; isExpandEntityReferences = false
                // No DTDs or external entities from untrusted feeds (not every platform parser supports the flag).
                runCatching { setFeature("http://apache.org/xml/features/disallow-doctype-decl", true) }
            }
            val doc = factory.newDocumentBuilder().parse(xml.trimStart('﻿', ' ', '\n', '\r', '\t').byteInputStream())
            val channel = doc.getElementsByTagName("channel").item(0) as? Element
            val showArt = channel?.let { c -> c.child("itunes:image")?.getAttribute("href")?.ifBlank { null } ?: c.child("image")?.child("url")?.textContent?.trim() } ?: show.artworkUrl
            val author = channel?.child("itunes:author")?.textContent?.trim()?.ifBlank { null } ?: show.artist.ifBlank { show.title }
            val rights = channel?.child("copyright")?.textContent?.trim()?.ifBlank { null }
            val items = doc.getElementsByTagName("item")
            (0 until items.length).mapNotNull { i ->
                val item = items.item(i) as Element
                val enclosure = item.child("enclosure") ?: return@mapNotNull null
                val url = enclosure.getAttribute("url").trim().ifBlank { return@mapNotNull null }
                val type = enclosure.getAttribute("type").lowercase()
                if (type.isNotEmpty() && !type.startsWith("audio")) return@mapNotNull null
                val title = item.child("title")?.textContent?.trim()?.ifBlank { null } ?: "Episode ${items.length - i}"
                FreeTrack(
                    id = "podcast:" + (item.child("guid")?.textContent?.trim()?.ifBlank { null } ?: url), provider = FreeProvider.PODCAST,
                    title = title, artist = author, album = show.title, durationMs = parseDurationMs(item.child("itunes:duration")?.textContent),
                    audioUrl = url, artworkUrl = item.child("itunes:image")?.getAttribute("href")?.ifBlank { null } ?: showArt,
                    license = rights?.let { r -> "Podcast · $r" } ?: show.license, pageUrl = item.child("link")?.textContent?.trim()?.ifBlank { null } ?: show.pageUrl,
                    genre = "podcast", isPodcast = true,
                    extension = url.substringBefore('?').substringAfterLast('.', "mp3").takeIf { e -> e.length in 2..4 } ?: "mp3",
                )
            }
        }.getOrDefault(emptyList())

        private fun Element.child(tag: String): Element? {
            val nodes = childNodes
            for (i in 0 until nodes.length) { val n = nodes.item(i); if (n is Element && n.tagName == tag) return n }
            return null
        }
    }
}

/** One place for the UI: the legal free sources behind a single API. */
class FreeMusicHub(
    val archive: InternetArchiveClient = InternetArchiveClient(),
    val jamendo: JamendoClient,
    val podcasts: PodcastClient = PodcastClient(),
) {
    /** Genre shortcuts that work on both Internet Archive subjects and Jamendo tags. */
    val genres = listOf("electronic", "ambient", "lofi", "rock", "hiphop", "jazz", "classical", "pop", "chillout", "indian", "folk", "metal", "soundtrack", "reggae")

    /** Popular shows to start from when the podcast search box is empty. */
    val podcastStarters = listOf("music", "bollywood", "technology", "comedy", "news", "true crime", "science", "meditation")
}
