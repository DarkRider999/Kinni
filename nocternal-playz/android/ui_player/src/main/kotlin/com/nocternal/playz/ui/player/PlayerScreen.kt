package com.nocternal.playz.ui.player

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Equalizer
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Lyrics
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nocternal.playz.ai.NeonArtSpec
import com.nocternal.playz.audio.PlaybackState
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonIconButton
import com.nocternal.playz.designsystem.neonGlow
import com.nocternal.playz.lighting.LightingCanvas
import com.nocternal.playz.lighting.LightingState
import com.nocternal.playz.lighting.NeonLightBar
import com.nocternal.playz.lyrics.Lyrics
import com.nocternal.playz.model.RepeatMode
import com.nocternal.playz.model.SpectrumFrame

class PlayerCallbacks(
    val togglePlay: () -> Unit = {},
    val next: () -> Unit = {},
    val previous: () -> Unit = {},
    val seek: (Long) -> Unit = {},
    val shuffle: () -> Unit = {},
    val repeat: () -> Unit = {},
    val like: () -> Unit = {},
    val openEq: () -> Unit = {},
    val sleep: (minutes: Int?) -> Unit = {},
    val sleepEndOfTrack: () -> Unit = {},
    val toggleAutoMix: () -> Unit = {},
    val setAutoMixEnergyRise: (Boolean) -> Unit = {},
    val openAssistant: () -> Unit = {},
    val collapse: () -> Unit = {},
)

/** Wraps a plain icon button so its label always shows as a tooltip on hover or long-press. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TooltipIconButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    TooltipBox(
        positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
        tooltip = { PlainTooltip { Text(label) } },
        state = rememberTooltipState(),
    ) { IconButton(onClick = onClick, modifier = modifier, content = content) }
}

/** Player screen (spec §10): neon-framed album art, waveform seek bar, neon controls, light bar and lyrics. */
@Composable
fun PlayerScreen(
    state: PlaybackState,
    spectrum: SpectrumFrame,
    lighting: LightingState,
    lyrics: Lyrics?,
    isFavorite: Boolean,
    lyricsLoading: Boolean = false,
    artSpec: NeonArtSpec?,
    sleepRemainingMs: Long?,
    callbacks: PlayerCallbacks,
    modifier: Modifier = Modifier,
) {
    val p = Neon.palette
    var showLyrics by remember { mutableStateOf(false) }
    var sleepMenu by remember { mutableStateOf(false) }
    var autoMixMenu by remember { mutableStateOf(false) }
    val track = state.track

    Box(modifier.fillMaxSize()) {
        lighting.backdropAnimation?.let { LightingCanvas(it, spectrum, Modifier.fillMaxSize(), intensity = 0.35f, running = state.isPlaying) }
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TooltipIconButton("Collapse", callbacks.collapse) { Icon(Icons.Filled.KeyboardArrowDown, "Collapse", tint = p.onBackground) }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("NOW PLAYING", style = MaterialTheme.typography.labelSmall, color = p.accent)
                    Text(state.source.label + (if (state.autoMix) " · DJ auto-mix" else ""), style = MaterialTheme.typography.labelSmall, color = p.muted)
                }
                TooltipIconButton("Lyrics", { showLyrics = !showLyrics }) { Icon(Icons.Filled.Lyrics, "Lyrics", tint = if (showLyrics) p.accent else p.onBackground) }
            }
            Spacer(Modifier.height(12.dp))

            AnimatedContent(targetState = showLyrics, label = "art-lyrics", modifier = Modifier.weight(1f)) { lyricsMode ->
                if (lyricsMode) {
                    LyricsView(lyrics, state.positionMs, Modifier.fillMaxSize(), loading = lyricsLoading, onLineClick = callbacks.seek)
                } else {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        SpinningAlbumArt(track?.artworkUri, artSpec, spinning = state.isPlaying, modifier = Modifier.fillMaxWidth(0.96f).aspectRatio(1f))
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(track?.title ?: "Nothing playing", style = MaterialTheme.typography.headlineSmall, color = p.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(track?.artist ?: "Pick a song, a genre or a station", style = MaterialTheme.typography.bodyMedium, color = p.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val meta = listOfNotNull(track?.bpm?.let { "${it.toInt()} BPM" }, track?.camelotKey?.let { "Key $it" })
                    if (meta.isNotEmpty()) Text(meta.joinToString("  ·  "), style = MaterialTheme.typography.labelSmall, color = p.accent)
                }
                TooltipIconButton("Favorite", callbacks.like) {
                    Icon(if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, "Favorite", tint = if (isFavorite) p.secondary else p.onBackground)
                }
            }
            Spacer(Modifier.height(8.dp))
            WaveformSeekBar(track?.id, state.positionMs, state.durationMs, spectrum.bass, callbacks.seek, Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                NeonIconButton(Icons.Filled.Shuffle, "Shuffle", size = 44.dp, active = state.shuffle, onClick = callbacks.shuffle)
                NeonIconButton(Icons.Filled.SkipPrevious, "Previous", size = 52.dp, onClick = callbacks.previous)
                Box(
                    Modifier.size(78.dp).neonGlow(p.accent, p.glow * (0.7f + 0.3f * spectrum.bass), corner = 39.dp)
                        .clip(RoundedCornerShape(39.dp)).background(Brush.linearGradient(listOf(p.accent, p.secondary))),
                    contentAlignment = Alignment.Center,
                ) {
                    TooltipIconButton(if (state.isPlaying) "Pause" else "Play", callbacks.togglePlay, modifier = Modifier.fillMaxSize()) {
                        Icon(if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (state.isPlaying) "Pause" else "Play", tint = androidx.compose.ui.graphics.Color.Black, modifier = Modifier.size(40.dp))
                    }
                }
                NeonIconButton(Icons.Filled.SkipNext, "Next", size = 52.dp, onClick = callbacks.next)
                NeonIconButton(if (state.repeat == RepeatMode.ONE) Icons.Filled.RepeatOne else Icons.Filled.Repeat, "Repeat", size = 44.dp, active = state.repeat != RepeatMode.OFF, onClick = callbacks.repeat)
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                NeonIconButton(Icons.Filled.Equalizer, "EQ & FX", size = 40.dp, onClick = callbacks.openEq)
                Box {
                    NeonIconButton(Icons.Filled.Bedtime, "Sleep timer", size = 40.dp, active = sleepRemainingMs != null, onClick = { sleepMenu = true })
                    DropdownMenu(expanded = sleepMenu, onDismissRequest = { sleepMenu = false }) {
                        listOf(15, 30, 45, 60, 90).forEach { m -> DropdownMenuItem(text = { Text("$m min") }, onClick = { callbacks.sleep(m); sleepMenu = false }) }
                        DropdownMenuItem(text = { Text("End of track") }, onClick = { callbacks.sleepEndOfTrack(); sleepMenu = false })
                        if (sleepRemainingMs != null) DropdownMenuItem(text = { Text("Cancel (${formatTime(sleepRemainingMs)} left)") }, onClick = { callbacks.sleep(null); sleepMenu = false })
                    }
                }
                Box {
                    NeonIconButton(
                        Icons.Filled.Tune, "DJ auto-mix — tap to toggle, hold for mixer options", size = 40.dp, active = state.autoMix,
                        onLongClick = { autoMixMenu = true }, onClick = callbacks.toggleAutoMix,
                    )
                    DropdownMenu(expanded = autoMixMenu, onDismissRequest = { autoMixMenu = false }) {
                        DropdownMenuItem(
                            text = { Text("Personal DJ mixer", style = MaterialTheme.typography.labelSmall, color = p.muted) },
                            enabled = false, onClick = {},
                        )
                        DropdownMenuItem(
                            text = { Text(if (state.autoMix) "Turn off DJ auto-mix" else "Turn on DJ auto-mix") },
                            onClick = { callbacks.toggleAutoMix(); autoMixMenu = false },
                        )
                        DropdownMenuItem(
                            text = { Text((if (!state.autoMixEnergyRise) "✓ " else "") + "Keep energy steady") },
                            onClick = { callbacks.setAutoMixEnergyRise(false); autoMixMenu = false },
                        )
                        DropdownMenuItem(
                            text = { Text((if (state.autoMixEnergyRise) "✓ " else "") + "Build energy ↑") },
                            onClick = { callbacks.setAutoMixEnergyRise(true); autoMixMenu = false },
                        )
                        state.autoMixExplanation?.takeIf { state.autoMix }?.let { why ->
                            DropdownMenuItem(text = { Text("Mixing: $why", style = MaterialTheme.typography.labelSmall, color = p.accent) }, enabled = false, onClick = {})
                        }
                    }
                }
                NeonIconButton(Icons.Filled.AutoAwesome, "Nocternal Bot — change any setting or give a command", size = 40.dp, onClick = callbacks.openAssistant)
            }
            Spacer(Modifier.height(8.dp))
            NeonLightBar(lighting, spectrum, Modifier.clip(RoundedCornerShape(16.dp)), height = 48.dp, playing = state.isPlaying)
            Spacer(Modifier.height(12.dp))
        }
    }
}
