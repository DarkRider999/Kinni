package com.subzero.messenger.crypto

import java.security.KeyPair
import java.security.PublicKey

/**
 * Double Ratchet (Signal spec) session state.
 *
 * Provides forward secrecy (per-message symmetric ratchet) and post-compromise
 * security (DH ratchet on each new receiving header). Skipped message keys are
 * cached up to [MAX_SKIP] so out-of-order delivery still decrypts.
 *
 * State is intentionally in-memory only; it is serialized into the encrypted
 * session blob by [CryptoEngine] when persistence is enabled, never to plaintext
 * disk.
 */
class DoubleRatchet private constructor(
    private var rootKey: ByteArray,
    private var dhSelf: KeyPair,
    private var dhRemote: PublicKey?,
    private var sendChain: ByteArray?,
    private var recvChain: ByteArray?,
    private var sendCount: Int = 0,
    private var recvCount: Int = 0,
    private var prevSendCount: Int = 0,
) {
    private val skipped = HashMap<SkipKey, ByteArray>()

    data class SkipKey(val dh: String, val index: Int)

    /** Ratchet header sent alongside every ciphertext. */
    data class Header(val dhPublic: ByteArray, val prevChainCount: Int, val messageIndex: Int) {
        fun toBytes(): ByteArray {
            val b = java.nio.ByteBuffer.allocate(8 + dhPublic.size)
            b.putInt(prevChainCount); b.putInt(messageIndex); b.put(dhPublic)
            return b.array()
        }
        companion object {
            fun fromBytes(bytes: ByteArray): Header {
                val b = java.nio.ByteBuffer.wrap(bytes)
                val prev = b.int; val idx = b.int
                val dh = ByteArray(b.remaining()); b.get(dh)
                return Header(dh, prev, idx)
            }
        }
    }

    class EncryptedMessage(val header: Header, val ciphertext: ByteArray)

    fun encrypt(plaintext: ByteArray): EncryptedMessage {
        val chain = sendChain ?: error("no sending chain; session not initialized as sender")
        val (nextChain, messageKey) = Kdf.chainStep(chain)
        sendChain = nextChain
        val header = Header(Keys.encodePublic(dhSelf.public), prevSendCount, sendCount)
        sendCount++
        val ct = Aead.seal(messageKey, plaintext, header.toBytes())
        messageKey.fill(0)
        return EncryptedMessage(header, ct)
    }

    fun decrypt(message: EncryptedMessage): ByteArray {
        trySkipped(message)?.let { return it }

        val remoteDh = Keys.decodeX25519Public(message.header.dhPublic)
        if (dhRemote == null || !remoteDh.encoded.contentEquals(dhRemote!!.encoded)) {
            skipMessageKeys(message.header.prevChainCount)
            dhRatchet(remoteDh)
        }
        skipMessageKeys(message.header.messageIndex)

        val chain = recvChain ?: error("no receiving chain")
        val (nextChain, messageKey) = Kdf.chainStep(chain)
        recvChain = nextChain
        recvCount++
        val pt = Aead.open(messageKey, message.ciphertext, message.header.toBytes())
        messageKey.fill(0)
        return pt
    }

    private fun trySkipped(message: EncryptedMessage): ByteArray? {
        val key = SkipKey(message.header.dhPublic.contentToString(), message.header.messageIndex)
        val mk = skipped.remove(key) ?: return null
        return Aead.open(mk, message.ciphertext, message.header.toBytes()).also { mk.fill(0) }
    }

    private fun skipMessageKeys(until: Int) {
        val chain = recvChain ?: return
        if (recvCount + MAX_SKIP < until) error("too many skipped messages")
        var ck = chain
        val dhTag = dhRemote?.let { Keys.encodePublic(it).contentToString() } ?: return
        while (recvCount < until) {
            val (next, mk) = Kdf.chainStep(ck)
            skipped[SkipKey(dhTag, recvCount)] = mk
            ck = next
            recvCount++
        }
        recvChain = ck
    }

    private fun dhRatchet(remoteDh: PublicKey) {
        prevSendCount = sendCount
        sendCount = 0
        recvCount = 0
        dhRemote = remoteDh
        var (newRoot, ck) = Kdf.rootStep(rootKey, Keys.agree(dhSelf.private, remoteDh))
        rootKey = newRoot; recvChain = ck
        dhSelf = Keys.generateX25519()
        val step = Kdf.rootStep(rootKey, Keys.agree(dhSelf.private, remoteDh))
        rootKey = step.first; sendChain = step.second
    }

    companion object {
        private const val MAX_SKIP = 1000

        /** Alice side: she already has Bob's signed prekey as the initial remote DH. */
        fun initSender(sharedRoot: ByteArray, remotePrekey: PublicKey): DoubleRatchet {
            val self = Keys.generateX25519()
            val (root, ck) = Kdf.rootStep(sharedRoot, Keys.agree(self.private, remotePrekey))
            return DoubleRatchet(root, self, remotePrekey, sendChain = ck, recvChain = null)
        }

        /** Bob side: he holds the prekey pair Alice used and waits for her first header. */
        fun initReceiver(sharedRoot: ByteArray, prekeyPair: KeyPair): DoubleRatchet =
            DoubleRatchet(sharedRoot, prekeyPair, dhRemote = null, sendChain = null, recvChain = null)
    }
}
