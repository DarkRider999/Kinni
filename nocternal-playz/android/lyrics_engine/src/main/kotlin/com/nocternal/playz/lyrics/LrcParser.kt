package com.nocternal.playz.lyrics

/**
 * Parses LRC and enhanced LRC:
 *   [ti:Title] [offset:+250]
 *   [00:12.34]Line text
 *   [00:12.34][01:02.00]Repeated chorus
 *   [00:12.34]<00:12.34>Word <00:12.80>by <00:13.10>word
 * Text without any timestamps is returned as unsynced lyrics.
 */
object LrcParser {
    private val timeTag = Regex("""\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?]""")
    private val wordTag = Regex("""<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>""")
    private val metaTag = Regex("""^\[([a-zA-Z#]+):(.*)]$""")

    fun parse(text: String, origin: LyricsOrigin): Lyrics {
        var offset = 0L
        val lines = mutableListOf<LyricsLine>()
        val plain = mutableListOf<String>()
        for (raw in text.lineSequence()) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            val meta = metaTag.matchEntire(line)
            if (meta != null) {
                if (meta.groupValues[1].equals("offset", true)) offset = meta.groupValues[2].trim().toLongOrNull() ?: 0
                continue
            }
            val stamps = mutableListOf<Long>()
            var rest = line
            while (true) {
                val m = timeTag.find(rest) ?: break
                if (m.range.first != 0) break
                stamps += toMs(m)
                rest = rest.substring(m.range.last + 1)
            }
            if (stamps.isEmpty()) { plain += line; continue }
            val words = parseWords(rest)
            val cleanText = wordTag.replace(rest, "").replace(Regex("\\s+"), " ").trim()
            stamps.forEach { lines += LyricsLine(it, cleanText, words) }
        }
        return if (lines.isNotEmpty()) {
            // LRC offset: positive shifts lyrics earlier.
            Lyrics(lines.sortedBy { it.startMs }, synced = true, origin = origin, offsetMs = offset)
        } else {
            Lyrics(plain.map { LyricsLine(0, it) }, synced = false, origin = origin)
        }
    }

    private fun parseWords(s: String): List<KaraokeWord> {
        val matches = wordTag.findAll(s).toList()
        if (matches.isEmpty()) return emptyList()
        return matches.mapIndexedNotNull { i, m ->
            val end = matches.getOrNull(i + 1)?.range?.first ?: s.length
            val word = s.substring(m.range.last + 1, end).trim()
            if (word.isEmpty()) null else KaraokeWord(toMs(m), word)
        }
    }

    private fun toMs(m: MatchResult): Long {
        val min = m.groupValues[1].toLong(); val sec = m.groupValues[2].toLong()
        val frac = m.groupValues[3]
        val ms = when (frac.length) { 0 -> 0L; 1 -> frac.toLong() * 100; 2 -> frac.toLong() * 10; else -> frac.take(3).toLong() }
        return (min * 60 + sec) * 1000 + ms
    }

    /** Serialises back to LRC (used by the offline cache and "save lyrics"). */
    fun toLrc(lyrics: Lyrics): String = buildString {
        if (lyrics.offsetMs != 0L) appendLine("[offset:${lyrics.offsetMs}]")
        for (l in lyrics.lines) {
            if (lyrics.synced) append(stamp(l.startMs, '[', ']'))
            if (l.words.isNotEmpty()) l.words.forEachIndexed { i, w -> if (i > 0) append(' '); append(stamp(w.startMs, '<', '>')); append(w.text) }
            else append(l.text)
            appendLine()
        }
    }

    private fun stamp(ms: Long, open: Char, close: Char) = "%c%02d:%02d.%02d%c".format(open, ms / 60000, ms / 1000 % 60, ms % 1000 / 10, close)
}
