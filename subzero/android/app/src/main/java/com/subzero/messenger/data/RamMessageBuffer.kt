package com.subzero.messenger.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory store of decrypted messages. Nothing here is persisted to disk.
 *
 * Responsibilities:
 *  - hold live conversations while the app is unlocked,
 *  - evict messages past their disappearing-message expiry,
 *  - zero message bodies on eviction and on [wipeAll] (secure logout / SafeZone
 *    auto-lock / user-initiated wipe).
 *
 * Bounded per-conversation to [maxPerConversation] so a long session cannot grow
 * memory without limit; the oldest message is wiped when the cap is exceeded.
 */
class RamMessageBuffer(private val maxPerConversation: Int = 500) {

    private val conversations = ConcurrentHashMap<String, MutableList<Message>>()
    private val _updates = MutableStateFlow(0L)

    /** Bumped on every mutation so ViewModels can recompose. */
    val updates: StateFlow<Long> = _updates.asStateFlow()

    fun add(message: Message) {
        val list = conversations.getOrPut(message.conversationId) { mutableListOf() }
        synchronized(list) {
            list.add(message)
            while (list.size > maxPerConversation) list.removeAt(0).wipe()
        }
        bump()
    }

    fun messages(conversationId: String): List<Message> {
        evictExpired()
        val list = conversations[conversationId] ?: return emptyList()
        return synchronized(list) { list.toList() }
    }

    fun evictExpired() {
        val now = System.currentTimeMillis()
        var changed = false
        conversations.values.forEach { list ->
            synchronized(list) {
                val it = list.iterator()
                while (it.hasNext()) {
                    val m = it.next()
                    val exp = m.expiresAtMillis
                    if (exp != null && exp <= now) { m.wipe(); it.remove(); changed = true }
                }
            }
        }
        if (changed) bump()
    }

    /** Clears one conversation from view (used by SafeZone activation). */
    fun clearConversationView(conversationId: String) {
        conversations[conversationId]?.let { list ->
            synchronized(list) { list.forEach { it.wipe() }; list.clear() }
        }
        bump()
    }

    /** Zeroes and drops all message content. Called on secure logout / auto-lock. */
    fun wipeAll() {
        conversations.values.forEach { list ->
            synchronized(list) { list.forEach { it.wipe() }; list.clear() }
        }
        conversations.clear()
        bump()
    }

    private fun bump() { _updates.value = _updates.value + 1 }
}
