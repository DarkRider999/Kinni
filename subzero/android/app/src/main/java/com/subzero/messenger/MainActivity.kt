package com.subzero.messenger

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModelProvider
import com.subzero.messenger.crypto.CryptoEngine
import com.subzero.messenger.data.ChatRepository
import com.subzero.messenger.data.RamMessageBuffer
import com.subzero.messenger.identity.AppIdentity
import com.subzero.messenger.identity.IdentityManager
import com.subzero.messenger.security.AppLock
import com.subzero.messenger.security.ScreenSecurity
import com.subzero.messenger.ui.chat.ChatScreen
import com.subzero.messenger.ui.chat.ChatViewModel
import com.subzero.messenger.ui.decoy.CalculatorScreen
import com.subzero.messenger.ui.decoy.NotesScreen
import com.subzero.messenger.ui.decoy.WeatherScreen
import com.subzero.messenger.ui.safezone.*
import com.subzero.messenger.ui.safezone.games.GameRegistry
import com.subzero.messenger.ui.theme.SubZeroTheme

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

    private lateinit var safeZone: SafeZoneController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScreenSecurity.protect(this)

        identity = IdentityManager(this)
        appLock = AppLock(this)
        repository = ChatRepository(crypto, buffer, NoopTransport)

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
                when {
                    locked -> LockGate(onUnlock = { lockedState.value = false })
                    safeScreen != null -> SafeZoneHost(
                        screen = safeScreen!!,
                        onReturn = { safeZone.exit() },
                    )
                    else -> ChatScreen(
                        viewModel = chatViewModel,
                        onSafeZone = { safeZone.activate(conversationId) },
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

    /** Stub transport so the UI + crypto run without a backend. */
    private object NoopTransport : ChatRepository.Transport {
        override fun send(conversationId: String, header: ByteArray, ciphertext: ByteArray) {}
        override fun onReceive(handler: (String, ByteArray, ByteArray) -> Unit) {}
    }
}
