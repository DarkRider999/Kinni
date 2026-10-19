package com.nocternal.playz.ui.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
import com.nocternal.playz.lyrics.LyricsLine
import com.nocternal.playz.lyrics.LyricsOrigin
import com.nocternal.playz.lyrics.LyricsSync

/** Scrolling synced lyrics with karaoke word highlight, dual (Hinglish + native script) display, in-song search
 *  and per-line bookmarking (spec §11.3, §45-50, Phase 4D #15). */
@Composable
fun LyricsView(
    lyrics: Lyrics?,
    positionMs: Long,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    onLineClick: (Long) -> Unit = {},
    isBookmarked: (LyricsLine) -> Boolean = { false },
    onToggleBookmark: (LyricsLine) -> Unit = {},
) {
    val p = Neon.palette
    if (lyrics == null) {
        Text(if (loading) "Finding lyrics…" else "No lyrics for this track.", modifier.padding(24.dp), color = p.muted, textAlign = TextAlign.Center)
        return
    }
    var query by remember(lyrics) { mutableStateOf("") }
    var searching by remember(lyrics) { mutableStateOf(false) }
    var showOriginal by remember { mutableStateOf(true) }
    val hasOriginal = remember(lyrics) { lyrics.lines.any { it.original != null } }

    Column(modifier) {
        if (lyrics.origin == LyricsOrigin.AI_GENERATED) {
            Text("✨ No official lyrics found — shown in English script, with Hindi/Punjabi words transliterated to match the singer", Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                color = p.accent, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
        }
        LyricsToolbar(
            searching = searching, query = query, hasOriginal = hasOriginal, showOriginal = showOriginal,
            onToggleSearch = { searching = !searching; if (!searching) query = "" }, onQueryChange = { query = it },
            onToggleOriginal = { showOriginal = !showOriginal },
        )
        SyncedLyrics(lyrics, positionMs, Modifier.weight(1f), query, showOriginal, isBookmarked, onToggleBookmark) { ms -> onLineClick(ms); searching = false; query = "" }
    }
}

@Composable
private fun LyricsToolbar(
    searching: Boolean, query: String, hasOriginal: Boolean, showOriginal: Boolean,
    onToggleSearch: () -> Unit, onQueryChange: (String) -> Unit, onToggleOriginal: () -> Unit,
) {
    val p = Neon.palette
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (searching) {
            OutlinedTextField(
                value = query, onValueChange = onQueryChange, modifier = Modifier.weight(1f), singleLine = true,
                placeholder = { Text("Search lyrics", color = p.muted) },
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.onBackground, unfocusedTextColor = p.onBackground, focusedBorderColor = p.accent, unfocusedBorderColor = p.muted),
            )
            IconButton(onClick = onToggleSearch) { Icon(Icons.Filled.Close, "Close search", tint = p.onBackground) }
        } else {
            androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
            if (hasOriginal) IconButton(onClick = onToggleOriginal) { Icon(Icons.Filled.Translate, "Show original script", tint = if (showOriginal) p.accent else p.muted) }
            IconButton(onClick = onToggleSearch) { Icon(Icons.Filled.Search, "Search lyrics", tint = p.onBackground) }
        }
    }
}

@Composable
private fun SyncedLyrics(
    lyrics: Lyrics, positionMs: Long, modifier: Modifier, query: String, showOriginal: Boolean,
    isBookmarked: (LyricsLine) -> Boolean, onToggleBookmark: (LyricsLine) -> Unit, onLineClick: (Long) -> Unit,
) {
    val p = Neon.palette
    val pos = LyricsSync.at(lyrics, positionMs)
    val state = rememberLazyListState()
    val visible = remember(lyrics, query) {
        lyrics.lines.withIndex().filter { (_, line) ->
            query.isBlank() || line.text.contains(query, ignoreCase = true) || line.original?.contains(query, ignoreCase = true) == true
        }
    }
    LaunchedEffect(pos.lineIndex, query) {
        if (query.isBlank() && pos.lineIndex >= 0) state.animateScrollToItem((pos.lineIndex - 2).coerceAtLeast(0))
    }
    LazyColumn(modifier, state = state, contentPadding = PaddingValues(vertical = 120.dp)) {
        itemsIndexed(visible, key = { _, (i, _) -> i }) { _, (i, line) ->
            val active = i == pos.lineIndex
            val text = if (active && line.words.isNotEmpty()) buildAnnotatedString {
                line.words.forEachIndexed { w, word ->
                    val sung = w < pos.wordIndex || (w == pos.wordIndex && pos.wordProgress > 0.5f)
                    withStyle(SpanStyle(color = if (sung) p.accent else p.onBackground)) { append(word.text) }
                    if (w < line.words.lastIndex) append(" ")
                }
            } else buildAnnotatedString { append(line.text) }
            val color = when { active -> p.accent; i < pos.lineIndex -> p.muted; else -> p.onBackground.copy(alpha = 0.7f) }
            Column(
                Modifier.fillMaxWidth().clickable(enabled = lyrics.synced) { onLineClick(line.startMs) }.padding(horizontal = 24.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text, color = color, fontSize = if (active) 24.sp else 19.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyMedium,
                )
                val original = line.original
                if (showOriginal && original != null) {
                    Text(original, color = color.copy(alpha = color.alpha * 0.75f), fontSize = if (active) 16.sp else 13.sp, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodySmall)
                }
                if (active && line.text.isNotBlank()) {
                    val bookmarked = isBookmarked(line)
                    IconButton(onClick = { onToggleBookmark(line) }, modifier = Modifier.size(28.dp)) {
                        Icon(
                            if (bookmarked) Icons.Filled.Star else Icons.Outlined.StarBorder,
                            if (bookmarked) "Remove bookmark" else "Bookmark this line",
                            tint = if (bookmarked) p.accent else p.muted,
                        )
                    }
                }
            }
        }
    }
}
