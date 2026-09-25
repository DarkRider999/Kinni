import Foundation
import NocternalModel
import ThemeManager

public struct LibrarySnapshot: Sendable {
    public var tracks: [Track]; public var favorites: Set<String>; public var history: [PlayEvent]
    public init(tracks: [Track], favorites: Set<String> = [], history: [PlayEvent] = []) { self.tracks = tracks; self.favorites = favorites; self.history = history }
}

/// Smart playlists (spec §2C): Favorites, Recently Played, Most Played, Recently Added, mood and genre playlists.
public struct SmartPlaylistEngine {
    let detector: GenreDetector
    let moodOf: (Track) -> Mood?
    public init(detector: GenreDetector = GenreDetector(), moodOf: @escaping (Track) -> Mood? = { _ in nil }) { self.detector = detector; self.moodOf = moodOf }

    public static let minCountedPlayMs: Int64 = 30_000
    public static func playCounts(_ h: [PlayEvent]) -> [String: Int] {
        h.filter { $0.completed || $0.listenedMs >= minCountedPlayMs }.reduce(into: [:]) { $0[$1.trackId, default: 0] += 1 }
    }

    public func favorites(_ l: LibrarySnapshot) -> Playlist { smart("smart_favorites", "Favorites", l.tracks.filter { l.favorites.contains($0.id) }.map(\.id), "Songs you liked") }

    public func recentlyPlayed(_ l: LibrarySnapshot, limit: Int = 50) -> Playlist {
        let known = Set(l.tracks.map(\.id)); var seen = Set<String>()
        let ids = l.history.sorted { $0.startedAtEpochMs > $1.startedAtEpochMs }.map(\.trackId).filter { known.contains($0) && seen.insert($0).inserted }
        return smart("smart_recent", "Recently Played", Array(ids.prefix(limit)), "Your latest listens")
    }

    public func mostPlayed(_ l: LibrarySnapshot, limit: Int = 50) -> Playlist {
        let known = Set(l.tracks.map(\.id))
        let ids = SmartPlaylistEngine.playCounts(l.history).filter { known.contains($0.key) }.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.map(\.key)
        return smart("smart_most_played", "Most Played", Array(ids.prefix(limit)), "Your heavy rotation")
    }

    public func moodPlaylist(_ l: LibrarySnapshot, mood: Mood) -> Playlist {
        smart("smart_mood_\(mood.rawValue.lowercased())", "\(mood.label) Mood", l.tracks.filter { (moodOf($0) ?? detector.detect($0)?.genre.defaultMood) == mood }.map(\.id), "Auto-picked for a \(mood.label.lowercased()) mood")
    }

    public func genrePlaylists(_ l: LibrarySnapshot) -> [Playlist] {
        var by: [String: [String]] = [:]
        for t in l.tracks { if let g = detector.detect(t)?.genre { by[g.id, default: []].append(t.id) } }
        return GenreCatalog.all.compactMap { g in by[g.id].map { Playlist(id: "genre_\(g.id)", name: "\(g.emoji) \(g.displayName)", trackIds: $0, kind: .genre, genreId: g.id, description: g.aiSuggestions.first ?? "") } }
    }

    public func all(_ l: LibrarySnapshot) -> [Playlist] {
        [favorites(l), recentlyPlayed(l), mostPlayed(l)] + Mood.allCases.map { moodPlaylist(l, mood: $0) }.filter { !$0.trackIds.isEmpty } + genrePlaylists(l)
    }

    private func smart(_ id: String, _ name: String, _ ids: [String], _ d: String) -> Playlist { Playlist(id: id, name: name, trackIds: ids, kind: .smart, description: d) }
}

/// Folder player tree.
public final class FolderNode: Identifiable {
    public let name: String, path: String
    public private(set) var children: [FolderNode] = []
    public private(set) var trackIds: [String] = []
    init(_ name: String, _ path: String) { self.name = name; self.path = path }
    public var id: String { path }
    public var allTrackIds: [String] { trackIds + children.flatMap(\.allTrackIds) }
    public var totalCount: Int { trackIds.count + children.reduce(0) { $0 + $1.totalCount } }
    public func find(_ p: String) -> FolderNode? { path == p ? self : children.lazy.compactMap { $0.find(p) }.first }

    public static func build(_ tracks: [Track]) -> FolderNode {
        let root = FolderNode("Storage", "")
        for t in tracks.sorted(by: { $0.title.lowercased() < $1.title.lowercased() }) {
            var node = root
            for part in t.folder.split(separator: "/").map(String.init) where !part.isEmpty {
                if let child = node.children.first(where: { $0.name == part }) { node = child } else {
                    let child = FolderNode(part, node.path.isEmpty ? part : node.path + "/" + part)
                    node.children.append(child); node.children.sort { $0.name.lowercased() < $1.name.lowercased() }
                    node = child
                }
            }
            node.trackIds.append(t.id)
        }
        return root
    }
}

/// Playback history grouped by day.
public enum HistoryTimeline {
    public struct Day: Identifiable { public let id: Date; public let label: String; public let events: [PlayEvent] }
    public static func build(_ history: [PlayEvent], calendar: Calendar = .current, now: Date = Date()) -> [Day] {
        let groups = Dictionary(grouping: history) { calendar.startOfDay(for: Date(timeIntervalSince1970: Double($0.startedAtEpochMs) / 1000)) }
        let fmt = DateFormatter(); fmt.dateFormat = "d MMM"
        return groups.keys.sorted(by: >).map { day in
            let label = calendar.isDate(day, inSameDayAs: now) ? "Today"
                : calendar.isDate(day, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now)!) ? "Yesterday" : fmt.string(from: day)
            return Day(id: day, label: label, events: groups[day]!.sorted { $0.startedAtEpochMs > $1.startedAtEpochMs })
        }
    }
}
