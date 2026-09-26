package com.subzero.messenger

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModelProvider
import com.subzero.messenger.call.CallManager
import com.subzero.messenger.call.CallType
import com.subzero.messenger.call.LoopbackRtcEngine
import com.subzero.messenger.crypto.CryptoEngine
import com.subzero.messenger.data.ChatRepository
import com.subzero.messenger.data.RamMessageBuffer
import com.subzero.messenger.data.RelaySettings
import com.subzero.messenger.data.VaultStore
import com.subzero.messenger.data.WebSocketTransport
import com.subzero.messenger.ui.settings.SetupScreen
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
    private val lockedState = mutableStateOf(true)
    private val appScreenState = mutableStateOf(AppScreen.CHAT)

    private lateinit var safeZone: SafeZoneController
    private lateinit var vault: VaultStore
    private lateinit var callManager: CallManager
    private lateinit var relaySettings: RelaySettings

    private enum class AppScreen { CHAT, VAULT, CALL, SETUP }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScreenSecurity.protect(this)

        identity = IdentityManager(this)
        appLock = AppLock(this)
        // Use the relay when configured on the setup screen, else stay offline
        // (messages shown locally only). The relay client is both the transport
        // and the prekey directory.
        relaySettings = RelaySettings(this)
        if (relaySettings.enabled) {
            val ws = WebSocketTransport(relaySettings.url, relaySettings.selfAddress, relaySettings.peerAddress)
            repository = ChatRepository(crypto, buffer, ws, ws, conversationId, relayEnabled = true)
        } else {
            repository = ChatRepository(crypto, buffer, NoopTransport, NoopDirectory, conversationId, relayEnabled = false)
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
                when {
                    locked -> LockGate(onUnlock = { lockedState.value = false })
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
                    appScreen == AppScreen.SETUP -> SetupScreen(
                        settings = relaySettings,
                        onSaved = { recreate() },   // rebuild with the new connection settings
                        onBack = { appScreenState.value = AppScreen.CHAT },
                    )
                    else -> ChatScreen(
                        viewModel = chatViewModel,
                        onSafeZone = { safeZone.activate(conversationId) },
                        onVoiceCall = { callManager.placeCall("Contact", CallType.AUDIO); appScreenState.value = AppScreen.CALL },
                        onVideoCall = { callManager.placeCall("Contact", CallType.VIDEO); appScreenState.value = AppScreen.CALL },
                        onOpenVault = { appScreenState.value = AppScreen.VAULT },
                        onOpenSettings = { appScreenState.value = AppScreen.SETUP },
                    )
                }
            }
        }
    }

    @Composable
    private fun LockGate(onUnlock: () -> Unit) {
        LaunchedEffect(Unit) {
            if (appLock.canAuthenticate()) {
                appLock.authenticate(onSuccess = onUnlock, onFailure = { /* stay locked */ })
            } else {
                onUnlock() // no biometrics enrolled; fall through (documented limitation)
            }
        }
    }

    @Composable
    private fun SafeZoneHost(screen: SafeZoneScreen, onReturn: () -> Unit) {
        if (screen.isGame) GameRegistry.render(screen)
        else when (screen) {
            SafeZoneScreen.NOTES -> NotesScreen()
            SafeZoneScreen.WEATHER -> WeatherScreen()
            else -> CalculatorScreen()
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
        // App backgrounded: re-lock. (Secure-logout wipe is a separate user action.)
        lockedState.value = true
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
