package com.subzero.messenger.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Proves two independent devices establish a session over the wire (X3DH via a
 * serialized prekey bundle + handshake) and then exchange Double Ratchet
 * messages both directions. This is the end-to-end path the relay carries.
 */
class HandshakeTest {

    @Test fun twoDevicesEstablishAndMessage() {
        val alice = CryptoEngine()
        val bob = CryptoEngine()
        val cid = "conversation"

        // Bob publishes his bundle to the directory; Alice fetches it (as wire strings).
        val bobBundleWire = bob.myBundleWire()

        // Alice initiates: establishes her session and produces a handshake.
        val handshake = alice.startOutbound(cid, bobBundleWire)
        val handshakeWire = CryptoEngine.Wire.encodeHandshake(handshake)

        // Alice's first message.
        val m1 = alice.encrypt(cid, "hey, it's me")

        // Bob receives the handshake on that first message, opens his session, decrypts.
        assertTrue(!bob.hasSession(cid))
        bob.acceptInbound(cid, CryptoEngine.Wire.decodeHandshake(handshakeWire))
        assertEquals("hey, it's me", bob.decrypt(cid, m1))

        // Bob replies; Alice decrypts (ratchet turns over).
        val reply = bob.encrypt(cid, "got it 🔒")
        assertEquals("got it 🔒", alice.decrypt(cid, reply))

        // A few more back-and-forth to exercise the ratchet.
        assertEquals("three", bob.decrypt(cid, alice.encrypt(cid, "three")))
        assertEquals("four", alice.decrypt(cid, bob.encrypt(cid, "four")))
    }

    @Test fun bundleRoundTripsThroughWire() {
        val bob = CryptoEngine()
        val wire = bob.myBundleWire()
        val decoded = CryptoEngine.Wire.decodeBundle(wire)
        assertTrue(bob.verifyPreKey(decoded))
    }
}
