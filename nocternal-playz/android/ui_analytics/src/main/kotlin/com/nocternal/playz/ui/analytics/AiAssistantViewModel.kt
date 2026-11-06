package com.nocternal.playz.ui.analytics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nocternal.playz.database.NocternalDatabase
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatMessage(val role: String, val text: String, val timestamp: Long = System.currentTimeMillis())

private const val SIMULATED_LATENCY_MS = 1500L

class AiAssistantViewModel(private val db: NocternalDatabase) : ViewModel() {
    val messages: MutableStateFlow<List<ChatMessage>> = MutableStateFlow(
        listOf(
            ChatMessage(
                "assistant",
                "Hi! I'm your AI DJ assistant. Ask me to generate playlists, suggest tracks by BPM/key, or analyze your listening habits.",
            ),
        ),
    )
    val inputText: MutableStateFlow<String> = MutableStateFlow("")
    val isLoading: MutableStateFlow<Boolean> = MutableStateFlow(false)

    fun updateInput(text: String) {
        inputText.value = text
    }

    // Real Gemini API integration is a future task; the reply is simulated here.
    fun sendMessage() {
        val prompt = inputText.value.trim()
        if (prompt.isEmpty() || isLoading.value) return

        messages.update { it + ChatMessage("user", prompt) }
        inputText.value = ""
        isLoading.value = true

        viewModelScope.launch {
            try {
                delay(SIMULATED_LATENCY_MS)
                messages.update { it + ChatMessage("assistant", cannedResponse(prompt)) }
            } finally {
                isLoading.value = false
            }
        }
    }

    class Factory(private val db: NocternalDatabase) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AiAssistantViewModel::class.java)) {
                "Unknown ViewModel class: ${modelClass.name}"
            }
            return AiAssistantViewModel(db) as T
        }
    }
}

internal fun cannedResponse(prompt: String): String {
    val text = prompt.lowercase()
    return when {
        "playlist" in text -> "I'll generate a playlist for you! Analyzing your library..."
        "bpm" in text -> "Looking at tracks with matching BPM..."
        "key" in text || "harmonic" in text -> "Using Camelot wheel for harmonic mixing..."
        else -> "I'm analyzing your request..."
    }
}
