package com.nocternal.playz.ui.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.lyrics.Lyrics
import com.nocternal.playz.lyrics.LyricsOrigin
import com.nocternal.playz.lyrics.LyricsSync

/** Scrolling synced lyrics with karaoke word highlight (spec §11.3). */
@Composable
fun LyricsView(lyrics: Lyrics?, positionMs: Long, modifier: Modifier = Modifier, loading: Boolean = false, onLineClick: (Long) -> Unit = {}) {
    val p = Neon.palette
    if (lyrics == null) {
        Text(if (loading) "Finding lyrics…" else "No lyrics for this track.", modifier.padding(24.dp), color = p.muted, textAlign = TextAlign.Center)
        return
    }
    if (lyrics.origin == LyricsOrigin.AI_GENERATED) {
        androidx.compose.foundation.layout.Column(modifier) {
            Text("✨ AI-generated lyrics — no official lyrics were found for this song", Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                color = p.accent, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
            SyncedLyrics(lyrics, positionMs, Modifier.weight(1f), onLineClick)
        }
        return
    }
    SyncedLyrics(lyrics, positionMs, modifier, onLineClick)
}

@Composable
private fun SyncedLyrics(lyrics: Lyrics, positionMs: Long, modifier: Modifier, onLineClick: (Long) -> Unit) {
    val p = Neon.palette
    val pos = LyricsSync.at(lyrics, positionMs)
    val state = rememberLazyListState()
    LaunchedEffect(pos.lineIndex) { if (pos.lineIndex >= 0) state.animateScrollToItem((pos.lineIndex - 2).coerceAtLeast(0)) }
    LazyColumn(modifier, state = state, contentPadding = PaddingValues(vertical = 120.dp)) {
        itemsIndexed(lyrics.lines) { i, line ->
            val active = i == pos.lineIndex
            val text = if (active && line.words.isNotEmpty()) buildAnnotatedString {
                line.words.forEachIndexed { w, word ->
                    val sung = w < pos.wordIndex || (w == pos.wordIndex && pos.wordProgress > 0.5f)
                    withStyle(SpanStyle(color = if (sung) p.accent else p.onBackground)) { append(word.text) }
                    if (w < line.words.lastIndex) append(" ")
                }
            } else buildAnnotatedString { append(line.text) }
            Text(
                text,
                Modifier.fillMaxWidth().clickable(enabled = lyrics.synced) { onLineClick(line.startMs) }.padding(horizontal = 24.dp, vertical = 6.dp),
                color = when { active -> p.accent; i < pos.lineIndex -> p.muted; else -> p.onBackground.copy(alpha = 0.7f) },
                fontSize = if (active) 24.sp else 19.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
