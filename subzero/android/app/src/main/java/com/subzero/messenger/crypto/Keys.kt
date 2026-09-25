package com.subzero.messenger.crypto

import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.PublicKey
import java.security.spec.X509EncodedKeySpec
import javax.crypto.KeyAgreement

/**
 * X25519 (agreement) and Ed25519 (signing) key helpers built on the JCA XDH/
 * EdDSA providers available on Android 12+ (API 31). Long-term identity keys
 * that must never leave hardware are created via [KeyStoreManager]; the
 * ephemeral ratchet keys handled here are process-local and cleared with the
 * ratchet state.
 */
object Keys {

    fun generateX25519(): KeyPair =
        KeyPairGenerator.getInstance("XDH").apply { initialize(255) }.generateKeyPair()

    fun generateEd25519(): KeyPair =
        KeyPairGenerator.getInstance("Ed25519").generateKeyPair()

    /** Raw-ish public encoding for wire transport (X.509 SubjectPublicKeyInfo). */
    fun encodePublic(key: PublicKey): ByteArray = key.encoded

    fun decodeX25519Public(bytes: ByteArray): PublicKey =
        KeyFactory.getInstance("XDH").generatePublic(X509EncodedKeySpec(bytes))

    /** X25519 Diffie–Hellman shared secret. */
    fun agree(privateKey: PrivateKey, peerPublic: PublicKey): ByteArray {
        val ka = KeyAgreement.getInstance("XDH")
        ka.init(privateKey)
        ka.doPhase(peerPublic, true)
        return ka.generateSecret()
    }
}
