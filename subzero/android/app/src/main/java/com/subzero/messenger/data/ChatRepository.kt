package com.subzero.messenger.data

import com.subzero.messenger.crypto.CryptoEngine
import com.subzero.messenger.crypto.DoubleRatchet
import org.json.JSONObject
import java.util.Base64

/**
 * Owns the messaging path: shows messages locally, and — when a relay is
 * configured — establishes the E2E session (X3DH handshake over the wire) and
 * relays ciphertext.
 *
 * Offline (no relay): messages are shown locally only. Sending never requires a
 * session and never throws, so the app is fully usable without a backend.
 *
 * Online: on the first message the initiator fetches the peer's published prekey
 * bundle, runs [CryptoEngine.startOutbound], and attaches the resulting
 * handshake to the wire envelope. The responder sees the handshake, runs
 * [CryptoEngine.acceptInbound], and decrypts. After that both sides just ratchet.
 */
class ChatRepository(
    private val crypto: CryptoEngine,
    private val buffer: RamMessageBuffer,
    private val transport: Transport,
    private val directory: Directory,
    private val conversationId: String = "demo-conversation",
    private val relayEnabled: Boolean = false,
    private val disappearingTtlMillis: Long? = null,
) {
    /** Moves opaque ciphertext envelopes to/from the peer via the relay. */
    interface Transport {
        fun send(envelope: String)
        fun onReceive(handler: (envelope: String) -> Unit)
    }

    /** Publishes our public prekey bundle and fetches the peer's. */
    interface Directory {
        fun publish(bundleWire: String)
        fun requestPeerBundle()
        fun onPeerBundle(handler: (bundleWire: String) -> Unit)
    }

    private var peerBundleWire: String? = null
    private val outbox = ArrayDeque<String>()          // texts awaiting a session
    private var pendingHandshake: String? = null       // attach to next sent envelope

    init {
        if (relayEnabled) {
            directory.onPeerBundle { wire -> peerBundleWire = wire; flushOutbox() }
            transport.onReceive { env -> handleInbound(env) }
            directory.publish(crypto.myBundleWire())
            directory.requestPeerBundle()
        }
    }

    fun sendText(conversationId: String, text: String) {
        // Always show the message locally so the app works with or without a relay.
        buffer.add(
            Message(
                conversationId = conversationId,
                direction = MessageDirection.OUTBOUND,
                body = text.toCharArray(),
                expiresAtMillis = disappearingTtlMillis?.let { System.currentTimeMillis() + it },
                delivery = if (relayEnabled) DeliveryState.SENDING else DeliveryState.SENT,
            )
        )
        if (relayEnabled) transmit(text)
    }

    private fun transmit(text: String) {
        try {
            if (!crypto.hasSession(conversationId)) {
                val bundle = peerBundleWire ?: run { outbox.addLast(text); return }
                val handshake = crypto.startOutbound(conversationId, bundle)
                pendingHandshake = CryptoEngine.Wire.encodeHandshake(handshake)
            }
            val enc = crypto.encrypt(conversationId, text)
            transport.send(envelope(pendingHandshake, enc).also { pendingHandshake = null })
        } catch (_: Exception) {
            // Never let a transport/crypto hiccup crash the UI; message stays shown locally.
        }
    }

    private fun handleInbound(envelope: String) {
        try {
            val o = JSONObject(envelope)
            if (o.has("hs") && !crypto.hasSession(conversationId)) {
                crypto.acceptInbound(conversationId, CryptoEngine.Wire.decodeHandshake(o.getString("hs")))
            }
            val header = DoubleRatchet.Header.fromBytes(unb64(o.getString("h")))
            val message = DoubleRatchet.EncryptedMessage(header, unb64(o.getString("c")))
            val text = crypto.decrypt(conversationId, message)
            buffer.add(
                Message(
                    conversationId = conversationId,
                    direction = MessageDirection.INBOUND,
                    body = text.toCharArray(),
                    expiresAtMillis = disappearingTtlMillis?.let { System.currentTimeMillis() + it },
                    delivery = DeliveryState.DELIVERED,
                )
            )
        } catch (_: Exception) {
            // Drop undecryptable frames rather than crash.
        }
    }

    private fun flushOutbox() {
        while (outbox.isNotEmpty()) transmit(outbox.removeFirst())
    }

    private fun envelope(handshake: String?, enc: DoubleRatchet.EncryptedMessage): String {
        val o = JSONObject()
        if (handshake != null) o.put("hs", handshake)
        o.put("h", b64(enc.header.toBytes()))
        o.put("c", b64(enc.ciphertext))
        return o.toString()
    }

    fun logout() {
        crypto.wipeSessions()
        buffer.wipeAll()
    }

    private fun b64(b: ByteArray) = Base64.getEncoder().encodeToString(b)
    private fun unb64(s: String) = Base64.getDecoder().decode(s)
}
