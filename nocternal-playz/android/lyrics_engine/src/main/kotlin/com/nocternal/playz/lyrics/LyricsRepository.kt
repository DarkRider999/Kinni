package com.nocternal.playz.lyrics

import com.nocternal.playz.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import kotlin.math.abs

/** A lyrics source. Implementations do their own I/O off the main thread. */
fun interface LyricsProvider {
    suspend fun find(track: Track): Lyrics?
}

/** Produces AI-generated lyrics when no real ones exist. [cacheable] results are saved for offline use. */
interface LyricsGenerator : LyricsProvider {
    val cacheable: Boolean
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
 * Lyrics engine (spec §11.3). Order:
 *  1. cached real lyrics, 2. sidecar .lrc / embedded tags, 3. online (LRCLIB) when the network may be used,
 *  4. AI-generated lyrics (cached, labelled) so every song shows something.
 * Real lyrics found later replace a cached AI version.
 */
class LyricsRepository(
    private val cache: LyricsCache,
    private val offline: List<LyricsProvider>,
    private val online: List<LyricsProvider>,
    private val isOnlineAllowed: () -> Boolean,
    /** Generators tried in order when nothing real is found (e.g. Claude, then the on-device writer). */
    private val generators: List<LyricsGenerator> = emptyList(),
) {
    suspend fun lyricsFor(track: Track): Lyrics? {
        val cached = cache.get(track.id)
        val cachedIsAi = cached?.contains(AI_MARKER) == true
        if (cached != null && !cachedIsAi) return LrcParser.parse(cached, LyricsOrigin.CACHE)
        for (p in offline) runCatching { p.find(track) }.getOrNull()?.let { return it }
        if (isOnlineAllowed()) {
            for (p in online) {
                val found = runCatching { p.find(track) }.getOrNull() ?: continue
                cache.put(track.id, LrcParser.toLrc(found))
                return found
            }
        }
        if (cached != null) return LrcParser.parse(cached, LyricsOrigin.AI_GENERATED)
        for (g in generators) {
            val made = runCatching { g.find(track) }.getOrNull() ?: continue
            if (g.cacheable && made.lines.size > 2) cache.put(track.id, AI_MARKER + "\n" + LrcParser.toLrc(made))
            return made
        }
        return null
    }

    companion object {
        const val AI_MARKER = "[re:nocternal-ai]"
    }
}

/** Reads "Song.lrc" next to "Song.mp3" via a platform file reader. */
class SidecarLrcProvider(private val readText: (path: String) -> String?) : LyricsProvider {
    override suspend fun find(track: Track): Lyrics? = withContext(Dispatchers.IO) {
        val base = track.uri.substringBeforeLast('.', missingDelimiterValue = "")
        if (base.isEmpty()) return@withContext null
        readText("$base.lrc")?.let { LrcParser.parse(it, LyricsOrigin.SIDECAR_LRC) }
    }
}

class EmbeddedLyricsProvider(private val readEmbedded: (Track) -> String?) : LyricsProvider {
    override suspend fun find(track: Track): Lyrics? = withContext(Dispatchers.IO) {
        readEmbedded(track)?.takeIf { it.isNotBlank() }?.let { LrcParser.parse(it, LyricsOrigin.EMBEDDED) }
    }
}

/** Cleans titles/artists from file names and video-style titles for lookups. */
object LyricsQuery {
    private val noise = Regex("""\s*[(\[](official|lyric|lyrics|audio|video|hd|hq|4k|full song|remaster(ed)?|explicit|visuali[sz]er|from)[^)\]]*[)\]]""", RegexOption.IGNORE_CASE)
    private val feat = Regex("""\s+(ft\.?|feat\.?|featuring)\s+.*$""", RegexOption.IGNORE_CASE)
    private val trackNo = Regex("""^\s*\d{1,3}\s*[-._)]\s*""")

    /** Returns (title, artist or null when unknown). "Artist - Title" titles are split when the artist tag is missing. */
    fun of(t: Track): Pair<String, String?> {
        var title = trackNo.replace(t.title, "")
        var artist: String? = t.artist.takeUnless { it.isBlank() || it.equals("Unknown artist", true) || it == "<unknown>" }
        if (artist == null && title.contains(" - ")) {
            artist = title.substringBefore(" - ").trim(); title = title.substringAfter(" - ")
        }
        title = feat.replace(noise.replace(title, ""), "").replace('_', ' ').trim()
        artist = artist?.let { feat.replace(it, "").split(',', '&', '/').first().trim() }
        return title to artist
    }
}

/**
 * LRCLIB (https://lrclib.net), a free open lyrics database with synced LRC. Exact lookup first, then a
 * fuzzy search. [httpGet] is injectable for tests; the default runs on Dispatchers.IO.
 */
class LrcLibProvider(private val httpGet: (String) -> String? = ::defaultGet) : LyricsProvider {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun find(track: Track): Lyrics? = withContext(Dispatchers.IO) {
        val (title, artist) = LyricsQuery.of(track)
        if (title.isBlank()) return@withContext null
        exact(title, artist, track) ?: search(title, artist, track)
    }

    private fun exact(title: String, artist: String?, track: Track): Lyrics? {
        if (artist == null) return null
        val url = buildString {
            append("https://lrclib.net/api/get?track_name=").append(enc(title))
            append("&artist_name=").append(enc(artist))
            if (track.album.isNotBlank()) append("&album_name=").append(enc(track.album))
            if (track.durationMs > 0) append("&duration=").append(track.durationMs / 1000)
        }
        val obj = httpGet(url)?.let { runCatching { json.parseToJsonElement(it) as? JsonObject }.getOrNull() } ?: return null
        return toLyrics(obj)
    }

    private fun search(title: String, artist: String?, track: Track): Lyrics? {
        val url = "https://lrclib.net/api/search?track_name=${enc(title)}" + (artist?.let { "&artist_name=${enc(it)}" } ?: "")
        val arr = httpGet(url)?.let { runCatching { json.parseToJsonElement(it) as? JsonArray }.getOrNull() }
            ?.takeIf { it.isNotEmpty() }
            ?: httpGet("https://lrclib.net/api/search?q=${enc(listOfNotNull(artist, title).joinToString(" "))}")
                ?.let { runCatching { json.parseToJsonElement(it) as? JsonArray }.getOrNull() }
            ?: return null
        val secs = track.durationMs / 1000.0
        val best = arr.mapNotNull { it as? JsonObject }
            .filter { o -> !o.str("syncedLyrics").isNullOrBlank() || !o.str("plainLyrics").isNullOrBlank() }
            .minByOrNull { o ->
                val d = o["duration"]?.jsonPrimitive?.doubleOrNull
                val durPenalty = if (secs > 0 && d != null) abs(d - secs) else 30.0
                durPenalty + if (o.str("syncedLyrics").isNullOrBlank()) 20 else 0
            } ?: return null
        return toLyrics(best)
    }

    private fun toLyrics(o: JsonObject): Lyrics? =
        (o.str("syncedLyrics")?.takeIf { it.isNotBlank() } ?: o.str("plainLyrics")?.takeIf { it.isNotBlank() })
            ?.let { LrcParser.parse(it, LyricsOrigin.ONLINE) }

    private fun JsonObject.str(k: String) = this[k]?.jsonPrimitive?.contentOrNull
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    companion object {
        fun defaultGet(url: String): String? {
            val c = URL(url).openConnection() as HttpURLConnection
            return try {
                c.connectTimeout = 8000; c.readTimeout = 10000
                c.setRequestProperty("User-Agent", "NocternalPlayz/1.0 (https://github.com/DarkRider999/Kinni)")
                if (c.responseCode == 200) c.inputStream.bufferedReader().readText() else null
            } finally { c.disconnect() }
        }
    }
}

/** Turns plain generated lines into synced lyrics spread across the song (skipping intro and outro). */
object LyricsTiming {
    fun spread(lines: List<String>, durationMs: Long, origin: LyricsOrigin): Lyrics {
        val clean = lines.map { it.trim() }.filter { it.isNotEmpty() }
        val dur = if (durationMs > 0) durationMs else 180_000L
        val start = (dur * 0.08).toLong().coerceAtMost(20_000)
        val end = dur - (dur * 0.06).toLong().coerceAtMost(15_000)
        val step = if (clean.size > 1) (end - start) / clean.size else 0
        return Lyrics(clean.mapIndexed { i, l -> LyricsLine(start + i * step, l) }, synced = true, origin = origin)
    }
}
