import Foundation
import CryptoKit

/// Double Ratchet session (Signal spec) built on CryptoKit.
/// - DH ratchet: Curve25519 key agreement -> post-compromise security.
/// - Symmetric ratchet: HKDF-SHA256 chain -> forward secrecy.
/// - AEAD: ChaCha20-Poly1305 (hardware-friendly on iOS).
///
/// State is in-memory only; if persistence is enabled it is sealed with a
/// Secure Enclave key (see `SecureEnclaveKeys`), never written as plaintext.
final class DoubleRatchet {

    private var rootKey: SymmetricKey
    private var selfDH: Curve25519.KeyAgreement.PrivateKey
    private var remoteDH: Curve25519.KeyAgreement.PublicKey?
    private var sendChain: SymmetricKey?
    private var recvChain: SymmetricKey?
    private var sendCount = 0
    private var recvCount = 0
    private var prevSendCount = 0
    private var skipped: [String: SymmetricKey] = [:]

    struct Header {
        let dhPublic: Data
        let prevChainCount: Int
        let messageIndex: Int
        func encoded() -> Data {
            var d = Data()
            var p = UInt32(prevChainCount).bigEndian, i = UInt32(messageIndex).bigEndian
            withUnsafeBytes(of: &p) { d.append(contentsOf: $0) }
            withUnsafeBytes(of: &i) { d.append(contentsOf: $0) }
            d.append(dhPublic)
            return d
        }
    }

    struct EncryptedMessage { let header: Header; let ciphertext: Data }

    private init(root: SymmetricKey, selfDH: Curve25519.KeyAgreement.PrivateKey,
                 remoteDH: Curve25519.KeyAgreement.PublicKey?,
                 sendChain: SymmetricKey?, recvChain: SymmetricKey?) {
        self.rootKey = root; self.selfDH = selfDH; self.remoteDH = remoteDH
        self.sendChain = sendChain; self.recvChain = recvChain
    }

    static func initSender(sharedRoot: SymmetricKey,
                           remotePrekey: Curve25519.KeyAgreement.PublicKey) -> DoubleRatchet {
        let selfDH = Curve25519.KeyAgreement.PrivateKey()
        let dh = try! selfDH.sharedSecretFromKeyAgreement(with: remotePrekey)
        let (root, ck) = KDF.rootStep(root: sharedRoot, dh: dh)
        return DoubleRatchet(root: root, selfDH: selfDH, remoteDH: remotePrekey,
                             sendChain: ck, recvChain: nil)
    }

    static func initReceiver(sharedRoot: SymmetricKey,
                             prekey: Curve25519.KeyAgreement.PrivateKey) -> DoubleRatchet {
        DoubleRatchet(root: sharedRoot, selfDH: prekey, remoteDH: nil,
                      sendChain: nil, recvChain: nil)
    }

    func encrypt(_ plaintext: Data) throws -> EncryptedMessage {
        guard let chain = sendChain else { fatalError("no sending chain") }
        let (next, msgKey) = KDF.chainStep(chain)
        sendChain = next
        let header = Header(dhPublic: selfDH.publicKey.rawRepresentation,
                            prevChainCount: prevSendCount, messageIndex: sendCount)
        sendCount += 1
        let box = try ChaChaPoly.seal(plaintext, using: msgKey, authenticating: header.encoded())
        return EncryptedMessage(header: header, ciphertext: box.combined)
    }

    func decrypt(_ message: EncryptedMessage) throws -> Data {
        let remote = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: message.header.dhPublic)
        if remoteDH == nil || remoteDH!.rawRepresentation != remote.rawRepresentation {
            try dhRatchet(remote)
        }
        guard let chain = recvChain else { fatalError("no receiving chain") }
        let (next, msgKey) = KDF.chainStep(chain)
        recvChain = next; recvCount += 1
        let box = try ChaChaPoly.SealedBox(combined: message.ciphertext)
        return try ChaChaPoly.open(box, using: msgKey, authenticating: message.header.encoded())
    }

    private func dhRatchet(_ remote: Curve25519.KeyAgreement.PublicKey) throws {
        prevSendCount = sendCount; sendCount = 0; recvCount = 0; remoteDH = remote
        let (root, ck) = KDF.rootStep(root: rootKey,
                                      dh: try selfDH.sharedSecretFromKeyAgreement(with: remote))
        rootKey = root; recvChain = ck
        selfDH = Curve25519.KeyAgreement.PrivateKey()
        let step = KDF.rootStep(root: rootKey,
                                dh: try selfDH.sharedSecretFromKeyAgreement(with: remote))
        rootKey = step.0; sendChain = step.1
    }
}
