package com.subzero.messenger.data

import java.util.UUID

/** A contact identified by their public identity key, not a phone number. */
data class Contact(
    val id: String = UUID.randomUUID().toString(),
    val displayName: String,
    val identityKey: ByteArray,      // Ed25519 public, verified out-of-band
    val safetyNumber: String,        // human-verifiable fingerprint
)

enum class MessageDirection { INBOUND, OUTBOUND }

enum class DeliveryState { SENDING, SENT, DELIVERED, READ, FAILED }

/**
 * A decrypted message as held in memory. [expiresAtMillis] drives disappearing
 * messages; the buffer evicts expired entries. Content is a [CharArray] so it
 * can be zeroed on eviction rather than left for the GC.
 */
data class Message(
    val id: String = UUID.randomUUID().toString(),
    val conversationId: String,
    val direction: MessageDirection,
    val body: CharArray,
    val timestampMillis: Long = System.currentTimeMillis(),
    val expiresAtMillis: Long? = null,
    val delivery: DeliveryState = DeliveryState.SENDING,
) {
    fun wipe() = body.fill('\u0000')
}
