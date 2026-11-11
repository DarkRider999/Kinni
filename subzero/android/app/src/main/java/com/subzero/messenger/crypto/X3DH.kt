package com.subzero.messenger.crypto

import java.security.KeyPair
import java.security.PublicKey

/**
 * X3DH (Extended Triple Diffie-Hellman) initial key agreement.
 *
 * Establishes a shared root secret between two parties without requiring both to
 * be online, using: identity keys (IK), a signed prekey (SPK) and an optional
 * one-time prekey (OPK). The result seeds the [DoubleRatchet] root key.
 *
 * Signature verification of the signed prekey against the peer's Ed25519
 * identity key is performed by [CryptoEngine] before this runs.
 */
object X3DH {

    /** Public prekey bundle a party publishes to the server. */
    data class PreKeyBundle(
        val identityKey: PublicKey,        // Ed25519 identity (for verification)
        val identityKeyX: PublicKey,       // X25519 identity (for agreement)
        val signedPreKey: PublicKey,       // X25519, signed by identityKey
        val signedPreKeySignature: ByteArray,
        val oneTimePreKey: PublicKey?,     // X25519, optional
    )

    /** Local secret material used to answer an X3DH handshake. */
    class LocalKeys(
        val identityX: KeyPair,
        val signedPreKey: KeyPair,
        val oneTimePreKey: KeyPair?,
    )

    private const val INFO = "SubZero-X3DH"

    /** Initiator ("Alice") derives the shared secret against a peer's bundle. */
    fun initiate(selfIdentityX: KeyPair, ephemeral: KeyPair, peer: PreKeyBundle): ByteArray {
        val dh1 = Keys.agree(selfIdentityX.private, peer.signedPreKey)
        val dh2 = Keys.agree(ephemeral.private, peer.identityKeyX)
        val dh3 = Keys.agree(ephemeral.private, peer.signedPreKey)
        val dh4 = peer.oneTimePreKey?.let { Keys.agree(ephemeral.private, it) } ?: ByteArray(0)
        return Kdf.deriveKey(ikm = dh1 + dh2 + dh3 + dh4, info = INFO.toByteArray(), length = 32)
    }

    /** Responder ("Bob") derives the same secret from the initiator's public keys. */
    fun respond(
        self: LocalKeys,
        peerIdentityX: PublicKey,
        peerEphemeral: PublicKey,
    ): ByteArray {
        val dh1 = Keys.agree(self.signedPreKey.private, peerIdentityX)
        val dh2 = Keys.agree(self.identityX.private, peerEphemeral)
        val dh3 = Keys.agree(self.signedPreKey.private, peerEphemeral)
        val dh4 = self.oneTimePreKey?.let { Keys.agree(it.private, peerEphemeral) } ?: ByteArray(0)
        return Kdf.deriveKey(ikm = dh1 + dh2 + dh3 + dh4, info = INFO.toByteArray(), length = 32)
    }
}
