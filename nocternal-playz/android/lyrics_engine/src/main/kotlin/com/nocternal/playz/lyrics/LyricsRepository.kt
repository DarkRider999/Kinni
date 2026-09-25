package com.nocternal.playz.lyrics

import com.nocternal.playz.model.Track
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** A lyrics source. Implementations must be safe to call off the main thread. */
fun interface LyricsProvider {
    suspend fun find(track: Track): Lyrics?
}

/** Storage for the offline cache (files on Android/iOS, a map in tests). */
interface LyricsCache {
    fun get(trackId: String): String?
    fun put(trackId: String, lrc: String)
}

class InMemoryLyricsCache : LyricsCache {
    private val map = HashMap<String, String>()
    override fun get(trackId: String) = map[trackId]
    override fun put(trackId: String, lrc: String) { map[trackId] = lrc }
}

/**
 * Lyrics engine (spec §11.3): offline first (cache → sidecar .lrc → embedded tag), then online when allowed.
 * Online results are cached as LRC so they work offline next time.
 */
class LyricsRepository(
    private val cache: LyricsCache,
    private val offline: List<LyricsProvider>,
    private val online: List<LyricsProvider>,
    private val isOnlineAllowed: () -> Boolean,
) {
    suspend fun lyricsFor(track: Track): Lyrics? {
        cache.get(track.id)?.let { return LrcParser.parse(it, LyricsOrigin.CACHE) }
        for (p in offline) p.find(track)?.let { return it }
        if (!isOnlineAllowed()) return null
        for (p in online) {
            val found = runCatching { p.find(track) }.getOrNull() ?: continue
            cache.put(track.id, LrcParser.toLrc(found))
            return found
        }
        return null
    }
}

/** Reads "Song.lrc" next to "Song.mp3" (or embedded USLT/SYLT text) via a platform file reader. */
class SidecarLrcProvider(private val readText: (path: String) -> String?) : LyricsProvider {
    override suspend fun find(track: Track): Lyrics? {
        val base = track.uri.substringBeforeLast('.', missingDelimiterValue = "")
        if (base.isEmpty()) return null
        val text = readText("$base.lrc") ?: return null
        return LrcParser.parse(text, LyricsOrigin.SIDECAR_LRC)
    }
}

class EmbeddedLyricsProvider(private val readEmbedded: (Track) -> String?) : LyricsProvider {
    override suspend fun find(track: Track): Lyrics? = readEmbedded(track)?.takeIf { it.isNotBlank() }?.let { LrcParser.parse(it, LyricsOrigin.EMBEDDED) }
}

/**
 * LRCLIB (https://lrclib.net) — a free, open lyrics database with synced LRC. No key required.
 * [httpGet] is injectable for tests; the default uses HttpURLConnection (available on Android and the JVM).
 */
class LrcLibProvider(
    private val httpGet: (String) -> String? = ::defaultGet,
    private val userAgent: String = "NocternalPlayz/1.0 (https://github.com/DarkRider999/Kinni)",
) : LyricsProvider {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun find(track: Track): Lyrics? {
        fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
        val url = buildString {
            append("https://lrclib.net/api/get?track_name=").append(enc(track.title))
            append("&artist_name=").append(enc(track.artist))
            if (track.album.isNotBlank()) append("&album_name=").append(enc(track.album))
            if (track.durationMs > 0) append("&duration=").append(track.durationMs / 1000)
        }
        val body = httpGet(url) ?: return null
        val obj = runCatching { json.parseToJsonElement(body) as? JsonObject }.getOrNull() ?: return null
        val synced = obj["syncedLyrics"]?.jsonPrimitive?.contentOrNull
        val plain = obj["plainLyrics"]?.jsonPrimitive?.contentOrNull
        return (synced ?: plain)?.takeIf { it.isNotBlank() }?.let { LrcParser.parse(it, LyricsOrigin.ONLINE) }
    }

    companion object {
        fun defaultGet(url: String): String? {
            val c = URL(url).openConnection() as HttpURLConnection
            return try {
                c.connectTimeout = 8000; c.readTimeout = 8000
                c.setRequestProperty("User-Agent", "NocternalPlayz/1.0")
                if (c.responseCode == 200) c.inputStream.bufferedReader().readText() else null
            } finally { c.disconnect() }
        }
    }
}
