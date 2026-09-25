import Foundation
import AVFoundation
import MediaPlayer
import NocternalModel
import Playlists
import FXEngine

/// Local library: imported files (Documents, full FX engine) + the Apple Music library (AVPlayer path),
/// favourites, history and user playlists, persisted as JSON.
final class LibraryStore: ObservableObject {
    struct Data: Codable { var tracks: [Track] = []; var favorites: Set<String> = []; var history: [PlayEvent] = []; var playlists: [Playlist] = [] }
    @Published private(set) var data = Data()
    @Published private(set) var scanning = false
    var privateMode = false

    private let file = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("library.json")
    static let musicDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]

    init() {
        try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let d = try? Foundation.Data(contentsOf: file), let decoded = try? JSONDecoder().decode(Data.self, from: d) { data = decoded }
    }

    var snapshot: LibrarySnapshot { LibrarySnapshot(tracks: data.tracks, favorites: data.favorites, history: data.history) }
    func track(_ id: String) -> Track? { data.tracks.first { $0.id == id } }

    /// Full scan: Documents (incl. folders, for the folder player) and the device music library.
    func rescan() {
        scanning = true
        Task.detached(priority: .utility) { [weak self] in
            var found: [Track] = []
            for url in LibraryStore.audioFiles() { found.append(await LibraryStore.readFile(url)) }
            if MPMediaLibrary.authorizationStatus() == .authorized {
                for item in MPMediaQuery.songs().items ?? [] where item.assetURL != nil && !item.hasProtectedAsset {
                    found.append(Track(id: "ml:\(item.persistentID)", uri: item.assetURL!.absoluteString, title: item.title ?? "Untitled", artist: item.artist ?? "Unknown artist",
                                       album: item.albumTitle ?? "", genreTag: item.genre, durationMs: Int64(item.playbackDuration * 1000),
                                       bpm: item.beatsPerMinute > 0 ? Double(item.beatsPerMinute) : nil, folder: "Apple Music/\(item.albumArtist ?? item.artist ?? "")",
                                       dateAddedEpochMs: Int64(item.dateAdded.timeIntervalSince1970 * 1000), isPodcast: item.mediaType == .podcast))
                }
            }
            await MainActor.run { [found] in
                guard let self else { return }
                let old = Dictionary(self.data.tracks.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
                self.data.tracks = found.map { t in var t = t; if let o = old[t.id] { t.bpm = t.bpm ?? o.bpm; t.energy = o.energy }; return t }
                self.scanning = false
                self.save()
            }
        }
    }

    static func audioFiles() -> [URL] {
        let exts = Set(["mp3", "m4a", "aac", "wav", "flac", "aiff", "caf", "alac", "ogg", "opus"])
        guard let e = FileManager.default.enumerator(at: musicDir, includingPropertiesForKeys: nil) else { return [] }
        return e.allObjects.compactMap { $0 as? URL }.filter { exts.contains($0.pathExtension.lowercased()) }
    }

    static func readFile(_ url: URL) async -> Track {
        let asset = AVURLAsset(url: url)
        let meta = (try? await asset.load(.metadata)) ?? []
        func str(_ id: AVMetadataIdentifier) async -> String? {
            guard let item = AVMetadataItem.metadataItems(from: meta, filteredByIdentifier: id).first else { return nil }
            return try? await item.load(.stringValue)
        }
        var genre: String?
        for item in meta where (item.identifier?.rawValue ?? "").contains("TCON") || (item.identifier?.rawValue ?? "").contains("gen") {
            genre = try? await item.load(.stringValue); if genre != nil { break }
        }
        let duration = (try? await asset.load(.duration)).map { Int64($0.seconds * 1000) } ?? 0
        let rel = url.deletingLastPathComponent().path.replacingOccurrences(of: musicDir.path, with: "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let title = await str(.commonIdentifierTitle) ?? url.deletingPathExtension().lastPathComponent
        let artist = await str(.commonIdentifierArtist) ?? "Unknown artist"
        let album = await str(.commonIdentifierAlbumName) ?? ""
        let relPath = url.path.replacingOccurrences(of: musicDir.path, with: "")
        return Track(id: "file:\(relPath)", uri: url.absoluteString, title: title, artist: artist, album: album,
                     genreTag: genre, durationMs: duration, folder: rel.isEmpty ? "Imported" : "Imported/\(rel)", dateAddedEpochMs: Int64(Date().timeIntervalSince1970 * 1000))
    }

    /// Estimates BPM for imported files that have none (first 30 s from the middle of the track).
    func analyzeMissingBpm() {
        let todo = data.tracks.filter { $0.bpm == nil && URL(string: $0.uri)?.isFileURL == true }
        Task.detached(priority: .background) { [weak self] in
            for t in todo {
                guard let url = URL(string: t.uri), let f = try? AVAudioFile(forReading: url) else { continue }
                let rate = f.processingFormat.sampleRate
                let count = AVAudioFrameCount(min(Double(f.length), rate * 30))
                f.framePosition = max(0, f.length / 3)
                guard let buf = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: count), (try? f.read(into: buf)) != nil, let ch = buf.floatChannelData else { continue }
                let mono = (0..<Int(buf.frameLength)).map { i in (0..<Int(buf.format.channelCount)).reduce(Float(0)) { $0 + ch[$1][i] } / Float(buf.format.channelCount) }
                guard let bpm = BpmDetector.detect(mono, sampleRate: rate) else { continue }
                await MainActor.run { self?.setBpm(t.id, bpm) }
            }
            await MainActor.run { self?.save() }
        }
    }

    private func setBpm(_ id: String, _ bpm: Double) { if let i = data.tracks.firstIndex(where: { $0.id == id }) { data.tracks[i].bpm = (bpm * 10).rounded() / 10 } }

    func toggleFavorite(_ id: String) { if data.favorites.contains(id) { data.favorites.remove(id) } else { data.favorites.insert(id) }; save() }
    func record(_ e: PlayEvent) { guard !privateMode, !e.trackId.hasPrefix("stream:") else { return }; data.history.append(e); if data.history.count > 5000 { data.history.removeFirst(data.history.count - 5000) }; save() }
    func clearHistory() { data.history = []; save() }
    func replace(favorites: Set<String>, history: [PlayEvent], playlists: [Playlist]) { data.favorites = favorites; data.history = history; data.playlists = playlists; save() }

    func importFiles(_ urls: [URL]) {
        for u in urls {
            let access = u.startAccessingSecurityScopedResource(); defer { if access { u.stopAccessingSecurityScopedResource() } }
            try? FileManager.default.copyItem(at: u, to: LibraryStore.musicDir.appendingPathComponent(u.lastPathComponent))
        }
        rescan()
    }

    func save() { if let d = try? JSONEncoder().encode(data) { try? d.write(to: file, options: .atomic) } }
}
