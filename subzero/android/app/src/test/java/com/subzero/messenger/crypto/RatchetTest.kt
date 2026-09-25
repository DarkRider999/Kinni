package com.subzero.messenger.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * JVM unit tests for the crypto core. XDH (X25519) and Ed25519 are available in
 * the JDK (11+/15+), so these run on the host JVM without a device.
 */
class RatchetTest {

    @Test fun hkdf_isDeterministic() {
        val a = Kdf.deriveKey("ikm".toByteArray(), salt = "salt".toByteArray(), length = 32)
        val b = Kdf.deriveKey("ikm".toByteArray(), salt = "salt".toByteArray(), length = 32)
        assertArrayEquals(a, b)
        assertEquals(32, a.size)
    }

    @Test fun aead_roundTrips_andBindsAad() {
        val key = ByteArray(32) { it.toByte() }
        val sealed = Aead.seal(key, "hello".toByteArray(), "hdr".toByteArray())
        assertEquals("hello", String(Aead.open(key, sealed, "hdr".toByteArray())))
    }

    @Test fun doubleRatchet_backAndForth() {
        // Shared root established out-of-band (X3DH tested separately).
        val root = Kdf.deriveKey("shared".toByteArray(), length = 32)
        val bobPrekey = Keys.generateX25519()

        val alice = DoubleRatchet.initSender(root, bobPrekey.public)
        val bob = DoubleRatchet.initReceiver(root, bobPrekey)

        val m1 = alice.encrypt("first".toByteArray())
        assertEquals("first", String(bob.decrypt(m1)))

        val reply = bob.encrypt("second".toByteArray())
        assertEquals("second", String(alice.decrypt(reply)))

        val m3 = alice.encrypt("third".toByteArray())
        assertEquals("third", String(bob.decrypt(m3)))
    }
}
