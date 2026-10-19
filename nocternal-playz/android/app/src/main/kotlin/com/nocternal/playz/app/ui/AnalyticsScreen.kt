package com.nocternal.playz.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.intelligence.AnalyticsEngine
import com.nocternal.playz.intelligence.ArtistTotal
import com.nocternal.playz.intelligence.HeatmapCell
import com.nocternal.playz.intelligence.MusicDna
import com.nocternal.playz.intelligence.Share
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreCatalog
import java.time.LocalDate
import java.util.concurrent.TimeUnit

/**
 * Listening Analytics (Phase 1, spec item #51-57): a heatmap, this month's totals, genre and mood
 * distributions, a daily timeline, top artists and listening streaks — all read straight from the
 * [PlayEvent] history the library already records, so it is private-mode aware for free (private
 * plays are never recorded in the first place).
 */
@Composable
fun AnalyticsScreen(history: List<PlayEvent>, tracks: List<Track>, privateMode: Boolean, musicDna: MusicDna?, onBack: () -> Unit) {
    val p = Neon.palette
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Listening Analytics", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        if (privateMode) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Private mode is on — nothing is being recorded.", color = p.muted, style = MaterialTheme.typography.bodyMedium)
            }
            return@Column
        }
        if (history.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Keep listening to see your stats here.", color = p.muted, style = MaterialTheme.typography.bodyMedium)
            }
            return@Column
        }

        val engine = remember { AnalyticsEngine() }
        val trackMap = remember(tracks) { tracks.associateBy { it.id } }
        val streak = remember(history) { engine.streak(history) }
        val timeline = remember(history) { engine.dailyTimeline(history) }
        val heatmap = remember(history) { engine.heatmap(history) }
        val genreDist = remember(history, trackMap) { engine.genreDistribution(history, trackMap) }
        val moodDist = remember(history, trackMap) { engine.moodDistribution(history, trackMap) }
        val topArtists = remember(history, trackMap) { engine.topArtists(history, trackMap) }

        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StreakCard("Current streak", streak.currentDays, Modifier.weight(1f))
                    StreakCard("Longest streak", streak.longestDays, Modifier.weight(1f))
                }
            }
            item { SectionTitle("Last 14 days") }
            item { DailyTimelineChart(timeline) }
            item { SectionTitle("Listening heatmap") }
            item { HeatmapGrid(heatmap) }
            if (genreDist.isNotEmpty()) {
                item { SectionTitle("Genres") }
                item { DistributionBars(genreDist.entries.sortedByDescending { it.value }.take(6).map { (GenreCatalog.byId(it.key)?.displayName ?: it.key) to it.value }) }
            }
            if (moodDist.isNotEmpty()) {
                item { SectionTitle("Moods") }
                item { DistributionBars(moodDist.entries.sortedByDescending { it.value }.take(6).map { it.key.label to it.value }) }
            }
            if (topArtists.isNotEmpty()) {
                item { SectionTitle("Top artists") }
                items(topArtists) { ArtistRow(it) }
            }
            if (musicDna != null) {
                item { SectionTitle("Your Music DNA") }
                item { PersonalityCard(musicDna.personality) }
                if (musicDna.genreShares.isNotEmpty()) { item { Text("Genre DNA", color = p.muted, style = MaterialTheme.typography.labelSmall) }; item { ShareBars(musicDna.genreShares) } }
                if (musicDna.moodShares.isNotEmpty()) { item { Text("Mood DNA", color = p.muted, style = MaterialTheme.typography.labelSmall) }; item { ShareBars(musicDna.moodShares) } }
                item { Text("Energy by time of day", color = p.muted, style = MaterialTheme.typography.labelSmall) }
                item {
                    ShareBars(
                        listOf(
                            Share("Morning", musicDna.energyByPartOfDay.morning), Share("Afternoon", musicDna.energyByPartOfDay.afternoon),
                            Share("Evening", musicDna.energyByPartOfDay.evening), Share("Late night", musicDna.energyByPartOfDay.lateNight),
                        ),
                    )
                }
            }
        }
    }
}

@Composable
private fun PersonalityCard(personality: com.nocternal.playz.intelligence.ListeningPersonality) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth()) {
        Text(personality.label, style = MaterialTheme.typography.titleMedium, color = p.accent)
        Text(personality.description, color = p.muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun ShareBars(shares: List<Share>) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth()) {
        shares.forEach { s ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(s.label, color = p.onBackground, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(96.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Box(Modifier.weight(1f).height(10.dp).clip(RoundedCornerShape(5.dp)).background(p.muted.copy(alpha = 0.15f))) {
                    Box(Modifier.fillMaxWidth(s.fraction.coerceIn(0.02f, 1f)).height(10.dp).clip(RoundedCornerShape(5.dp)).background(p.accent))
                }
                Text(" ${(s.fraction * 100).toInt()}%", color = p.muted, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun StreakCard(label: String, days: Int, modifier: Modifier = Modifier) {
    val p = Neon.palette
    GlowCard(modifier) {
        Text("$days", style = MaterialTheme.typography.headlineMedium, color = p.accent)
        Text(if (days == 1) "$label · 1 day" else "$label · $days days", color = p.muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun DailyTimelineChart(timeline: Map<LocalDate, Long>) {
    val p = Neon.palette
    val days = remember(timeline) {
        val today = LocalDate.now()
        (13 downTo 0).map { today.minusDays(it.toLong()) }
    }
    val maxMs = remember(timeline) { (timeline.values.maxOrNull() ?: 1L).coerceAtLeast(1L) }
    GlowCard(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().height(90.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom) {
            days.forEach { day ->
                val ms = timeline[day] ?: 0L
                val fraction = (ms.toFloat() / maxMs).coerceIn(0.02f, 1f)
                Box(
                    Modifier.weight(1f).fillMaxWidth().height((90 * fraction).dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(if (ms > 0) p.accent else p.muted.copy(alpha = 0.25f)),
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Text("${TimeUnit.MILLISECONDS.toMinutes(timeline.values.sum())} min in the last 14 days", color = p.muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun HeatmapGrid(cells: List<HeatmapCell>) {
    val p = Neon.palette
    val byCell = remember(cells) { cells.associateBy { it.dayOfWeek to it.hour } }
    val maxMs = remember(cells) { (cells.maxOfOrNull { it.listenedMs } ?: 1L).coerceAtLeast(1L) }
    GlowCard(Modifier.fillMaxWidth()) {
        Canvas(Modifier.fillMaxWidth().height(140.dp)) {
            val cols = 24
            val rows = 7
            val cellW = size.width / cols
            val cellH = size.height / rows
            for (day in 1..rows) {
                for (hour in 0 until cols) {
                    val ms = byCell[day to hour]?.listenedMs ?: 0L
                    val intensity = (ms.toFloat() / maxMs).coerceIn(0f, 1f)
                    val color = if (intensity <= 0f) p.surface else p.accent.copy(alpha = 0.15f + 0.75f * intensity)
                    drawRect(
                        color = color,
                        topLeft = androidx.compose.ui.geometry.Offset(hour * cellW, (day - 1) * cellH),
                        size = androidx.compose.ui.geometry.Size(cellW - 1.5f, cellH - 1.5f),
                    )
                }
            }
        }
        Text("Mon → Sun, midnight → 11pm", color = p.muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun DistributionBars(entries: List<Pair<String, Long>>) {
    val p = Neon.palette
    val max = (entries.maxOfOrNull { it.second } ?: 1L).coerceAtLeast(1L)
    GlowCard(Modifier.fillMaxWidth()) {
        entries.forEach { (label, ms) ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = p.onBackground, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(96.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Box(Modifier.weight(1f).height(10.dp).clip(RoundedCornerShape(5.dp)).background(p.muted.copy(alpha = 0.15f))) {
                    Box(Modifier.fillMaxWidth((ms.toFloat() / max).coerceIn(0.03f, 1f)).height(10.dp).clip(RoundedCornerShape(5.dp)).background(p.accent))
                }
            }
        }
    }
}

@Composable
private fun ArtistRow(artist: ArtistTotal) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(artist.artist, color = p.onBackground, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${artist.plays} plays · ${TimeUnit.MILLISECONDS.toMinutes(artist.listenedMs)} min", color = p.muted, style = MaterialTheme.typography.labelSmall)
        }
    }
}
