package com.subzero.messenger

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModelProvider
import kotlinx.coroutines.delay
import com.subzero.messenger.call.CallManager
import com.subzero.messenger.call.CallType
import com.subzero.messenger.call.LoopbackRtcEngine
import com.subzero.messenger.crypto.CryptoEngine
import com.subzero.messenger.data.AppPreferences
import com.subzero.messenger.data.ChatRepository
import com.subzero.messenger.data.RamMessageBuffer
import com.subzero.messenger.data.RelaySettings
import com.subzero.messenger.data.VaultStore
import com.subzero.messenger.data.WebSocketTransport
import com.subzero.messenger.ui.settings.SettingsScreen
import com.subzero.messenger.identity.AppIdentity
import com.subzero.messenger.identity.IdentityManager
import com.subzero.messenger.security.AppLock
import com.subzero.messenger.security.ScreenSecurity
import com.subzero.messenger.ui.call.CallScreen
import com.subzero.messenger.ui.chat.ChatScreen
import com.subzero.messenger.ui.chat.ChatViewModel
import com.subzero.messenger.ui.decoy.CalculatorScreen
import com.subzero.messenger.ui.decoy.NotesScreen
import com.subzero.messenger.ui.decoy.WeatherScreen
import com.subzero.messenger.ui.safezone.*
import com.subzero.messenger.ui.safezone.games.GameRegistry
import com.subzero.messenger.ui.theme.SubZeroTheme
import com.subzero.messenger.ui.vault.VaultScreen

/**
 * Single-activity host. Owns the app-wide privacy state machine:
 *   LOCKED -> (biometric) -> CHAT <-> SAFEZONE.
 *
 * FLAG_SECURE is applied for the whole lifetime so screenshots and the recents
 * thumbnail are blocked. Volume-down-twice is captured here as one of the
 * SafeZone return gestures.
 */
class MainActivity : FragmentActivity() {

    private val buffer = RamMessageBuffer()
    private val crypto = CryptoEngine()
    private lateinit var repository: ChatRepository
    private lateinit var identity: IdentityManager
    private lateinit var appLock: AppLock

    private val conversationId = "demo-conversation"
    private var volumeDownCount = 0
    private var lastVolumeDown = 0L

    private val safeZoneScreenState = mutableStateOf<SafeZoneScreen?>(null)
    private val lockedState = mutableStateOf(false)
    private val appScreenState = mutableStateOf(AppScreen.CHAT)
    private val crashState = mutableStateOf<String?>(null)

    private lateinit var safeZone: SafeZoneController
    private lateinit var vault: VaultStore
    private lateinit var callManager: CallManager
    private lateinit var relaySettings: RelaySettings
    private lateinit var appPrefs: AppPreferences

    private enum class AppScreen { CHAT, VAULT, CALL, SETTINGS }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScreenSecurity.protect(this)

        // If the app crashed last time, surface the reason (then clear it).
        val crashFile = java.io.File(filesDir, SubZeroApp.CRASH_FILE)
        if (crashFile.exists()) {
            crashState.value = runCatching { crashFile.readText() }.getOrNull()
            crashFile.delete()
        }

        identity = IdentityManager(this)
        appLock = AppLock(this)
        // Use the relay when configured on the setup screen, else stay offline
        // (messages shown locally only). The relay client is both the transport
        // and the prekey directory.
        relaySettings = RelaySettings(this)
        appPrefs = AppPreferences(this)
        lockedState.value = appPrefs.appLockEnabled   // only lock if the user turned it on
        val ttl = appPrefs.disappearingSeconds.takeIf { it > 0 }?.let { it * 1000L }
        repository = runCatching {
            if (relaySettings.enabled) {
                val ws = WebSocketTransport(relaySettings.url, relaySettings.selfAddress, relaySettings.peerAddress)
                ChatRepository(crypto, buffer, ws, ws, conversationId, relayEnabled = true, disappearingTtlMillis = ttl)
            } else {
                ChatRepository(crypto, buffer, NoopTransport, NoopDirectory, conversationId, relayEnabled = false, disappearingTtlMillis = ttl)
            }
        }.getOrElse {
            // Never brick on launch: fall back to a local-only repository.
            ChatRepository(crypto, buffer, NoopTransport, NoopDirectory, conversationId, relayEnabled = false, disappearingTtlMillis = ttl)
        }
        vault = VaultStore(this)
        // Media engine + signaling. The demo engine + no-op signaling let the full
        // call UI run today; swap for WebRtcEngine + an encrypted signaling
        // transport (E2E via CryptoEngine) to place live calls between phones.
        callManager = CallManager(engine = LoopbackRtcEngine(), sendSignaling = { /* TODO(subzero): encrypt + send */ })

        safeZone = SafeZoneController(
            buffer = buffer,
            picker = SafeZonePicker(SafeZoneScreen.entries.toSet()),
            onScreen = { safeZoneScreenState.value = it },
            onAutoLock = {
                lockedState.value = true
                identity.rotateRandom() // spec: identity rotates after SafeZone auto-lock
            },
        )

        val chatViewModel = ChatViewModel(repository, buffer, conversationId)

        setContent {
            SubZeroTheme {
                val locked by lockedState
                val safeScreen by safeZoneScreenState
                val appScreen by appScreenState
                val crash by crashState
                when {
                    crash != null -> CrashScreen(crash!!) { crashState.value = null }
                    locked -> LockScreen(onUnlock = { lockedState.value = false })
                    safeScreen != null -> SafeZoneHost(
                        screen = safeScreen!!,
                        onReturn = { safeZone.exit() },
                    )
                    appScreen == AppScreen.VAULT -> VaultScreen(
                        vault = vault,
                        onBack = { appScreenState.value = AppScreen.CHAT },
                    )
                    appScreen == AppScreen.CALL -> CallScreen(
                        manager = callManager,
                        onFinished = { callManager.reset(); appScreenState.value = AppScreen.CHAT },
                    )
                    appScreen == AppScreen.SETTINGS -> SettingsScreen(
                        relay = relaySettings,
                        prefs = appPrefs,
                        identity = identity,
                        onApplyRestart = { recreate() },
                        onOpenVault = { appScreenState.value = AppScreen.VAULT },
                        onSecureLogout = { repository.logout(); appScreenState.value = AppScreen.CHAT },
                        onBack = { appScreenState.value = AppScreen.CHAT },
                    )
                    else -> ChatScreen(
                        viewModel = chatViewModel,
                        onSafeZone = { safeZone.activate(conversationId) },
                        onVoiceCall = { callManager.placeCall("Contact", CallType.AUDIO); appScreenState.value = AppScreen.CALL },
                        onVideoCall = { callManager.placeCall("Contact", CallType.VIDEO); appScreenState.value = AppScreen.CALL },
                        onOpenVault = { appScreenState.value = AppScreen.VAULT },
                        onOpenSettings = { appScreenState.value = AppScreen.SETTINGS },
                    )
                }
            }
        }
    }

    /**
     * A real lock screen (never blank). Auto-attempts biometric once; if that
     * fails or is cancelled, the Unlock button lets the user retry. If no
     * biometrics are enrolled, Unlock just opens the app.
     */
    @Composable
    private fun LockScreen(onUnlock: () -> Unit) {
        fun tryUnlock() {
            if (appLock.canAuthenticate()) {
                appLock.authenticate(onSuccess = onUnlock, onFailure = { /* stay; user can retry */ })
            } else {
                onUnlock()
            }
        }
        LaunchedEffect(Unit) {
            delay(300) // let the activity finish resuming before prompting
            tryUnlock()
        }
        Column(
            modifier = Modifier.fillMaxSize().background(Color(0xFF0B0F14)),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("SubZero", color = Color(0xFF35E0C4), fontSize = 30.sp)
            Spacer(Modifier.height(8.dp))
            Text("Locked", color = Color(0xFF9AA0A6), fontSize = 15.sp)
            Spacer(Modifier.height(24.dp))
            Button(onClick = { tryUnlock() }) { Text("Unlock") }
        }
    }

    /** Shows a captured crash so it can be screenshotted/shared, then dismissed. */
    @Composable
    private fun CrashScreen(text: String, onDismiss: () -> Unit) {
        val scroll = rememberScrollState()
        Column(
            modifier = Modifier.fillMaxSize().background(Color(0xFF0B0F14))
                .padding(16.dp).verticalScroll(scroll),
        ) {
            Text("Something went wrong", color = Color(0xFFE05A5A), fontSize = 20.sp)
            Spacer(Modifier.height(4.dp))
            Text("Screenshot this and send it to Roshan, then tap Dismiss.",
                color = Color(0xFF9AA0A6), fontSize = 13.sp)
            Spacer(Modifier.height(12.dp))
            Text(text, color = Color(0xFFCED2D6), fontSize = 11.sp)
            Spacer(Modifier.height(16.dp))
            Button(onClick = onDismiss) { Text("Dismiss") }
            Spacer(Modifier.height(40.dp))
        }
    }

    @Composable
    private fun SafeZoneHost(screen: SafeZoneScreen, onReturn: () -> Unit) {
        Box(Modifier.fillMaxSize()) {
            if (screen.isGame) GameRegistry.render(screen)
            else when (screen) {
                SafeZoneScreen.NOTES -> NotesScreen()
                SafeZoneScreen.WEATHER -> WeatherScreen()
                else -> CalculatorScreen()
            }
            // Subtle back-to-chat control (top-left). Also: double-tap top-right,
            // or press Volume-Down twice.
            Box(
                Modifier.align(Alignment.TopStart).padding(10.dp).size(40.dp)
                    .clip(CircleShape).background(Color(0x55000000))
                    .clickable { onReturn() },
                contentAlignment = Alignment.Center,
            ) { Text("‹", color = Color(0xCCFFFFFF), fontSize = 22.sp) }
        }
    }

    // Volume-down-twice within 800ms is a SafeZone return gesture.
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN && safeZone.active) {
            val now = System.currentTimeMillis()
            volumeDownCount = if (now - lastVolumeDown < 800) volumeDownCount + 1 else 1
            lastVolumeDown = now
            if (volumeDownCount >= 2) { volumeDownCount = 0; safeZone.exit(); return true }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onStop() {
        super.onStop()
        // Re-lock on background only if the user enabled app lock (default off).
        if (appPrefs.appLockEnabled) lockedState.value = true
    }

    /** Stubs so the UI runs fully offline (messages shown locally only). */
    private object NoopTransport : ChatRepository.Transport {
        override fun send(envelope: String) {}
        override fun onReceive(handler: (String) -> Unit) {}
    }
    private object NoopDirectory : ChatRepository.Directory {
        override fun publish(bundleWire: String) {}
        override fun requestPeerBundle() {}
        override fun onPeerBundle(handler: (String) -> Unit) {}
    }
}
