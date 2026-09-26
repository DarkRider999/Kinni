package com.nocternal.playz.app.ui

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nocternal.playz.app.ActionExecutor
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonBackground
import com.nocternal.playz.designsystem.NocternalTheme
import com.nocternal.playz.designsystem.VoiceOrb
import com.nocternal.playz.designsystem.neonGlow
import com.nocternal.playz.lighting.EdgeLightingOverlay
import com.nocternal.playz.theme.EqPresets
import com.nocternal.playz.ui.player.AlbumArt
import com.nocternal.playz.ui.player.EqFxScreen
import com.nocternal.playz.ui.player.PlayerCallbacks
import com.nocternal.playz.ui.player.PlayerScreen

private enum class Tab(val route: String, val label: String, val icon: ImageVector) {
    HOME("home", "Home", Icons.Filled.Home),
    PLAYER("player", "Player", Icons.Filled.PlayCircle),
    LIGHTING("lighting", "Lighting", Icons.Filled.Lightbulb),
    SETTINGS("settings", "Settings", Icons.Filled.Settings),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NocternalRoot(c: AppContainer, actions: ActionExecutor) {
    val theme by c.themeStore.state.collectAsStateWithLifecycle()
    val settings by c.settingsRepo.settings.collectAsStateWithLifecycle()
    val playback by c.audio.state.collectAsStateWithLifecycle()
    val spectrum by c.audio.spectrum.collectAsStateWithLifecycle()
    val lighting by c.lighting.state.collectAsStateWithLifecycle()
    val library by c.library.data.collectAsStateWithLifecycle()
    val lyrics by c.lyrics.collectAsStateWithLifecycle()
    val lyricsLoading by c.lyricsLoading.collectAsStateWithLifecycle()
    val sleepLeft by c.audio.sleepTimer.remainingMs.collectAsStateWithLifecycle()
    val fx by c.audio.fxSettings.collectAsStateWithLifecycle()
    val nav = rememberNavController()
    var assistantOpen by remember { mutableStateOf(false) }
    val context = LocalContext.current

    LaunchedEffect(Unit) { c.messages.collect { Toast.makeText(context, it, Toast.LENGTH_SHORT).show() } }

    NocternalTheme(theme, settings.themeMode) {
        NeonBackground {
            val backStack by nav.currentBackStackEntryAsState()
            val route = backStack?.destination?.route ?: Tab.HOME.route
            Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f)) {
                    NavHost(nav, startDestination = Tab.HOME.route) {
                        composable(Tab.HOME.route) { HomeScreen(c, actions, onOpenPlayer = { nav.navigate(Tab.PLAYER.route) }, onOpenFree = { nav.navigate("free") }) }
                        composable("free") { FreeMusicScreen(c, onOpenPlayer = { nav.navigate(Tab.PLAYER.route) }, onBack = { nav.popBackStack() }) }
                        composable(Tab.PLAYER.route) {
                            val track = playback.track
                            PlayerScreen(
                                state = playback, spectrum = spectrum, lighting = lighting, lyrics = lyrics, lyricsLoading = lyricsLoading,
                                isFavorite = track?.id in library.favorites,
                                artSpec = remember(track?.id) { track?.let(c.artGenerator::generate) },
                                sleepRemainingMs = sleepLeft,
                                callbacks = PlayerCallbacks(
                                    togglePlay = c.audio::togglePlay, next = c.audio::next, previous = c.audio::previous,
                                    seek = c.audio::seekTo, shuffle = { c.audio.setShuffle(!playback.shuffle) }, repeat = c.audio::cycleRepeat,
                                    like = { track?.let { c.library.toggleFavorite(it.id) } }, openEq = { nav.navigate("eq") },
                                    sleep = { m -> if (m == null) c.audio.sleepTimer.cancel() else c.audio.sleepTimer.start(m) },
                                    sleepEndOfTrack = { c.audio.sleepTimer.stopAtEndOfTrack(true) },
                                    toggleAutoMix = { c.audio.setAutoMix(!playback.autoMix) }, openAssistant = { assistantOpen = true },
                                    collapse = { nav.popBackStack() },
                                ),
                            )
                        }
                        composable("eq") {
                            EqFxScreen(
                                fx = fx, presets = EqPresets.all, onChange = c.audio::updateFx, onPreset = c.audio::applyPreset,
                                onAiOptimize = { actions.run(c.assistant.value.execute(com.nocternal.playz.ai.AssistantIntent.OptimizeEq, actions.context()).actions) },
                                onEnhance = c.audio::enhance, onBack = { nav.popBackStack() },
                            )
                        }
                        composable(Tab.LIGHTING.route) { LightingScreen(c, spectrum, playback.isPlaying) }
                        composable(Tab.SETTINGS.route) { SettingsScreen(c) }
                    }
                    // AI voice orb, always one tap away.
                    if (route != Tab.PLAYER.route && route != "eq") {
                        VoiceOrb(false, 0f, Modifier.align(Alignment.BottomEnd).padding(16.dp), size = 64.dp) { assistantOpen = true }
                    }
                }
                AnimatedVisibility(playback.track != null && route != Tab.PLAYER.route, enter = slideInVertically { it }, exit = slideOutVertically { it }) {
                    MiniPlayerDock(c, onOpen = { nav.navigate(Tab.PLAYER.route) })
                }
                BottomNav(route) { tab -> nav.navigateTab(tab.route) }
            }
            EdgeLightingOverlay(lighting, spectrum)
        }
        if (assistantOpen) {
            ModalBottomSheet(onDismissRequest = { assistantOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Neon.palette.background) {
                AssistantPanel(c, actions)
            }
        }
    }
}

private fun NavHostController.navigateTab(route: String) = navigate(route) {
    popUpTo(graph.startDestinationId) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@Composable
private fun BottomNav(route: String, onSelect: (Tab) -> Unit) {
    val p = Neon.palette
    NavigationBar(containerColor = p.background.copy(alpha = 0.92f), tonalElevation = 0.dp) {
        Tab.entries.forEach { tab ->
            NavigationBarItem(
                selected = route == tab.route, onClick = { onSelect(tab) },
                icon = { Icon(tab.icon, tab.label) }, label = { Text(tab.label) },
                colors = NavigationBarItemDefaults.colors(selectedIconColor = p.accent, selectedTextColor = p.accent, indicatorColor = p.accent.copy(alpha = 0.15f), unselectedIconColor = p.muted, unselectedTextColor = p.muted),
            )
        }
    }
}

/** Mini-player dock above the bottom nav (spec §3). */
@Composable
private fun MiniPlayerDock(c: AppContainer, onOpen: () -> Unit) {
    val p = Neon.palette
    val s by c.audio.state.collectAsStateWithLifecycle()
    val spectrum by c.audio.spectrum.collectAsStateWithLifecycle()
    val t = s.track ?: return
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)
            .neonGlow(p.accent, p.glow * (0.4f + 0.6f * spectrum.bass), corner = 18.dp)
            .clip(RoundedCornerShape(18.dp)).background(p.surface).clickable(onClick = onOpen).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AlbumArt(t.artworkUri, remember(t.id) { c.artGenerator.generate(t) }, Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(t.title, color = p.onBackground, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(t.artist, color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            if (s.durationMs > 0) Box(Modifier.fillMaxWidth().height(2.dp).background(p.muted.copy(alpha = 0.2f))) {
                Box(Modifier.fillMaxWidth(s.positionMs.toFloat() / s.durationMs).height(2.dp).background(p.accent))
            }
        }
        IconButton(onClick = c.audio::togglePlay) { Icon(if (s.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, "Play/pause", tint = p.accent) }
        IconButton(onClick = c.audio::next) { Icon(Icons.Filled.SkipNext, "Next", tint = p.onBackground) }
    }
}

