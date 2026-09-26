package com.nocternal.playz.freemusic

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Legal free downloads: only music whose licence allows copying (Creative Commons or public domain) and
 * podcasts published for download through their own RSS feeds. Nothing here touches YouTube or any service
 * whose terms forbid downloading.
 */
enum class FreeProvider(val label: String, val homepage: String) {
    INTERNET_ARCHIVE("Internet Archive", "https://archive.org/details/audio"),
    JAMENDO("Jamendo", "https://www.jamendo.com"),
    PODCAST("Podcast", "https://podcasts.apple.com"),
}

/** One downloadable audio file with everything needed to credit its author. */
data class FreeTrack(
    val id: String,
    val provider: FreeProvider,
    val title: String,
    val artist: String,
    val album: String = "",
    val durationMs: Long = 0,
    /** Direct file URL, used for both streaming preview and download. */
    val audioUrl: String,
    val artworkUrl: String? = null,
    /** Human-readable licence, e.g. "CC BY-NC-SA 4.0"; for podcasts "Free podcast episode". */
    val license: String,
    val licenseUrl: String? = null,
    /** Page to credit / open ("Attribution: title by artist, licence, link"). */
    val pageUrl: String? = null,
    val genre: String? = null,
    val isPodcast: Boolean = false,
    val extension: String = "mp3",
) {
    /** Stable id for the local library ("free:ia:item/file.mp3"). */
    val libraryId: String get() = "free:$id"

    /** Safe file name for app storage. */
    val fileName: String get() = FreeLicense.safeFileName("$artist - $title", extension)

    val attribution: String get() = "\"$title\" by $artist · $license" + (pageUrl?.let { " · $it" } ?: "")
}

/** An Internet Archive item or a podcast show: a group of tracks loaded on demand. */
data class FreeCollection(
    val id: String,
    val provider: FreeProvider,
    val title: String,
    val artist: String,
    val artworkUrl: String? = null,
    val license: String,
    val licenseUrl: String? = null,
    val pageUrl: String? = null,
    val description: String = "",
    /** Podcast RSS feed, when this is a show. */
    val feedUrl: String? = null,
)

/** Blocking HTTP GET (swap in tests). */
typealias Fetch = (String) -> String?

fun defaultFetch(url: String): String? {
    val c = URL(url).openConnection() as HttpURLConnection
    return try {
        c.connectTimeout = 10000; c.readTimeout = 20000
        c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "NocternalPlayz/1.0 (https://github.com/DarkRider999/Kinni)")
        if (c.responseCode == 200) c.inputStream.bufferedReader().readText() else null
    } finally { c.disconnect() }
}

internal fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")

internal suspend fun fetchIo(fetch: Fetch, url: String): String? = withContext(Dispatchers.IO) { runCatching { fetch(url) }.getOrNull() }

object FreeLicense {
    /**
     * Turns a licence URL into a label and says whether it allows downloading and keeping a copy.
     * All Creative Commons licences and public-domain marks do; anything else is rejected.
     */
    fun label(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val u = url.lowercase()
        if ("publicdomain/zero" in u) return "CC0 (public domain)"
        if ("publicdomain/mark" in u || "publicdomain" in u) return "Public domain"
        val m = Regex("""creativecommons\.org/licenses/([a-z-]+)/([\d.]+)""").find(u) ?: return if ("creativecommons.org" in u) "Creative Commons" else null
        return "CC " + m.groupValues[1].uppercase() + " " + m.groupValues[2]
    }

    fun isFree(url: String?): Boolean = label(url) != null

    fun safeFileName(base: String, ext: String): String {
        val clean = base.replace(Regex("""[\\/:*?"<>|\p{Cntrl}]"""), "_").replace(Regex("\\s+"), " ").trim().take(120).ifBlank { "track" }
        return "$clean.${ext.lowercase().ifBlank { "mp3" }}"
    }
}
