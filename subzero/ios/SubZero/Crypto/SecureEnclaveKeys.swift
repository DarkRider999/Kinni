import Foundation
import CryptoKit
import LocalAuthentication

/// Long-term identity key stored in the Secure Enclave. The private key never
/// leaves hardware; signing/agreement happen inside the enclave, gated by
/// biometrics via the access control flags.
///
/// Note: the Secure Enclave supports P-256 (not Curve25519), so identity/
/// authentication uses P-256 here while the ephemeral ratchet keys use
/// Curve25519 in software. This mirrors how production apps split the two.
enum SecureEnclaveKeys {

    static func identityKey(requireBiometric: Bool = true) throws -> SecureEnclave.P256.Signing.PrivateKey {
        var flags: SecAccessControlCreateFlags = [.privateKeyUsage]
        if requireBiometric { flags.insert(.biometryCurrentSet) }
        let access = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, flags, nil
        )!
        return try SecureEnclave.P256.Signing.PrivateKey(accessControl: access)
    }

    static func isAvailable() -> Bool { SecureEnclave.isAvailable }
}
