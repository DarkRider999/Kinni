package com.subzero.messenger.crypto

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * HKDF-SHA256 (RFC 5869) and the symmetric-key chain KDF used by the Double
 * Ratchet. Pure functions over byte arrays; no key material is retained.
 */
object Kdf {

    private const val HASH = "HmacSHA256"
    private const val HASH_LEN = 32

    fun hmac(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance(HASH)
        mac.init(SecretKeySpec(key, HASH))
        return mac.doFinal(data)
    }

    /** HKDF-Extract then Expand into [length] bytes. */
    fun deriveKey(
        ikm: ByteArray,
        salt: ByteArray = ByteArray(HASH_LEN),
        info: ByteArray = ByteArray(0),
        length: Int = HASH_LEN,
    ): ByteArray {
        val prk = hmac(salt, ikm)
        val out = ByteArray(length)
        var t = ByteArray(0)
        var pos = 0
        var counter = 1
        while (pos < length) {
            val mac = Mac.getInstance(HASH)
            mac.init(SecretKeySpec(prk, HASH))
            mac.update(t)
            mac.update(info)
            mac.update(counter.toByte())
            t = mac.doFinal()
            val n = minOf(t.size, length - pos)
            System.arraycopy(t, 0, out, pos, n)
            pos += n
            counter++
        }
        return out
    }

    /**
     * Symmetric ratchet step. Returns (nextChainKey, messageKey) derived from the
     * current chain key using distinct info constants, per the Double Ratchet
     * spec's KDF_CK.
     */
    fun chainStep(chainKey: ByteArray): Pair<ByteArray, ByteArray> {
        val messageKey = hmac(chainKey, byteArrayOf(0x01))
        val nextChainKey = hmac(chainKey, byteArrayOf(0x02))
        return nextChainKey to messageKey
    }

    /**
     * Root ratchet step (KDF_RK): mixes a DH output into the root key, producing
     * a new root key and a fresh chain key.
     */
    fun rootStep(rootKey: ByteArray, dhOutput: ByteArray): Pair<ByteArray, ByteArray> {
        val out = deriveKey(
            ikm = dhOutput,
            salt = rootKey,
            info = "SubZero-Ratchet".toByteArray(),
            length = 64,
        )
        val newRoot = out.copyOfRange(0, 32)
        val chainKey = out.copyOfRange(32, 64)
        return newRoot to chainKey
    }
}
