package com.nocternal.playz.ui.dj

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.database.entity.CuePointEntity
import com.nocternal.playz.database.entity.TrackEntity
import com.nocternal.playz.designsystem.DarkBackground
import com.nocternal.playz.designsystem.DarkSurface
import com.nocternal.playz.designsystem.NeonCyan
import com.nocternal.playz.designsystem.NeonGold
import com.nocternal.playz.designsystem.NeonPink
import com.nocternal.playz.designsystem.NeonPurple
import com.nocternal.playz.designsystem.NocternalAppTheme

private const val HOT_CUE_COUNT = 8
private const val EQ_RANGE_DB = 12f
private val HotCueColors = listOf(NeonPink, NeonPurple, NeonCyan)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DjHubScreen(viewModel: DjHubViewModel, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val currentTrack by viewModel.currentTrack.collectAsStateWithLifecycle()
    val nextTrack by viewModel.nextTrack.collectAsStateWithLifecycle()
    val cuePoints by viewModel.cuePoints.collectAsStateWithLifecycle()
    val masterBpm by viewModel.masterBpm.collectAsStateWithLifecycle()
    val tempo by viewModel.tempoMultiplier.collectAsStateWithLifecycle()
    val crossfader by viewModel.crossfaderPosition.collectAsStateWithLifecycle()
    val deckAVolume by viewModel.deckAVolume.collectAsStateWithLifecycle()
    val deckBVolume by viewModel.deckBVolume.collectAsStateWithLifecycle()
    val eqLow by viewModel.eqLow.collectAsStateWithLifecycle()
    val eqMid by viewModel.eqMid.collectAsStateWithLifecycle()
    val eqHigh by viewModel.eqHigh.collectAsStateWithLifecycle()

    // Tap-tempo timestamps; only the most recent taps feed the average.
    val tapTimes = remember { mutableStateListOf<Long>() }

    NocternalAppTheme {
        Scaffold(
            modifier = modifier,
            containerColor = DarkBackground,
            topBar = {
                TopAppBar(
                    title = { Text("DJ HUB", color = NeonPink, fontWeight = FontWeight.Black, letterSpacing = 3.sp) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NeonCyan)
                        }
                    },
                    actions = {
                        NeonBadge("BPM: %.1f".format(masterBpm * tempo), NeonCyan)
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground),
                )
            },
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DeckPanel("DECK A", currentTrack, deckAVolume, NeonPink, { viewModel.deckAVolume.value = it })
                    DeckPanel("DECK B", nextTrack, deckBVolume, NeonCyan, { viewModel.deckBVolume.value = it })
                }

                ConsoleSection("EQ") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        EqKnob("LOW", eqLow, NeonPink) { viewModel.eqLow.value = it }
                        EqKnob("MID", eqMid, NeonPurple) { viewModel.eqMid.value = it }
                        EqKnob("HIGH", eqHigh, NeonCyan) { viewModel.eqHigh.value = it }
                    }
                }

                ConsoleSection("CROSSFADER") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("A", color = NeonPink, fontWeight = FontWeight.Bold)
                        Slider(
                            value = crossfader,
                            onValueChange = viewModel::updateCrossfader,
                            valueRange = 0f..1f,
                            colors = neonSliderColors(NeonPurple),
                            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                        )
                        Text("B", color = NeonCyan, fontWeight = FontWeight.Bold)
                    }
                }

                ConsoleSection("HOT CUES") {
                    HotCueRow(
                        cuePoints = cuePoints,
                        enabled = currentTrack != null,
                        onSet = { index ->
                            currentTrack?.let { track ->
                                // No transport/playhead is wired into this module yet, so new cues land at 0 ms.
                                viewModel.setCuePoint(track.id, 0L, "Cue ${index + 1}", isHotCue = true, hotCueIndex = index)
                            }
                        },
                        onDelete = { cue -> viewModel.deleteCuePoint(cue.id) },
                    )
                }

                ConsoleSection("TEMPO") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("x%.2f".format(tempo), color = NeonGold, fontSize = 13.sp)
                        Slider(
                            value = tempo,
                            onValueChange = viewModel::updateTempo,
                            valueRange = DjHubViewModel.MIN_TEMPO..DjHubViewModel.MAX_TEMPO,
                            colors = neonSliderColors(NeonGold),
                            modifier = Modifier.weight(1f),
                        )
                        ConsoleButton("SYNC", NeonCyan, enabled = nextTrack != null) {
                            // Match the effective master BPM to deck B's track.
                            nextTrack?.let { if (masterBpm > 0f) viewModel.updateTempo(it.bpm / masterBpm) }
                        }
                        ConsoleButton("TAP", NeonPink) {
                            val now = System.currentTimeMillis()
                            if (tapTimes.isNotEmpty() && now - tapTimes.last() > 2000L) tapTimes.clear()
                            tapTimes.add(now)
                            while (tapTimes.size > 5) tapTimes.removeAt(0)
                            if (tapTimes.size >= 2) {
                                val avgIntervalMs = (tapTimes.last() - tapTimes.first()).toFloat() / (tapTimes.size - 1)
                                if (avgIntervalMs > 0f) {
                                    viewModel.masterBpm.value = 60_000f / avgIntervalMs
                                    viewModel.updateTempo(1f)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RowScope.DeckPanel(
    title: String,
    track: TrackEntity?,
    volume: Float,
    accent: Color,
    onVolumeChange: (Float) -> Unit,
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurface)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, color = accent, fontWeight = FontWeight.Black, fontSize = 13.sp, letterSpacing = 2.sp)
        Text(
            track?.title ?: "No track loaded",
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            track?.let { "${it.artist} — Key: ${it.camelotKey}" } ?: "—",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text("Volume", color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
        Slider(value = volume, onValueChange = onVolumeChange, valueRange = 0f..1f, colors = neonSliderColors(accent))
    }
}

@Composable
private fun RowScope.EqKnob(label: String, valueDb: Float, accent: Color, onChange: (Float) -> Unit) {
    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Slider(
            value = valueDb,
            onValueChange = onChange,
            valueRange = -EQ_RANGE_DB..EQ_RANGE_DB,
            colors = neonSliderColors(accent),
        )
        Text("%+.1f dB".format(valueDb), color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
    }
}

@Composable
private fun HotCueRow(
    cuePoints: List<CuePointEntity>,
    enabled: Boolean,
    onSet: (Int) -> Unit,
    onDelete: (CuePointEntity) -> Unit,
) {
    val hotCues = cuePoints.filter { it.isHotCue && it.hotCueIndex != null }.associateBy { it.hotCueIndex!! }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(HOT_CUE_COUNT) { index ->
            val color = HotCueColors[index % HotCueColors.size]
            val cue = hotCues[index]
            // Tap an empty pad to set a hot cue; tap a set pad to clear it.
            Button(
                onClick = { if (cue != null) onDelete(cue) else onSet(index) },
                enabled = enabled,
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(0.dp),
                border = BorderStroke(1.dp, color),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (cue != null) color else DarkBackground,
                    contentColor = if (cue != null) DarkBackground else color,
                ),
                modifier = Modifier.weight(1f).height(40.dp),
            ) {
                Text("${index + 1}", fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun ConsoleSection(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurface)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(title, color = NeonPurple, fontWeight = FontWeight.Black, fontSize = 12.sp, letterSpacing = 2.sp)
        content()
    }
}

@Composable
private fun ConsoleButton(text: String, color: Color, enabled: Boolean = true, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        border = BorderStroke(1.dp, if (enabled) color else color.copy(alpha = 0.3f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = color),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(text, fontWeight = FontWeight.Bold, fontSize = 12.sp)
    }
}

@Composable
private fun NeonBadge(text: String, color: Color) {
    Text(
        text,
        color = color,
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
        modifier = Modifier
            .padding(end = 12.dp)
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
private fun neonSliderColors(accent: Color) = SliderDefaults.colors(
    thumbColor = accent,
    activeTrackColor = accent,
    inactiveTrackColor = accent.copy(alpha = 0.2f),
)
