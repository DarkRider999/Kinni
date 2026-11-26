package com.nocternal.playz.ui.dj

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
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
    val showDeckAPicker by viewModel.showDeckAPicker.collectAsStateWithLifecycle()
    val showDeckBPicker by viewModel.showDeckBPicker.collectAsStateWithLifecycle()
    val availableTracks by viewModel.availableTracks.collectAsStateWithLifecycle()
    val manualBpmInput by viewModel.manualBpmInput.collectAsStateWithLifecycle()
    val fxReverb by viewModel.fxReverb.collectAsStateWithLifecycle()
    val fxDelay by viewModel.fxDelay.collectAsStateWithLifecycle()
    val fxFlanger by viewModel.fxFlanger.collectAsStateWithLifecycle()
    val fxEcho by viewModel.fxEcho.collectAsStateWithLifecycle()
    val fxPhaser by viewModel.fxPhaser.collectAsStateWithLifecycle()
    val fxFilter by viewModel.fxFilter.collectAsStateWithLifecycle()

    // Tap-tempo timestamps; only the most recent taps feed the average.
    val tapTimes = remember { mutableStateListOf<Long>() }

    NocternalAppTheme {
        if (showDeckAPicker) {
            TrackPickerSheet(
                tracks = availableTracks,
                onSelect = viewModel::loadTrackToDeckA,
                onDismiss = { viewModel.showDeckAPicker.value = false },
            )
        }
        if (showDeckBPicker) {
            TrackPickerSheet(
                tracks = availableTracks,
                onSelect = viewModel::loadTrackToDeckB,
                onDismiss = { viewModel.showDeckBPicker.value = false },
            )
        }
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
                    DeckPanel("DECK A", currentTrack, deckAVolume, NeonPink, { viewModel.deckAVolume.value = it }, { viewModel.showDeckAPicker.value = true })
                    DeckPanel("DECK B", nextTrack, deckBVolume, NeonCyan, { viewModel.deckBVolume.value = it }, { viewModel.showDeckBPicker.value = true })
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
                            viewModel.autoSyncToDeckB()
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

                ConsoleSection("MANUAL BPM") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = manualBpmInput,
                            onValueChange = { viewModel.manualBpmInput.value = it },
                            label = { Text("BPM", color = NeonGold, fontSize = 11.sp) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = NeonGold,
                                unfocusedBorderColor = NeonGold.copy(alpha = 0.4f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                cursorColor = NeonGold,
                            ),
                            modifier = Modifier.weight(1f),
                        )
                        ConsoleButton("APPLY", NeonGold) { viewModel.applyManualBpm(manualBpmInput) }
                    }
                }

                ConsoleSection("SAMPLER PADS") {
                    val padLabels = listOf("KICK", "SNARE", "HI-HAT", "CLAP", "BASS DROP", "FX1", "FX2", "LOOP")
                    val padColors = listOf(NeonPink, NeonPurple, NeonCyan, NeonGold, NeonPink, NeonPurple, NeonCyan, NeonGold)
                    padLabels.chunked(4).forEachIndexed { rowIdx, row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                            row.forEachIndexed { colIdx, label ->
                                val idx = rowIdx * 4 + colIdx
                                val accent = padColors[idx % padColors.size]
                                Button(
                                    onClick = { /* pad trigger — audio engine integration point */ },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(0.dp),
                                    border = BorderStroke(1.dp, accent),
                                    colors = ButtonDefaults.buttonColors(containerColor = accent.copy(alpha = 0.18f), contentColor = accent),
                                    modifier = Modifier.weight(1f).height(52.dp),
                                ) {
                                    Text(label, fontWeight = FontWeight.Black, fontSize = 9.sp)
                                }
                            }
                        }
                        if (rowIdx < padLabels.chunked(4).size - 1) Spacer(Modifier.height(6.dp))
                    }
                }

                ConsoleSection("FX") {
                    val fxList = listOf(
                        "REVERB" to fxReverb, "DELAY" to fxDelay, "FLANGER" to fxFlanger,
                        "ECHO" to fxEcho, "PHASER" to fxPhaser, "FILTER" to fxFilter,
                    )
                    val fxSetters: List<(Boolean) -> Unit> = listOf(
                        { viewModel.fxReverb.value = it }, { viewModel.fxDelay.value = it },
                        { viewModel.fxFlanger.value = it }, { viewModel.fxEcho.value = it },
                        { viewModel.fxPhaser.value = it }, { viewModel.fxFilter.value = it },
                    )
                    fxList.chunked(3).forEachIndexed { rowIdx, row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                            row.forEachIndexed { colIdx, (label, active) ->
                                val idx = rowIdx * 3 + colIdx
                                val accent = NeonPurple
                                Button(
                                    onClick = { fxSetters[idx](!active) },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(0.dp),
                                    border = BorderStroke(1.dp, if (active) accent else accent.copy(alpha = 0.4f)),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (active) accent.copy(alpha = 0.35f) else DarkBackground,
                                        contentColor = if (active) accent else accent.copy(alpha = 0.5f),
                                    ),
                                    modifier = Modifier.weight(1f).height(44.dp),
                                ) {
                                    Text(label, fontWeight = FontWeight.Bold, fontSize = 9.sp)
                                }
                            }
                        }
                        if (rowIdx < fxList.chunked(3).size - 1) Spacer(Modifier.height(6.dp))
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
    onLoad: () -> Unit,
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurface)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text(title, color = accent, fontWeight = FontWeight.Black, fontSize = 13.sp, letterSpacing = 2.sp)
            ConsoleButton("LOAD", accent, onClick = onLoad)
        }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrackPickerSheet(
    tracks: List<TrackEntity>,
    onSelect: (TrackEntity) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = DarkSurface,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        Text(
            "Load Track",
            color = NeonPink,
            fontWeight = FontWeight.Black,
            fontSize = 16.sp,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
        if (tracks.isEmpty()) {
            Text(
                "No tracks in library — scan your device first",
                color = Color.White.copy(alpha = 0.5f),
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn {
                items(tracks) { track ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(track) }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                track.title,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                buildString {
                                    append(track.artist)
                                    if (track.camelotKey.isNotBlank()) append(" · Key: ${track.camelotKey}")
                                    if (track.bpm > 0f) append(" · %.0f BPM".format(track.bpm))
                                },
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    HorizontalDivider(color = Color.White.copy(alpha = 0.08f))
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun neonSliderColors(accent: Color) = SliderDefaults.colors(
    thumbColor = accent,
    activeTrackColor = accent,
    inactiveTrackColor = accent.copy(alpha = 0.2f),
)
