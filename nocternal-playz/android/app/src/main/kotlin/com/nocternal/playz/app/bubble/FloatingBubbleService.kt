package com.nocternal.playz.app.bubble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.nocternal.playz.R
import com.nocternal.playz.app.MainActivity
import com.nocternal.playz.app.NocternalApplication
import com.nocternal.playz.designsystem.NocternalTheme
import com.nocternal.playz.designsystem.neonGlow
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.ui.player.AlbumArt
import kotlin.math.roundToInt

/**
 * Floating mini-player bubble (spec §2B/§11.5): a draggable neon bubble drawn over other apps. Tap to expand
 * controls, double-tap to open the app. Requires "Display over other apps".
 */
class FloatingBubbleService : LifecycleService(), SavedStateRegistryOwner {
    private val savedState = SavedStateRegistryController.create(this)
    override val savedStateRegistry: SavedStateRegistry get() = savedState.savedStateRegistry
    private var view: ComposeView? = null

    override fun onCreate() {
        savedState.performAttach()
        savedState.performRestore(null)
        super.onCreate()
        startForegroundCompat()
        addBubble()
    }

    private fun startForegroundCompat() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.bubble_channel), NotificationManager.IMPORTANCE_MIN))
        val n: Notification = NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_bubble_note).setContentTitle("Floating player is on").setOngoing(true).build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(ID, n)
    }

    private fun addBubble() {
        val wm = getSystemService(WindowManager::class.java)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.TOP or Gravity.START; x = 24; y = 400 }
        val container = (application as NocternalApplication).container

        val compose = ComposeView(this).apply {
            setViewTreeLifecycleOwner(this@FloatingBubbleService)
            setViewTreeSavedStateRegistryOwner(this@FloatingBubbleService)
            setContent {
                val theme by container.themeStore.state.collectAsStateWithLifecycle()
                val s by container.audio.state.collectAsStateWithLifecycle()
                val spectrum by container.audio.spectrum.collectAsStateWithLifecycle()
                var expanded by remember { mutableStateOf(false) }
                NocternalTheme(theme) {
                    val p = Neon.palette
                    Row(
                        Modifier
                            .pointerInput(Unit) {
                                detectDragGestures { change, drag ->
                                    change.consume()
                                    params.x += drag.x.roundToInt(); params.y += drag.y.roundToInt()
                                    wm.updateViewLayout(this@apply, params)
                                }
                            }
                            .neonGlow(p.accent, p.glow * (0.5f + 0.5f * spectrum.bass), corner = 32.dp)
                            .clip(RoundedCornerShape(32.dp)).background(p.surface).padding(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(56.dp).clip(CircleShape).pointerInput(Unit) {
                                detectTapGestures(
                                    onTap = { expanded = !expanded },
                                    onDoubleTap = { startActivity(Intent(this@FloatingBubbleService, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) },
                                )
                            },
                        ) {
                            val t = s.track
                            if (t != null) AlbumArt(t.artworkUri, remember(t.id) { container.artGenerator.generate(t) }, Modifier.size(56.dp))
                            else Box(Modifier.size(56.dp).background(p.accent.copy(alpha = 0.3f)))
                        }
                        if (expanded) {
                            IconButton(onClick = container.audio::togglePlay) { Icon(if (s.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, "Play/pause", tint = p.accent) }
                            IconButton(onClick = container.audio::next) { Icon(Icons.Filled.SkipNext, "Next", tint = Color.White) }
                            IconButton(onClick = { stopSelf() }) { Icon(Icons.Filled.Close, "Close", tint = p.muted) }
                        }
                    }
                }
            }
        }
        wm.addView(compose, params)
        view = compose
    }

    override fun onDestroy() {
        view?.let { getSystemService(WindowManager::class.java).removeView(it) }
        view = null
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL = "bubble"
        private const val ID = 42
        fun start(context: Context) = context.startForegroundService(Intent(context, FloatingBubbleService::class.java))
        fun stop(context: Context) = context.stopService(Intent(context, FloatingBubbleService::class.java))
    }
}
