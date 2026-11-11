import Foundation
import CryptoKit

/// HKDF-SHA256 helpers for the Double Ratchet. Distinct info constants separate
/// the message key from the next chain key (KDF_CK) and derive fresh chain keys
/// from the root on each DH ratchet (KDF_RK).
enum KDF {

    static func chainStep(_ chainKey: SymmetricKey) -> (SymmetricKey, SymmetricKey) {
        let msg = HMAC<SHA256>.authenticationCode(for: Data([0x01]), using: chainKey)
        let next = HMAC<SHA256>.authenticationCode(for: Data([0x02]), using: chainKey)
        return (SymmetricKey(data: Data(next)), SymmetricKey(data: Data(msg)))
    }

    static func rootStep(root: SymmetricKey, dh: SharedSecret) -> (SymmetricKey, SymmetricKey) {
        let derived = dh.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: root.withUnsafeBytes { Data($0) },
            sharedInfo: Data("SubZero-Ratchet".utf8),
            outputByteCount: 64
        )
        let bytes = derived.withUnsafeBytes { Data($0) }
        let newRoot = SymmetricKey(data: bytes.prefix(32))
        let chain = SymmetricKey(data: bytes.suffix(32))
        return (newRoot, chain)
    }
}
