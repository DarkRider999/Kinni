import Foundation
import CryptoKit
import Security

/// One item in the vault; `id` names the on-disk encrypted blob.
struct VaultItem: Identifiable, Codable {
    let id: String
    let name: String
    let mime: String
    let sizeBytes: Int
    let addedAt: Date
    var isImage: Bool { mime.hasPrefix("image/") }
    var isVideo: Bool { mime.hasPrefix("video/") }
}

/// Encrypted media vault. Files live in the app's sandbox (Application Support),
/// which iOS already isolates from the Photos library and other apps, and each
/// blob is additionally AES-GCM encrypted with a Keychain-held key. Importing a
/// photo copies it in encrypted — it is never written back to the camera roll.
final class VaultStore: ObservableObject {
    @Published private(set) var items: [VaultItem] = []

    private let key: SymmetricKey
    private let dir: URL
    private let indexURL: URL

    init() {
        key = VaultStore.loadOrCreateKey()
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        dir = base.appendingPathComponent("vault", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        indexURL = dir.appendingPathComponent("index.bin")
        loadIndex()
    }

    func add(_ data: Data, name: String, mime: String) {
        let id = UUID().uuidString
        guard let sealed = try? AES.GCM.seal(data, using: key).combined else { return }
        try? sealed.write(to: dir.appendingPathComponent("\(id).bin"))
        items.insert(VaultItem(id: id, name: name, mime: mime, sizeBytes: data.count, addedAt: Date()), at: 0)
        persistIndex()
    }

    func open(_ id: String) -> Data? {
        let url = dir.appendingPathComponent("\(id).bin")
        guard let blob = try? Data(contentsOf: url),
              let box = try? AES.GCM.SealedBox(combined: blob),
              let clear = try? AES.GCM.open(box, using: key) else { return nil }
        return clear
    }

    func delete(_ id: String) {
        try? FileManager.default.removeItem(at: dir.appendingPathComponent("\(id).bin"))
        items.removeAll { $0.id == id }
        persistIndex()
    }

    func wipeAll() {
        items.forEach { try? FileManager.default.removeItem(at: dir.appendingPathComponent("\($0.id).bin")) }
        items.removeAll()
        persistIndex()
    }

    // MARK: - index

    private func persistIndex() {
        guard let json = try? JSONEncoder().encode(items),
              let sealed = try? AES.GCM.seal(json, using: key).combined else { return }
        try? sealed.write(to: indexURL)
    }

    private func loadIndex() {
        guard let blob = try? Data(contentsOf: indexURL),
              let box = try? AES.GCM.SealedBox(combined: blob),
              let clear = try? AES.GCM.open(box, using: key),
              let decoded = try? JSONDecoder().decode([VaultItem].self, from: clear) else { return }
        items = decoded
    }

    // MARK: - Keychain-held key

    private static func loadOrCreateKey() -> SymmetricKey {
        let tag = "com.subzero.messenger.vaultkey"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tag,
            kSecReturnData as String: true,
        ]
        var out: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data {
            return SymmetricKey(data: data)
        }
        let fresh = SymmetricKey(size: .bits256)
        let raw = fresh.withUnsafeBytes { Data($0) }
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tag,
            kSecValueData as String: raw,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(add as CFDictionary, nil)
        return fresh
    }
}
