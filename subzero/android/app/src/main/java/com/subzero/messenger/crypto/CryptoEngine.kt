package com.subzero.messenger.crypto

import java.security.KeyPair
import java.security.PublicKey
import java.security.Signature
import java.util.concurrent.ConcurrentHashMap

/**
 * Owns this device's long-term identity and prekeys, publishes a public prekey
 * bundle, and runs the X3DH handshake + Double Ratchet for each conversation.
 *
 * Session bootstrap over the wire:
 *  - The initiator fetches the peer's [PublishedBundle], calls [startOutbound],
 *    and attaches the returned [Handshake] to its first message.
 *  - The responder sees a [Handshake] on the first inbound message, calls
 *    [acceptInbound], then decrypts.
 * After that first message both sides just ratchet.
 *
 * Identity keys are held in memory here; TODO(subzero): persist them (encrypted
 * via KeyStoreManager) so a restart keeps the same identity instead of forcing a
 * fresh handshake.
 */
class CryptoEngine {

    private val identitySign: KeyPair = Keys.generateEd25519()
    private val identityX: KeyPair = Keys.generateX25519()
    private val signedPreKey: KeyPair = Keys.generateX25519()
    private val signedPreKeySignature: ByteArray = sign(Keys.encodePublic(signedPreKey.public))

    private val sessions = ConcurrentHashMap<String, DoubleRatchet>()

    // --- identity / bundle ---

    /** The public prekey bundle to publish to the relay's directory. */
    fun myBundle(): X3DH.PreKeyBundle = X3DH.PreKeyBundle(
        identityKey = identitySign.public,
        identityKeyX = identityX.public,
        signedPreKey = signedPreKey.public,
        signedPreKeySignature = signedPreKeySignature,
        oneTimePreKey = null,
    )

    /** Serialize [myBundle] to a transport string for the directory. */
    fun myBundleWire(): String = Wire.encodeBundle(myBundle())

    private fun sign(data: ByteArray): ByteArray =
        Signature.getInstance("Ed25519").run { initSign(identitySign.private); update(data); sign() }

    fun verifyPreKey(bundle: X3DH.PreKeyBundle): Boolean =
        Signature.getInstance("Ed25519").run {
            initVerify(bundle.identityKey)
            update(Keys.encodePublic(bundle.signedPreKey))
            verify(bundle.signedPreKeySignature)
        }

    // --- session bootstrap ---

    /** Handshake keys the initiator sends with its first message. */
    data class Handshake(val identityKey: PublicKey, val identityKeyX: PublicKey, val ephemeral: PublicKey)

    /** Initiator side. Establishes the session and returns the handshake to send. */
    fun startOutbound(conversationId: String, peerWireBundle: String): Handshake {
        val peer = Wire.decodeBundle(peerWireBundle)
        require(verifyPreKey(peer)) { "signed prekey verification failed" }
        val ephemeral = Keys.generateX25519()
        val root = X3DH.initiate(identityX, ephemeral, peer)
        sessions[conversationId] = DoubleRatchet.initSender(root, peer.signedPreKey)
        return Handshake(identitySign.public, identityX.public, ephemeral.public)
    }

    /** Responder side. Consumes the initiator's handshake and opens the session. */
    fun acceptInbound(conversationId: String, handshake: Handshake) {
        val self = X3DH.LocalKeys(identityX, signedPreKey, oneTimePreKey = null)
        val root = X3DH.respond(self, handshake.identityKeyX, handshake.ephemeral)
        sessions[conversationId] = DoubleRatchet.initReceiver(root, signedPreKey)
    }

    fun hasSession(conversationId: String): Boolean = sessions.containsKey(conversationId)

    // --- messaging ---

    fun encrypt(conversationId: String, text: String): DoubleRatchet.EncryptedMessage {
        val ratchet = sessions[conversationId] ?: error("no session for $conversationId")
        return ratchet.encrypt(text.toByteArray(Charsets.UTF_8))
    }

    fun decrypt(conversationId: String, message: DoubleRatchet.EncryptedMessage): String {
        val ratchet = sessions[conversationId] ?: error("no session for $conversationId")
        return String(ratchet.decrypt(message), Charsets.UTF_8)
    }

    fun wipeSessions() = sessions.clear()

    /** Wire (de)serialization of bundles and handshakes as base64 field maps. */
    object Wire {
        private fun b64(b: ByteArray) = java.util.Base64.getEncoder().encodeToString(b)
        private fun unb64(s: String) = java.util.Base64.getDecoder().decode(s)

        fun encodeBundle(b: X3DH.PreKeyBundle): String = listOf(
            b64(Keys.encodePublic(b.identityKey)),
            b64(Keys.encodePublic(b.identityKeyX)),
            b64(Keys.encodePublic(b.signedPreKey)),
            b64(b.signedPreKeySignature),
        ).joinToString("|")

        fun decodeBundle(s: String): X3DH.PreKeyBundle {
            val p = s.split("|")
            return X3DH.PreKeyBundle(
                identityKey = decodeEd25519(unb64(p[0])),
                identityKeyX = Keys.decodeX25519Public(unb64(p[1])),
                signedPreKey = Keys.decodeX25519Public(unb64(p[2])),
                signedPreKeySignature = unb64(p[3]),
                oneTimePreKey = null,
            )
        }

        fun encodeHandshake(h: Handshake): String = listOf(
            b64(Keys.encodePublic(h.identityKey)),
            b64(Keys.encodePublic(h.identityKeyX)),
            b64(Keys.encodePublic(h.ephemeral)),
        ).joinToString("|")

        fun decodeHandshake(s: String): Handshake {
            val p = s.split("|")
            return Handshake(
                identityKey = decodeEd25519(unb64(p[0])),
                identityKeyX = Keys.decodeX25519Public(unb64(p[1])),
                ephemeral = Keys.decodeX25519Public(unb64(p[2])),
            )
        }

        private fun decodeEd25519(bytes: ByteArray): PublicKey =
            java.security.KeyFactory.getInstance("Ed25519")
                .generatePublic(java.security.spec.X509EncodedKeySpec(bytes))
    }
}
