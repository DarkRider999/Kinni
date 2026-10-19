package com.nocternal.playz.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.library.AudioFormatInfo
import java.util.concurrent.TimeUnit

/** Audio Inspector (spec #11): format facts for the track currently playing. */
@Composable
fun AudioInspectorScreen(c: AppContainer, onBack: () -> Unit) {
    val p = Neon.palette
    val playback by c.audio.state.collectAsStateWithLifecycle()
    val track = playback.track
    var format by remember(track?.id) { mutableStateOf<AudioFormatInfo?>(null) }
    var loading by remember(track?.id) { mutableStateOf(track != null) }

    LaunchedEffect(track?.id) {
        format = track?.let { c.audioFormatReader.read(it.uri) }
        loading = false
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Audio Inspector", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        if (track == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Play something to inspect it.", color = p.muted) }
            return@Column
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            GlowCard(Modifier.fillMaxWidth()) {
                Text(track.title, color = p.onBackground, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                Text(track.artist, color = p.muted, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
            }
            GlowCard(Modifier.fillMaxWidth()) {
                InfoRow("Duration", formatDuration(track.durationMs))
                InfoRow("Codec", if (loading) "Reading…" else format?.codec ?: "Unknown")
                InfoRow("Bitrate", if (loading) "Reading…" else format?.bitrateKbps?.let { "$it kbps" } ?: "Not available")
                InfoRow("Sample rate", if (loading) "Reading…" else format?.sampleRateHz?.let { "${it / 1000f} kHz" } ?: "Not available")
                InfoRow("Channels", if (loading) "Reading…" else format?.channels?.let { if (it == 1) "Mono" else if (it == 2) "Stereo" else "$it channels" } ?: "Not available")
                InfoRow("Loudness", track.loudnessDb?.let { "%.1f LUFS".format(it) } ?: "Not yet analyzed")
                InfoRow("Dynamic range", "Not available — needs a full-track analysis pass")
            }
        }
    }
}

private fun formatDuration(ms: Long): String {
    val totalSec = TimeUnit.MILLISECONDS.toSeconds(ms)
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}

@Composable
private fun InfoRow(label: String, value: String) {
    val p = Neon.palette
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = p.muted, style = MaterialTheme.typography.bodyMedium)
        Text(value, color = p.onBackground, style = MaterialTheme.typography.bodyMedium)
    }
}
