package com.subzero.messenger.crypto

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Authenticated encryption for message payloads: AES-256-GCM with a random
 * 96-bit nonce prepended to the ciphertext. The associated data binds the
 * ratchet header so headers cannot be swapped between messages.
 */
object Aead {

    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val NONCE_LEN = 12
    private const val TAG_BITS = 128
    private val rng = SecureRandom()

    fun seal(key: ByteArray, plaintext: ByteArray, associatedData: ByteArray = ByteArray(0)): ByteArray {
        require(key.size == 32) { "AES-256 key must be 32 bytes" }
        val nonce = ByteArray(NONCE_LEN).also { rng.nextBytes(it) }
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        if (associatedData.isNotEmpty()) cipher.updateAAD(associatedData)
        val ct = cipher.doFinal(plaintext)
        return nonce + ct
    }

    /** Throws [javax.crypto.AEADBadTagException] if authentication fails. */
    fun open(key: ByteArray, sealed: ByteArray, associatedData: ByteArray = ByteArray(0)): ByteArray {
        require(sealed.size > NONCE_LEN) { "ciphertext too short" }
        val nonce = sealed.copyOfRange(0, NONCE_LEN)
        val ct = sealed.copyOfRange(NONCE_LEN, sealed.size)
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        if (associatedData.isNotEmpty()) cipher.updateAAD(associatedData)
        return cipher.doFinal(ct)
    }
}
