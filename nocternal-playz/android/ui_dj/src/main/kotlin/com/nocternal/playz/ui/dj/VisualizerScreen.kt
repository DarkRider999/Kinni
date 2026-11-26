package com.nocternal.playz.ui.dj

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.designsystem.DarkBackground
import com.nocternal.playz.designsystem.NeonCyan
import com.nocternal.playz.designsystem.NeonGold
import com.nocternal.playz.designsystem.NeonGreen
import com.nocternal.playz.designsystem.NeonPink
import com.nocternal.playz.designsystem.NeonPurple
import com.nocternal.playz.designsystem.NocternalAppTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisualizerScreen(viewModel: VisualizerViewModel, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val bands by viewModel.spectrumBands.collectAsStateWithLifecycle()
    val bpm by viewModel.bpm.collectAsStateWithLifecycle()
    val isPlaying by viewModel.isPlaying.collectAsStateWithLifecycle()
    val currentKey by viewModel.currentKey.collectAsStateWithLifecycle()
    val energy by viewModel.energyLevel.collectAsStateWithLifecycle()

    // One animation per band; BAND_COUNT is constant so the call order is stable across recompositions.
    val animatedBands = List(VisualizerViewModel.BAND_COUNT) { i ->
        animateFloatAsState(
            targetValue = bands.getOrElse(i) { 0f }.coerceIn(0f, 1f),
            animationSpec = tween(durationMillis = VisualizerViewModel.UPDATE_INTERVAL_MS.toInt()),
            label = "band$i",
        ).value
    }

    NocternalAppTheme {
        Scaffold(
            modifier = modifier,
            containerColor = DarkBackground,
            topBar = {
                TopAppBar(
                    title = { Text("VISUALIZER", color = NeonCyan, fontWeight = FontWeight.Black, letterSpacing = 3.sp) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NeonCyan)
                        }
                    },
                    actions = {
                        IconButton(onClick = {
                            if (isPlaying) viewModel.stopVisualization() else viewModel.startVisualization()
                        }) {
                            Icon(
                                if (isPlaying) Icons.Filled.Stop else Icons.Filled.PlayArrow,
                                contentDescription = if (isPlaying) "Stop" else "Play",
                                tint = NeonPink,
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground),
                )
            },
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Canvas(modifier = Modifier.fillMaxWidth().weight(1f)) {
                    val count = animatedBands.size
                    val slot = size.width / count
                    val barWidth = slot * 0.7f
                    val maxHeight = size.height
                    animatedBands.forEachIndexed { i, level ->
                        val barHeight = level * maxHeight
                        if (barHeight <= 0f) return@forEachIndexed
                        val top = maxHeight - barHeight
                        drawRoundRect(
                            brush = Brush.verticalGradient(
                                colors = listOf(NeonCyan, NeonPurple),
                                startY = top,
                                endY = maxHeight,
                            ),
                            topLeft = Offset(i * slot + (slot - barWidth) / 2f, top),
                            size = Size(barWidth, barHeight),
                            cornerRadius = CornerRadius(barWidth / 6f, barWidth / 6f),
                        )
                    }
                }

                Row(modifier = Modifier.fillMaxWidth()) {
                    VisualizerViewModel.BAND_LABELS.forEach { label ->
                        Text(
                            label,
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 9.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, androidx.compose.ui.Alignment.CenterHorizontally),
                ) {
                    HudChip("BPM", "%.1f".format(bpm), NeonCyan)
                    HudChip("KEY", currentKey, NeonPurple)
                    HudChip("ENERGY", "${(energy * 100).toInt()}%", if (energy >= 0.66f) NeonPink else if (energy >= 0.33f) NeonGold else NeonGreen)
                }
            }
        }
    }
}

@Composable
private fun HudChip(label: String, value: String, color: Color) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(label, color = color.copy(alpha = 0.7f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(value, color = color, fontSize = 13.sp, fontWeight = FontWeight.Black)
    }
}
