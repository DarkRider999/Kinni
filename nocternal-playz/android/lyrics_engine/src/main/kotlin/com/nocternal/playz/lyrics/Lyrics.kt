package com.nocternal.playz.lyrics

import kotlinx.serialization.Serializable

/** A karaoke word with its own start time (enhanced LRC "<mm:ss.xx>" tags). */
@Serializable
data class KaraokeWord(val startMs: Long, val text: String)

@Serializable
data class LyricsLine(val startMs: Long, val text: String, val words: List<KaraokeWord> = emptyList())

@Serializable
enum class LyricsOrigin {
    EMBEDDED, SIDECAR_LRC, ONLINE, CACHE,
    /** Written by AI because no real lyrics were found. Always labelled as such in the UI. */
    AI_GENERATED,
}

@Serializable
data class Lyrics(
    val lines: List<LyricsLine>,
    /** False for plain (unsynced) text. */
    val synced: Boolean,
    val origin: LyricsOrigin,
    val offsetMs: Long = 0,
) {
    val plainText: String get() = lines.joinToString("\n") { it.text }
}

/** Where the playhead is in the lyrics — drives the scrolling view and karaoke highlight. */
data class LyricsPosition(val lineIndex: Int, val wordIndex: Int, val lineProgress: Float, val wordProgress: Float)

object LyricsSync {
    /** Current line/word at [positionMs]. lineIndex = -1 before the first line. */
    fun at(lyrics: Lyrics, positionMs: Long): LyricsPosition {
        if (!lyrics.synced || lyrics.lines.isEmpty()) return LyricsPosition(-1, -1, 0f, 0f)
        val pos = positionMs + lyrics.offsetMs
        var lo = 0; var hi = lyrics.lines.size - 1; var idx = -1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (lyrics.lines[mid].startMs <= pos) { idx = mid; lo = mid + 1 } else hi = mid - 1
        }
        if (idx < 0) return LyricsPosition(-1, -1, 0f, 0f)
        val line = lyrics.lines[idx]
        val end = lyrics.lines.getOrNull(idx + 1)?.startMs ?: (line.startMs + 5000)
        val lineProgress = ((pos - line.startMs).toFloat() / (end - line.startMs).coerceAtLeast(1)).coerceIn(0f, 1f)
        if (line.words.isEmpty()) return LyricsPosition(idx, -1, lineProgress, 0f)
        val w = line.words.indexOfLast { it.startMs <= pos }
        if (w < 0) return LyricsPosition(idx, -1, lineProgress, 0f)
        val wEnd = line.words.getOrNull(w + 1)?.startMs ?: end
        val wp = ((pos - line.words[w].startMs).toFloat() / (wEnd - line.words[w].startMs).coerceAtLeast(1)).coerceIn(0f, 1f)
        return LyricsPosition(idx, w, lineProgress, wp)
    }
}
