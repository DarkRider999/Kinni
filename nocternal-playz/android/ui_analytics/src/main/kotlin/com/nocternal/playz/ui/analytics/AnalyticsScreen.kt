package com.nocternal.playz.ui.analytics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.designsystem.DarkBackground
import com.nocternal.playz.designsystem.DarkSurface
import com.nocternal.playz.designsystem.NeonCyan
import com.nocternal.playz.designsystem.NeonGold
import com.nocternal.playz.designsystem.NeonPink
import com.nocternal.playz.designsystem.NeonPurple
import com.nocternal.playz.designsystem.NocternalAppTheme
import java.text.NumberFormat
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(viewModel: AnalyticsViewModel, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val totalPlays by viewModel.totalPlayCount.collectAsStateWithLifecycle()
    val favourites by viewModel.favouriteCount.collectAsStateWithLifecycle()
    val averageBpm by viewModel.averageBpm.collectAsStateWithLifecycle()
    val weeklyMs by viewModel.weeklyListeningMs.collectAsStateWithLifecycle()
    val topTracks by viewModel.topTracks.collectAsStateWithLifecycle()
    val genres by viewModel.genreStats.collectAsStateWithLifecycle()

    NocternalAppTheme {
        Scaffold(
            modifier = modifier,
            containerColor = DarkBackground,
            topBar = {
                TopAppBar(
                    title = {
                        Text("ANALYTICS", color = Color.White, fontWeight = FontWeight.Black, letterSpacing = 4.sp)
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NeonCyan)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground),
                )
            },
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(DarkBackground)
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        KpiChip("TOTAL PLAYS", NumberFormat.getIntegerInstance().format(totalPlays), NeonPink, Modifier.weight(1f))
                        KpiChip("FAVS", favourites.toString(), NeonCyan, Modifier.weight(1f))
                        KpiChip("AVG BPM", if (averageBpm > 0f) averageBpm.roundToInt().toString() else "--", NeonPink, Modifier.weight(1f))
                    }
                }
                item { WeeklyListeningCard(weeklyMs) }
                item { SectionHeader("TOP TRACKS") }
                if (topTracks.isEmpty()) {
                    item { EmptyHint("No plays recorded yet") }
                } else {
                    itemsIndexed(topTracks, key = { _, stat -> stat.trackId }) { index, stat ->
                        TopTrackRow(rank = index + 1, stat = stat)
                    }
                }
                item { SectionHeader("GENRE BREAKDOWN") }
                if (genres.isEmpty()) {
                    item { EmptyHint("Library is empty") }
                } else {
                    val totalTracks = genres.sumOf { it.trackCount }.coerceAtLeast(1)
                    itemsIndexed(genres, key = { _, g -> g.genre }) { _, genre ->
                        GenreBar(genre = genre.genre, fraction = genre.trackCount.toFloat() / totalTracks)
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiChip(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.8f)),
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(label, color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(value, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1)
        }
    }
}

@Composable
private fun WeeklyListeningCard(weeklyMs: Long) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        border = BorderStroke(1.dp, NeonPurple.copy(alpha = 0.8f)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("WEEKLY LISTENING TIME", color = NeonCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(formatDuration(weeklyMs), color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        color = NeonPink,
        fontWeight = FontWeight.Black,
        letterSpacing = 2.sp,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun EmptyHint(text: String) {
    Text(text, color = Color.White.copy(alpha = 0.5f), fontSize = 13.sp)
}

@Composable
private fun TopTrackRow(rank: Int, stat: TrackStat) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(DarkSurface, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "$rank",
            color = if (rank <= 3) NeonGold else NeonCyan,
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
            modifier = Modifier.width(32.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(stat.title, color = Color.White, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(stat.artist, color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(
            Modifier
                .background(NeonPink.copy(alpha = 0.18f), RoundedCornerShape(50))
                .padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Text("▶ ${stat.playCount} plays", color = NeonPink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun GenreBar(genre: String, fraction: Float) {
    val percent = (fraction * 100).roundToInt()
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            genre,
            color = Color.White,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(96.dp),
        )
        Canvas(
            Modifier
                .weight(1f)
                .height(14.dp),
        ) {
            val radius = CornerRadius(size.height / 2, size.height / 2)
            drawRoundRect(color = DarkSurface, cornerRadius = radius)
            val filled = size.width * fraction.coerceIn(0f, 1f)
            if (filled > 0f) {
                drawRoundRect(
                    brush = Brush.horizontalGradient(listOf(NeonPurple, NeonPink, NeonCyan), endX = size.width),
                    size = Size(filled, size.height),
                    cornerRadius = radius,
                )
            }
        }
        Text(
            "$percent%",
            color = NeonCyan,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .width(44.dp)
                .padding(start = 8.dp),
        )
    }
}

private fun formatDuration(ms: Long): String {
    val totalMinutes = ms / 60_000
    return "${totalMinutes / 60}h ${totalMinutes % 60}m"
}
