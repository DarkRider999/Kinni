package com.nocternal.playz.app.ui

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.app.MainActivity
import com.nocternal.playz.app.bubble.FloatingBubbleService
import com.nocternal.playz.backup.LibraryState
import com.nocternal.playz.backup.RestoreStrategy
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.NeonLogo
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.designsystem.toColor
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.ThemeMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val ACCENTS = listOf("#00F0FF", "#FF00E5", "#8F00FF", "#00A3FF", "#00F5A0", "#B6FF00", "#FFC940", "#FF1744", "#FF2E88").map(NeonColor::hex)

/** Settings (spec §10): theme mode, accent, crossfade, sleep timer, private mode, backup & restore, AI, plugins. */
@Composable
fun SettingsScreen(c: AppContainer) {
    val p = Neon.palette
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val s by c.settingsRepo.settings.collectAsStateWithLifecycle()
    val auddToken by c.settingsRepo.recognitionToken.collectAsStateWithLifecycle()
    val sleepLeft by c.audio.sleepTimer.remainingMs.collectAsStateWithLifecycle()
    val fx by c.audio.fxSettings.collectAsStateWithLifecycle()
    var apiKey by remember(s.assistantApiKey) { mutableStateOf(s.assistantApiKey.orEmpty()) }
    var jamendoId by remember(s.jamendoClientId) { mutableStateOf(s.jamendoClientId.orEmpty()) }
    var token by remember(auddToken) { mutableStateOf(auddToken.orEmpty()) }
    var restoreStrategy by remember { mutableStateOf(RestoreStrategy.MERGE) }
    fun toast(msg: String) = Toast.makeText(context, msg, Toast.LENGTH_LONG).show()

    fun libraryState(): LibraryState {
        val d = c.library.data.value
        return LibraryState(s, d.playlists, d.favorites, d.history, emptyList(), d.lyricsOffsetsMs)
    }

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val text = c.backup.export(libraryState(), c.library.data.value.tracks)
            runCatching { withContext(Dispatchers.IO) { context.contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) } } }
                .onSuccess { toast("Backup saved") }.onFailure { toast("Backup failed: ${it.message}") }
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            runCatching {
                val text = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)!!.bufferedReader().readText() }
                c.backup.restore(text, libraryState(), c.library.data.value.tracks, restoreStrategy)
            }.onSuccess { r ->
                c.settingsRepo.update { r.state.settings }
                c.library.replaceUserData(r.state.favorites, r.state.history, r.state.playlists, r.state.lyricsOffsetsMs)
                toast("Restored ${r.restoredPlaylists} playlists" + if (r.unmatchedTrackKeys.isNotEmpty()) " · ${r.unmatchedTrackKeys.size} songs not on this device" else "")
            }.onFailure { toast(it.message ?: "Restore failed") }
        }
    }

    LazyColumn(Modifier.fillMaxSize().statusBarsPadding(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Settings", style = MaterialTheme.typography.headlineSmall, color = p.onBackground) }

        item { SectionTitle("Theme") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ThemeMode.entries) { m -> NeonChip(m.name.lowercase().replaceFirstChar { it.uppercase() }.replace("Amoled", "AMOLED Black"), selected = s.themeMode == m) { c.settingsRepo.update { it.copy(themeMode = m) } } }
                }
                Text("Accent color", color = p.muted, style = MaterialTheme.typography.labelSmall)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { NeonChip("Auto (genre)", selected = s.customAccent == null) { c.settingsRepo.update { it.copy(customAccent = null) } } }
                    items(ACCENTS) { col ->
                        Box(Modifier.size(34.dp).clip(CircleShape).background(col.toColor()).border(if (s.customAccent == col) 3.dp else 0.dp, Color.White, CircleShape)
                            .clickable { c.settingsRepo.update { it.copy(customAccent = col) } })
                    }
                }
                ToggleRow("Auto theme by genre", s.autoThemeByGenre) { on -> c.settingsRepo.update { it.copy(autoThemeByGenre = on) } }
                ToggleRow("Auto theme by AI mood", s.autoThemeByMood) { on -> c.settingsRepo.update { it.copy(autoThemeByMood = on) } }
                ToggleRow("Auto theme by time of day", s.autoThemeByTime) { on -> c.settingsRepo.update { it.copy(autoThemeByTime = on) } }
                ToggleRow("Theme also sets the EQ", s.eqFollowsTheme) { on -> c.settingsRepo.update { it.copy(eqFollowsTheme = on) } }
            }
        }

        item { SectionTitle("Playback") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                ToggleRow("Crossfade (next song overlaps, no gaps)", s.autoFaderEnabled) { on -> c.settingsRepo.update { it.copy(autoFaderEnabled = on) } }
                LabeledSlider("Crossfade overlap", s.crossfadeSeconds, 0f..12f, { if (it < 0.5f) "gapless" else "%.0f s".format(it) }) { v -> c.settingsRepo.update { it.copy(crossfadeSeconds = Math.round(v).toFloat()) } }
                Text("Recommended: 4–6 s for playlists and mixes · 0 s (gapless) for live albums and DJ sets", color = p.muted, style = MaterialTheme.typography.labelSmall)
                ToggleRow("Smart audio normalization", s.normalization) { on -> c.settingsRepo.update { it.copy(normalization = on) } }
                ToggleRow("Speaker boost", fx.speakerBoost) { on -> c.audio.setSpeakerBoost(on) }
                ToggleRow("Hearing & speaker safe mode", s.speakerSafeMode) { on -> c.settingsRepo.update { it.copy(speakerSafeMode = on) } }
                Text(if (sleepLeft != null) "Sleep timer: ${sleepLeft!! / 60000 + 1} min left" else "Sleep timer", color = p.muted, style = MaterialTheme.typography.labelSmall)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(listOf(15, 30, 60, 90)) { m -> NeonChip("$m min") { c.audio.sleepTimer.start(m) } }
                    item { NeonChip("Off") { c.audio.sleepTimer.cancel() } }
                }
            }
        }

        item { SectionTitle("Floating mini-player") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                Text("A draggable neon bubble that controls playback over other apps.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NeonChip("Show bubble") {
                        if (Settings.canDrawOverlays(context)) FloatingBubbleService.start(context)
                        else context.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")))
                    }
                    NeonChip("Hide") { FloatingBubbleService.stop(context) }
                }
            }
        }

        item { SectionTitle("Privacy & offline") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                ToggleRow("Private mode (no history, no scrobbles)", s.privateMode) { on -> c.settingsRepo.update { it.copy(privateMode = on) } }
                ToggleRow("Smart offline mode", s.smartOfflineMode) { on -> c.settingsRepo.update { it.copy(smartOfflineMode = on) } }
                Text("Connections for lyrics, radio, YouTube Music and AI", color = p.muted, style = MaterialTheme.typography.labelSmall)
                ToggleRow("Use Wi-Fi", s.useWifi) { on -> c.settingsRepo.update { it.copy(useWifi = on) } }
                ToggleRow("Use mobile data", s.useMobileData) { on -> c.settingsRepo.update { it.copy(useMobileData = on) } }
                ToggleRow("Auto-download lyrics", s.autoDownloadLyrics) { on -> c.settingsRepo.update { it.copy(autoDownloadLyrics = on) } }
                ToggleRow("Background downloads on Wi-Fi only", s.autoDownloadOnWifiOnly) { on -> c.settingsRepo.update { it.copy(autoDownloadOnWifiOnly = on) } }
                NeonChip("Clear playback history") { c.library.clearHistory(); toast("History cleared") }
            }
        }

        item { SectionTitle("AI") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                Text("Commands work offline. Add your own Claude API key to ask the assistant anything; it stays on this device and is never backed up.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                OutlinedTextField(apiKey, { apiKey = it }, Modifier.fillMaxWidth(), label = { Text("Claude API key") }, singleLine = true, visualTransformation = PasswordVisualTransformation(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent), shape = RoundedCornerShape(14.dp))
                OutlinedTextField(token, { token = it }, Modifier.fillMaxWidth(), label = { Text("Music recognition token (audd.io)") }, singleLine = true, visualTransformation = PasswordVisualTransformation(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent), shape = RoundedCornerShape(14.dp))
                NeonChip("Save keys") {
                    c.settingsRepo.update { it.copy(assistantApiKey = apiKey.trim().ifBlank { null }) }
                    c.settingsRepo.setRecognitionToken(token)
                    toast("Saved")
                }
            }
        }

        item { SectionTitle("Free music") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                Text("Internet Archive and podcasts work without setup. For Jamendo's Creative Commons catalogue, paste a free client ID from devportal.jamendo.com.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                OutlinedTextField(jamendoId, { jamendoId = it }, Modifier.fillMaxWidth(), label = { Text("Jamendo client ID") }, singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent), shape = RoundedCornerShape(14.dp))
                NeonChip("Save client ID") { c.settingsRepo.update { it.copy(jamendoClientId = jamendoId.trim().ifBlank { null }) }; toast("Saved") }
            }
        }

        item { SectionTitle("Plugins") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                c.plugins.plugins.forEach { pl ->
                    ToggleRow("${pl.name} — ${pl.description}", pl.id in s.enabledPlugins) { on ->
                        c.settingsRepo.update { it.copy(enabledPlugins = if (on) it.enabledPlugins + pl.id else it.enabledPlugins - pl.id) }
                    }
                }
            }
        }

        item { SectionTitle("Backup & restore") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                Text("Settings, playlists, favorites and history. Songs are matched by artist, title and length, so backups move between phones.", color = p.muted, style = MaterialTheme.typography.labelSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NeonChip("Merge", selected = restoreStrategy == RestoreStrategy.MERGE) { restoreStrategy = RestoreStrategy.MERGE }
                    NeonChip("Replace", selected = restoreStrategy == RestoreStrategy.REPLACE) { restoreStrategy = RestoreStrategy.REPLACE }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NeonButton("Back up") { exportLauncher.launch("nocternal-backup.json") }
                    NeonButton("Restore") { importLauncher.launch(arrayOf("application/json", "text/plain", "*/*")) }
                }
            }
        }

        item { SectionTitle("Library") }
        item { NeonChip("Rescan music") { c.library.rescan((context as? MainActivity)?.hasAudioPermission() ?: true) } }
        item { NeonLogo(Modifier.fillMaxWidth()) }
        item { Text("Version 1.0.0", color = p.muted, style = MaterialTheme.typography.labelSmall) }
    }
}
