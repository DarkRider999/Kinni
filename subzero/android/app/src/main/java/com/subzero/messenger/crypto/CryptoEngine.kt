package com.subzero.messenger.crypto

import java.security.Signature
import java.util.concurrent.ConcurrentHashMap

/**
 * Facade over the crypto stack used by the rest of the app. Owns one
 * [DoubleRatchet] per conversation and exposes simple encrypt/decrypt of
 * UTF-8 text. Session state lives in memory; if persistence is enabled it is
 * serialized through [KeyStoreManager] (hardware-wrapped), never as plaintext.
 *
 * TODO(subzero): wire session-blob serialization to KeyStoreManager for opt-in
 * encrypted persistence; the in-memory path is complete and is the default.
 */
class CryptoEngine {

    private val sessions = ConcurrentHashMap<String, DoubleRatchet>()

    /** Verify a peer's signed prekey against their Ed25519 identity key. */
    fun verifyPreKey(bundle: X3DH.PreKeyBundle): Boolean {
        val sig = Signature.getInstance("Ed25519")
        sig.initVerify(bundle.identityKey)
        sig.update(Keys.encodePublic(bundle.signedPreKey))
        return sig.verify(bundle.signedPreKeySignature)
    }

    /** Establish a sender session (X3DH initiator + ratchet). */
    fun startSession(conversationId: String, selfIdentityX: java.security.KeyPair, peer: X3DH.PreKeyBundle) {
        require(verifyPreKey(peer)) { "signed prekey verification failed" }
        val ephemeral = Keys.generateX25519()
        val root = X3DH.initiate(selfIdentityX, ephemeral, peer)
        sessions[conversationId] = DoubleRatchet.initSender(root, peer.signedPreKey)
    }

    /** Establish a receiver session from the initiator's public handshake keys. */
    fun acceptSession(
        conversationId: String,
        self: X3DH.LocalKeys,
        peerIdentityX: java.security.PublicKey,
        peerEphemeral: java.security.PublicKey,
    ) {
        val root = X3DH.respond(self, peerIdentityX, peerEphemeral)
        sessions[conversationId] = DoubleRatchet.initReceiver(root, self.signedPreKey)
    }

    fun encrypt(conversationId: String, text: String): DoubleRatchet.EncryptedMessage {
        val ratchet = sessions[conversationId] ?: error("no session for $conversationId")
        return ratchet.encrypt(text.toByteArray(Charsets.UTF_8))
    }

    fun decrypt(conversationId: String, message: DoubleRatchet.EncryptedMessage): String {
        val ratchet = sessions[conversationId] ?: error("no session for $conversationId")
        return String(ratchet.decrypt(message), Charsets.UTF_8)
    }

    /** Drop all live sessions (secure logout). */
    fun wipeSessions() = sessions.clear()
}
