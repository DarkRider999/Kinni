package com.subzero.messenger.data

import com.subzero.messenger.crypto.CryptoEngine
import com.subzero.messenger.crypto.DoubleRatchet

/**
 * Bridges the transport layer and the crypto engine to the RAM buffer.
 *
 * Outbound: plaintext -> CryptoEngine.encrypt -> transport.
 * Inbound: transport -> CryptoEngine.decrypt -> RAM buffer.
 *
 * The transport (WebSocket to the delivery server) is injected as [Transport];
 * a no-op stub is provided so the UI and crypto are exercisable without a
 * backend. TODO(subzero): implement the sealed-sender transport client.
 */
class ChatRepository(
    private val crypto: CryptoEngine,
    private val buffer: RamMessageBuffer,
    private val transport: Transport,
    private val disappearingTtlMillis: Long? = null,
) {
    interface Transport {
        fun send(conversationId: String, header: ByteArray, ciphertext: ByteArray)
        /** Registered callback invoked when a ciphertext arrives. */
        fun onReceive(handler: (conversationId: String, header: ByteArray, ciphertext: ByteArray) -> Unit)
    }

    init {
        transport.onReceive { conversationId, header, ciphertext ->
            val msg = DoubleRatchet.EncryptedMessage(DoubleRatchet.Header.fromBytes(header), ciphertext)
            val text = crypto.decrypt(conversationId, msg)
            buffer.add(
                Message(
                    conversationId = conversationId,
                    direction = MessageDirection.INBOUND,
                    body = text.toCharArray(),
                    expiresAtMillis = disappearingTtlMillis?.let { System.currentTimeMillis() + it },
                    delivery = DeliveryState.DELIVERED,
                )
            )
        }
    }

    fun sendText(conversationId: String, text: String) {
        val enc = crypto.encrypt(conversationId, text)
        transport.send(conversationId, enc.header.toBytes(), enc.ciphertext)
        buffer.add(
            Message(
                conversationId = conversationId,
                direction = MessageDirection.OUTBOUND,
                body = text.toCharArray(),
                expiresAtMillis = disappearingTtlMillis?.let { System.currentTimeMillis() + it },
                delivery = DeliveryState.SENT,
            )
        )
    }

    fun logout() {
        crypto.wipeSessions()
        buffer.wipeAll()
    }
}
