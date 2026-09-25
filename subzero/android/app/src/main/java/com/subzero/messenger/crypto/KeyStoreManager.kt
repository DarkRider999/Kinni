package com.subzero.messenger.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Wraps the Android Keystore. The master symmetric key never leaves secure
 * hardware (StrongBox when the device provides it). It is used to encrypt the
 * serialized ratchet/session blob before it is written to app-private storage,
 * so no long-lived plaintext key material touches disk.
 *
 * Access can be gated behind biometric authentication via
 * [setUserAuthenticationRequired].
 */
class KeyStoreManager(
    private val alias: String = "subzero.master",
    requireBiometric: Boolean = false,
) {
    private val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    init {
        if (!keyStore.containsAlias(alias)) generateMasterKey(requireBiometric)
    }

    private fun generateMasterKey(requireBiometric: Boolean) {
        val kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .apply {
                if (requireBiometric) {
                    setUserAuthenticationRequired(true)
                    setUserAuthenticationParameters(30, KeyProperties.AUTH_BIOMETRIC_STRONG)
                }
                // StrongBox where available; caller falls back on StrongBoxUnavailableException.
                setIsStrongBoxBacked(true)
            }
            .build()
        kg.init(spec)
        kg.generateKey()
    }

    private fun masterKey(): SecretKey =
        (keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry).secretKey

    fun encrypt(plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, masterKey())
        val iv = cipher.iv
        return byteArrayOf(iv.size.toByte()) + iv + cipher.doFinal(plaintext)
    }

    fun decrypt(blob: ByteArray): ByteArray {
        val ivLen = blob[0].toInt()
        val iv = blob.copyOfRange(1, 1 + ivLen)
        val ct = blob.copyOfRange(1 + ivLen, blob.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(128, iv))
        return cipher.doFinal(ct)
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    }
}
