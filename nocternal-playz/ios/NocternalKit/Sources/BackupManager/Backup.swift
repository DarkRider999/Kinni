import Foundation
import NocternalModel

/// Portable backup, same JSON format as Android (`nocternal-playz-backup`, schema 2), so a backup made on one
/// platform restores on the other. Tracks are matched by artist + title + length, not device IDs.
public struct BackupSnapshot: Codable {
    public var format = BackupManager.format
    public var schemaVersion = BackupManager.schemaVersion
    public var createdAtEpochMs: Int64
    public var appVersion: String
    public var settings: AppSettings
    public var playlists: [PortablePlaylist]
    public var favorites: [String]
    public var history: [PortablePlayEvent]
}
public struct PortablePlaylist: Codable { public var name: String; public var trackKeys: [String]; public var description: String = "" }
public struct PortablePlayEvent: Codable { public var trackKey: String; public var startedAtEpochMs: Int64; public var listenedMs: Int64; public var completed: Bool }

public struct LibraryState {
    public var settings: AppSettings; public var playlists: [Playlist]; public var favorites: Set<String>; public var history: [PlayEvent]
    public init(settings: AppSettings, playlists: [Playlist], favorites: Set<String>, history: [PlayEvent]) {
        self.settings = settings; self.playlists = playlists; self.favorites = favorites; self.history = history
    }
}

public enum BackupError: Error, LocalizedError {
    case notBackup, newerVersion
    public var errorDescription: String? { self == .notBackup ? "Not a Nocternal Playz backup" : "Backup is from a newer app version" }
}

public enum TrackKeys {
    public static func of(_ t: Track) -> String { "\(norm(t.artist))|\(norm(t.title))|\((t.durationMs + 1000) / 2000)" }
    static func norm(_ s: String) -> String {
        var x = s.lowercased()
        x = x.replacingOccurrences(of: #"\(.*?\)|\[.*?\]"#, with: "", options: .regularExpression)
        x = x.replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
        return x.trimmingCharacters(in: .whitespaces)
    }
}

public struct BackupManager {
    public static let format = "nocternal-playz-backup"
    public static let schemaVersion = 2
    let appVersion: String
    public init(appVersion: String) { self.appVersion = appVersion }

    public func export(_ s: LibraryState, tracks: [Track]) throws -> Data {
        let key = Dictionary(tracks.map { ($0.id, TrackKeys.of($0)) }, uniquingKeysWith: { a, _ in a })
        var settings = s.settings; settings.assistantApiKey = nil
        let snap = BackupSnapshot(
            createdAtEpochMs: Int64(Date().timeIntervalSince1970 * 1000), appVersion: appVersion, settings: settings,
            playlists: s.playlists.filter { $0.kind == .user || $0.kind == .ai }.map { PortablePlaylist(name: $0.name, trackKeys: $0.trackIds.compactMap { key[$0] }, description: $0.description) },
            favorites: s.favorites.compactMap { key[$0] }.sorted(),
            history: s.settings.privateMode ? [] : s.history.compactMap { e in key[e.trackId].map { PortablePlayEvent(trackKey: $0, startedAtEpochMs: e.startedAtEpochMs, listenedMs: e.listenedMs, completed: e.completed) } })
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try enc.encode(snap)
    }

    public func restore(_ data: Data, localTracks: [Track], current: LibraryState, merge: Bool) throws -> (LibraryState, unmatched: Int) {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], obj["format"] as? String == BackupManager.format else { throw BackupError.notBackup }
        if (obj["schemaVersion"] as? Int ?? 1) > BackupManager.schemaVersion { throw BackupError.newerVersion }
        let snap = try JSONDecoder().decode(BackupSnapshot.self, from: data)
        var idOf: [String: String] = [:]
        for t in localTracks where idOf[TrackKeys.of(t)] == nil { idOf[TrackKeys.of(t)] = t.id }
        var unmatched = Set<String>()
        func map(_ k: String) -> String? { if let id = idOf[k] { return id }; unmatched.insert(k); return nil }
        let playlists = snap.playlists.map { Playlist(id: "restored_\($0.name.lowercased())", name: $0.name, trackIds: $0.trackKeys.compactMap(map), description: $0.description) }
        let favorites = Set(snap.favorites.compactMap(map))
        let history = snap.history.compactMap { e in map(e.trackKey).map { PlayEvent(trackId: $0, startedAtEpochMs: e.startedAtEpochMs, listenedMs: e.listenedMs, completed: e.completed) } }
        var settings = snap.settings; settings.assistantApiKey = current.settings.assistantApiKey
        let state = merge
            ? LibraryState(settings: current.settings, playlists: current.playlists + playlists.filter { p in !current.playlists.contains { $0.name.lowercased() == p.name.lowercased() } },
                           favorites: current.favorites.union(favorites), history: current.history + history)
            : LibraryState(settings: settings, playlists: playlists, favorites: favorites, history: history)
        return (state, unmatched.count)
    }
}
