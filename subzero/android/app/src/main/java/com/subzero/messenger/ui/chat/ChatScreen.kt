package com.subzero.messenger.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.subzero.messenger.data.Message
import com.subzero.messenger.data.MessageDirection

/**
 * Encrypted conversation screen. The SafeZone button sits in the input row
 * disguised as a neutral icon (an emoji/attachment-style glyph); tapping it
 * calls [onSafeZone] which activates the quick-hide flow instantly.
 */
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    onSafeZone: () -> Unit,
    onVoiceCall: () -> Unit = {},
    onVideoCall: () -> Unit = {},
    onOpenVault: () -> Unit = {},
) {
    val state by viewModel.state.collectAsState()

    Column(Modifier.fillMaxSize().background(Color(0xFF0B0F14))) {
        Row(
            Modifier.fillMaxWidth().background(Color(0xFF11181F))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("SubZero", color = Color.White, fontSize = 18.sp)
            Spacer(Modifier.weight(1f))
            TopAction("📞", onVoiceCall)
            TopAction("🎥", onVideoCall)
            TopAction("🗄", onOpenVault)
        }
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
            reverseLayout = true,
        ) {
            items(state.messages.reversed()) { msg -> MessageBubble(msg) }
        }

        Row(
            Modifier.fillMaxWidth().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // SafeZone button — looks like a harmless accessory icon.
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(Color(0xFF16202B)),
                contentAlignment = Alignment.Center,
            ) {
                Text("◎", color = Color(0xFF35E0C4), textAlign = TextAlign.Center,
                    modifier = Modifier.clip(CircleShape).background(Color.Transparent)
                        .padding(8.dp).clickableNoRipple(onSafeZone))
            }
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(
                value = state.draft,
                onValueChange = viewModel::onDraftChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message", color = Color.Gray) },
                keyboardActions = KeyboardActions(onSend = { viewModel.send() }),
                singleLine = true,
            )
            Spacer(Modifier.width(8.dp))
            Button(onClick = viewModel::send) { Text("Send") }
        }
    }
}

@Composable
private fun MessageBubble(msg: Message) {
    val outbound = msg.direction == MessageDirection.OUTBOUND
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = if (outbound) Arrangement.End else Arrangement.Start,
    ) {
        Box(
            Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(16.dp))
                .background(if (outbound) Color(0xFF1C7A6E) else Color(0xFF1B2530))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(String(msg.body), color = Color.White)
        }
    }
}

@Composable
private fun TopAction(glyph: String, onClick: () -> Unit) {
    Box(
        Modifier.padding(start = 14.dp).size(36.dp).clip(CircleShape).background(Color(0xFF16202B))
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) { Text(glyph, fontSize = 16.sp) }
}

// Minimal no-ripple click helper to keep the SafeZone glyph unobtrusive.
@Composable
private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    return this.clickable(interactionSource = interaction, indication = null, onClick = onClick)
}
