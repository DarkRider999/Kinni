package com.nocternal.playz.ai

enum class LlmRole { USER, ASSISTANT }
data class LlmTurn(val role: LlmRole, val text: String)

/** A chat-completion backend for free-form questions. Optional: the assistant works offline without one. */
fun interface AssistantLlm {
    suspend fun complete(system: String, turns: List<LlmTurn>): String
}
