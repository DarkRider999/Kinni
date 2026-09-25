package com.nocternal.playz.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.BetaStopReason
import com.anthropic.models.beta.messages.MessageCreateParams
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Claude backend for free-form assistant questions, using the official Anthropic Java SDK (runs on Android).
 *
 * The key is the user's own (Settings → AI), stored only on the device and never included in backups.
 * For a public release, route requests through your own server instead of shipping keys in the app.
 * Server-side refusal fallbacks are enabled so a declined request is retried on a fallback model.
 */
class ClaudeAssistantLlm(
    apiKey: String,
    private val model: String = DEFAULT_MODEL,
) : AssistantLlm {
    private val client: AnthropicClient = AnthropicOkHttpClient.builder().apiKey(apiKey).build()

    override suspend fun complete(system: String, turns: List<LlmTurn>): String = withContext(Dispatchers.IO) {
        val builder = MessageCreateParams.builder()
            .model(model)
            .maxTokens(4096L)
            .system(system)
            // Short conversational answers: low effort keeps replies fast.
            .outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
            .addBeta("server-side-fallback-2026-07-01")
            .fallbacksDefault()
        turns.forEach { if (it.role == LlmRole.USER) builder.addUserMessage(it.text) else builder.addAssistantMessage(it.text) }

        val message = client.beta().messages().create(builder.build())
        if (message.stopReason().orElse(null) == BetaStopReason.REFUSAL) {
            return@withContext "I can’t help with that one — ask me about music, playlists or sound settings."
        }
        message.content().mapNotNull { block -> block.text().orElse(null)?.text() }.joinToString("\n").trim()
            .ifEmpty { "Sorry, I didn’t catch that." }
    }

    companion object {
        const val DEFAULT_MODEL = "claude-opus-5"
    }
}
