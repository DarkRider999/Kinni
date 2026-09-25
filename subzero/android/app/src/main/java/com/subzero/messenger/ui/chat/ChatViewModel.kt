package com.subzero.messenger.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.subzero.messenger.data.ChatRepository
import com.subzero.messenger.data.Message
import com.subzero.messenger.data.RamMessageBuffer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ChatUiState(
    val conversationId: String,
    val messages: List<Message> = emptyList(),
    val draft: String = "",
    val disappearingSeconds: Int = 0, // 0 = off
)

class ChatViewModel(
    private val repository: ChatRepository,
    private val buffer: RamMessageBuffer,
    conversationId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState(conversationId))
    val state: StateFlow<ChatUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            buffer.updates.collect { refresh() }
        }
    }

    private fun refresh() {
        _state.value = _state.value.copy(messages = buffer.messages(_state.value.conversationId))
    }

    fun onDraftChange(text: String) { _state.value = _state.value.copy(draft = text) }

    fun send() {
        val s = _state.value
        if (s.draft.isBlank()) return
        repository.sendText(s.conversationId, s.draft.trim())
        _state.value = s.copy(draft = "")
    }

    fun setDisappearing(seconds: Int) {
        _state.value = _state.value.copy(disappearingSeconds = seconds)
    }
}
