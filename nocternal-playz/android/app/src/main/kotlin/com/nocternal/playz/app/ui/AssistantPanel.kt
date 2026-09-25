package com.nocternal.playz.app.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.ai.AssistantAction
import com.nocternal.playz.ai.NeonArtSpec
import com.nocternal.playz.app.ActionExecutor
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.app.voice.VoiceState
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.VoiceOrb
import com.nocternal.playz.designsystem.neonGlow
import com.nocternal.playz.ui.player.NeonArtView
import kotlinx.coroutines.launch

private data class ChatMessage(val fromUser: Boolean, val text: String, val art: NeonArtSpec? = null, val suggestions: List<String> = emptyList())

private val QUICK_ACTIONS = listOf("Play trance playlist", "Boost bass", "Activate meditation theme", "What song is this?", "Recommend EQ", "Sleep in 30 minutes", "Karaoke on", "Auto mix")

/** AI Assistant panel (spec §4/§10): neon chat bubbles, quick actions and a voice orb. */
@Composable
fun AssistantPanel(c: AppContainer, actions: ActionExecutor) {
    val p = Neon.palette
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val messages = remember { mutableStateListOf(ChatMessage(false, "Hi, I'm Nocternal AI 🌙 Ask for a mood, a genre, an EQ or a theme — or tap the orb and speak.")) }
    var input by remember { mutableStateOf("") }
    var thinking by remember { mutableStateOf(false) }
    val voice by c.voice.state.collectAsStateWithLifecycle()
    val list = rememberLazyListState()

    fun send(text: String) {
        if (text.isBlank()) return
        messages += ChatMessage(true, text)
        thinking = true
        scope.launch {
            val r = c.assistant.value.handle(text, actions.context())
            actions.run(r.actions)
            val art = r.actions.filterIsInstance<AssistantAction.ShowAlbumArt>().firstOrNull()?.spec
            messages += ChatMessage(false, r.reply, art, r.suggestions)
            thinking = false
        }
    }

    fun recognize() = scope.launch {
        messages += ChatMessage(false, "Listening for 8 seconds… 🎧")
        c.recognizer.listenAndIdentify().onSuccess { song ->
            messages += ChatMessage(false, song?.let { "That's “${it.title}” by ${it.artist}${it.album?.let { a -> " · $a" } ?: ""}." } ?: "I couldn't identify it — try closer to the speaker.",
                suggestions = song?.let { listOf("Play ${it.title} ${it.artist}") }.orEmpty())
        }.onFailure { messages += ChatMessage(false, it.message ?: "Recognition failed") }
    }

    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) c.voice.start() else messages += ChatMessage(false, "I need microphone access for voice commands.")
    }
    val recognitionPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) recognize() }
    fun hasMic() = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    LaunchedEffect(Unit) {
        actions.recognitionRequests.collect { if (hasMic()) recognize() else recognitionPermission.launch(Manifest.permission.RECORD_AUDIO) }
    }
    LaunchedEffect(voice) {
        (voice as? VoiceState.Result)?.let { send(it.text); c.voice.reset() }
        (voice as? VoiceState.Error)?.let { messages += ChatMessage(false, it.message); c.voice.reset() }
    }
    LaunchedEffect(messages.size) { if (messages.isNotEmpty()) list.animateScrollToItem(messages.lastIndex) }

    Column(Modifier.fillMaxWidth().fillMaxHeight(0.88f).navigationBarsPadding().imePadding().padding(horizontal = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Nocternal AI", style = MaterialTheme.typography.headlineSmall, color = p.onBackground, modifier = Modifier.weight(1f))
            val listening = voice as? VoiceState.Listening
            VoiceOrb(listening != null, listening?.level ?: 0f, size = 56.dp) {
                if (listening != null) c.voice.stop() else if (hasMic()) c.voice.start() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
        (voice as? VoiceState.Listening)?.partial?.takeIf { it.isNotBlank() }?.let { Text("“$it”", color = p.accent, style = MaterialTheme.typography.bodyMedium) }

        LazyColumn(Modifier.weight(1f), state = list, contentPadding = PaddingValues(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(messages) { m -> Bubble(m) { send(it) } }
            if (thinking) item { Text("…", color = p.accent) }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 6.dp)) {
            items(QUICK_ACTIONS) { q -> NeonChip(q) { send(q) } }
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
            OutlinedTextField(
                input, { input = it }, Modifier.weight(1f), placeholder = { Text("Ask or command…") }, singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { send(input); input = "" }),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, cursorColor = p.accent), shape = RoundedCornerShape(24.dp),
            )
            IconButton(onClick = { send(input); input = "" }) { Icon(Icons.AutoMirrored.Filled.Send, "Send", tint = p.accent) }
        }
    }
}

@Composable
private fun Bubble(m: ChatMessage, onSuggestion: (String) -> Unit) {
    val p = Neon.palette
    val shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = if (m.fromUser) 20.dp else 4.dp, bottomEnd = if (m.fromUser) 4.dp else 20.dp)
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (m.fromUser) Alignment.End else Alignment.Start) {
        Box(
            Modifier.widthIn(max = 300.dp)
                .neonGlow(if (m.fromUser) p.secondary else p.accent, p.glow * 0.35f, corner = 20.dp)
                .clip(shape)
                .background(if (m.fromUser) Brush.linearGradient(listOf(p.secondary.copy(alpha = 0.35f), p.surface)) else Brush.linearGradient(listOf(p.surface, p.accent.copy(alpha = 0.18f))))
                .border(1.dp, (if (m.fromUser) p.secondary else p.accent).copy(alpha = 0.6f), shape)
                .padding(12.dp),
        ) {
            Column {
                Text(m.text, color = p.onBackground, style = MaterialTheme.typography.bodyMedium)
                m.art?.let { Spacer(Modifier.width(8.dp)); NeonArtView(it, Modifier.padding(top = 8.dp).fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(16.dp))) }
            }
        }
        if (m.suggestions.isNotEmpty()) LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
            items(m.suggestions) { s -> NeonChip(s) { onSuggestion(s) } }
        }
    }
}
