package com.subzero.messenger.ui.call

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.subzero.messenger.call.CallManager
import com.subzero.messenger.call.CallPhase
import com.subzero.messenger.call.CallType
import kotlinx.coroutines.delay

/**
 * Full-screen call UI driven by [CallManager] state. Shows the remote video/
 * avatar area, a local self-view when it's a video call, a status line, and the
 * in-call controls. When the media engine is the demo engine there is no live
 * video, so the areas render as themed placeholders.
 */
@Composable
fun CallScreen(manager: CallManager, onFinished: () -> Unit) {
    val s by manager.session.collectAsState()
    var elapsed by remember { mutableStateOf(0) }

    LaunchedEffect(s.phase) {
        if (s.phase == CallPhase.CONNECTED) {
            while (true) { delay(1000); elapsed++ }
        }
        if (s.phase == CallPhase.ENDED) { delay(700); onFinished() }
    }

    val statusText = when (s.phase) {
        CallPhase.DIALING -> "Calling…"
        CallPhase.RINGING -> "Incoming ${if (s.type == CallType.VIDEO) "video" else "voice"} call"
        CallPhase.CONNECTING -> "Connecting…"
        CallPhase.CONNECTED -> "%02d:%02d".format(elapsed / 60, elapsed % 60)
        CallPhase.ENDED -> "Call ended"
        CallPhase.IDLE -> ""
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF07090C))) {
        // Remote video / avatar area.
        Column(
            Modifier.fillMaxSize().padding(top = 72.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier.size(120.dp).clip(CircleShape).background(Color(0xFF16202B)),
                contentAlignment = Alignment.Center,
            ) {
                Text(s.peerName.take(1).uppercase().ifEmpty { "?" },
                    color = Color(0xFF35E0C4), fontSize = 52.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(20.dp))
            Text(s.peerName.ifEmpty { "SubZero contact" }, color = Color.White, fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(statusText, color = Color(0xFF9AA0A6), fontSize = 16.sp)
            if (s.type == CallType.VIDEO && s.phase == CallPhase.CONNECTED) {
                Text("🔒 End-to-end encrypted (DTLS-SRTP)", color = Color(0xFF35E0C4), fontSize = 12.sp,
                    modifier = Modifier.padding(top = 6.dp))
            }
        }

        // Local self-view PiP for video calls.
        if (s.type == CallType.VIDEO && s.videoEnabled && s.phase != CallPhase.ENDED) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(16.dp)
                    .size(96.dp, 140.dp).clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFF11181F))
                    .border(1.dp, Color(0xFF35E0C4), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) { Text("You", color = Color(0xFF667079), fontSize = 12.sp) }
        }

        // Controls.
        Column(
            Modifier.align(Alignment.BottomCenter).padding(bottom = 48.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (s.phase == CallPhase.RINGING && s.direction.name == "INCOMING") {
                Row(horizontalArrangement = Arrangement.spacedBy(60.dp)) {
                    RoundButton("Decline", Color(0xFFE05A5A)) { manager.declineOrHangup() }
                    RoundButton("Accept", Color(0xFF2ECC71)) { manager.acceptIncoming() }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    ControlToggle(if (s.micMuted) "Unmute" else "Mute", s.micMuted) { manager.toggleMute() }
                    if (s.type == CallType.VIDEO) {
                        ControlToggle(if (s.videoEnabled) "Video" else "Video off", !s.videoEnabled) { manager.toggleVideo() }
                        ControlToggle("Flip", false) { manager.switchCamera() }
                    }
                }
                Spacer(Modifier.height(28.dp))
                RoundButton("End", Color(0xFFE05A5A)) { manager.declineOrHangup() }
            }
        }
    }
}

@Composable
private fun RoundButton(label: String, color: Color, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(68.dp).clip(CircleShape).background(color).clickable { onClick() },
            contentAlignment = Alignment.Center,
        ) { Text(if (label == "End" || label == "Decline") "✕" else "✓", color = Color.White, fontSize = 26.sp) }
        Spacer(Modifier.height(6.dp))
        Text(label, color = Color.White, fontSize = 13.sp)
    }
}

@Composable
private fun ControlToggle(label: String, active: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(58.dp).clip(CircleShape)
                .background(if (active) Color(0xFF35E0C4) else Color(0xFF1B2530))
                .clickable { onClick() },
            contentAlignment = Alignment.Center,
        ) { Text(label.take(1), color = if (active) Color.Black else Color.White, fontSize = 20.sp) }
        Spacer(Modifier.height(6.dp))
        Text(label, color = Color(0xFF9AA0A6), fontSize = 12.sp)
    }
}
