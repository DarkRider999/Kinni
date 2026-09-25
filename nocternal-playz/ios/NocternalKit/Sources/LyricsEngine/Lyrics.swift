import Foundation
import NocternalModel

public struct KaraokeWord: Codable, Hashable, Sendable { public let startMs: Int64; public let text: String }
public struct LyricsLine: Codable, Hashable, Sendable {
    public let startMs: Int64; public let text: String; public let words: [KaraokeWord]
    public init(startMs: Int64, text: String, words: [KaraokeWord] = []) { self.startMs = startMs; self.text = text; self.words = words }
}
public enum LyricsOrigin: String, Codable, Sendable { case embedded, sidecar, online, cache }
public struct Lyrics: Codable, Hashable, Sendable {
    public let lines: [LyricsLine]; public let synced: Bool; public let origin: LyricsOrigin; public let offsetMs: Int64
}
public struct LyricsPosition: Sendable { public let line: Int; public let word: Int; public let wordProgress: Double }

/// LRC / enhanced-LRC parser, same grammar as the Kotlin `LrcParser`.
public enum LrcParser {
    static let timeTag = try! NSRegularExpression(pattern: #"^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]"#)
    static let wordTag = try! NSRegularExpression(pattern: #"<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>"#)
    static let metaTag = try! NSRegularExpression(pattern: #"^\[([a-zA-Z#]+):(.*)\]$"#)

    public static func parse(_ text: String, origin: LyricsOrigin) -> Lyrics {
        var offset: Int64 = 0
        var lines: [LyricsLine] = [], plain: [String] = []
        for raw in text.components(separatedBy: .newlines) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }
            let ns = line as NSString
            if let m = metaTag.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) {
                if ns.substring(with: m.range(at: 1)).lowercased() == "offset" { offset = Int64(ns.substring(with: m.range(at: 2)).trimmingCharacters(in: .whitespaces)) ?? 0 }
                continue
            }
            var rest = line, stamps: [Int64] = []
            while let m = timeTag.firstMatch(in: rest, range: NSRange(location: 0, length: (rest as NSString).length)) {
                stamps.append(ms(m, in: rest))
                rest = (rest as NSString).substring(from: m.range.upperBound)
            }
            if stamps.isEmpty { plain.append(line); continue }
            let words = parseWords(rest)
            let clean = wordTag.stringByReplacingMatches(in: rest, range: NSRange(location: 0, length: (rest as NSString).length), withTemplate: "")
                .split(whereSeparator: { $0 == " " }).joined(separator: " ")
            stamps.forEach { lines.append(LyricsLine(startMs: $0, text: clean, words: words)) }
        }
        if !lines.isEmpty { return Lyrics(lines: lines.sorted { $0.startMs < $1.startMs }, synced: true, origin: origin, offsetMs: offset) }
        return Lyrics(lines: plain.map { LyricsLine(startMs: 0, text: $0) }, synced: false, origin: origin, offsetMs: 0)
    }

    static func parseWords(_ s: String) -> [KaraokeWord] {
        let ns = s as NSString
        let matches = wordTag.matches(in: s, range: NSRange(location: 0, length: ns.length))
        return matches.enumerated().compactMap { i, m in
            let end = i + 1 < matches.count ? matches[i + 1].range.location : ns.length
            let w = ns.substring(with: NSRange(location: m.range.upperBound, length: end - m.range.upperBound)).trimmingCharacters(in: .whitespaces)
            return w.isEmpty ? nil : KaraokeWord(startMs: ms(m, in: s), text: w)
        }
    }

    static func ms(_ m: NSTextCheckingResult, in s: String) -> Int64 {
        let ns = s as NSString
        let min = Int64(ns.substring(with: m.range(at: 1))) ?? 0, sec = Int64(ns.substring(with: m.range(at: 2))) ?? 0
        var frac: Int64 = 0
        if m.range(at: 3).location != NSNotFound {
            let f = ns.substring(with: m.range(at: 3))
            frac = f.count == 1 ? (Int64(f) ?? 0) * 100 : f.count == 2 ? (Int64(f) ?? 0) * 10 : Int64(f.prefix(3)) ?? 0
        }
        return (min * 60 + sec) * 1000 + frac
    }

    public static func position(_ l: Lyrics, at positionMs: Int64) -> LyricsPosition {
        guard l.synced, !l.lines.isEmpty else { return LyricsPosition(line: -1, word: -1, wordProgress: 0) }
        let pos = positionMs + l.offsetMs
        guard let idx = l.lines.lastIndex(where: { $0.startMs <= pos }) else { return LyricsPosition(line: -1, word: -1, wordProgress: 0) }
        let line = l.lines[idx]
        let end = idx + 1 < l.lines.count ? l.lines[idx + 1].startMs : line.startMs + 5000
        guard let w = line.words.lastIndex(where: { $0.startMs <= pos }) else { return LyricsPosition(line: idx, word: -1, wordProgress: 0) }
        let wEnd = w + 1 < line.words.count ? line.words[w + 1].startMs : end
        return LyricsPosition(line: idx, word: w, wordProgress: min(max(Double(pos - line.words[w].startMs) / Double(max(wEnd - line.words[w].startMs, 1)), 0), 1))
    }
}

/// LRCLIB online lyrics (free, keyless), with an on-disk cache for offline use.
public final class LyricsRepository {
    private let cacheDir: URL
    public init(cacheDir: URL) { self.cacheDir = cacheDir; try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true) }

    private func file(_ id: String) -> URL { cacheDir.appendingPathComponent(id.replacingOccurrences(of: "/", with: "_") + ".lrc") }

    public func lyrics(for t: Track, onlineAllowed: Bool) async -> Lyrics? {
        if let cached = try? String(contentsOf: file(t.id), encoding: .utf8) { return LrcParser.parse(cached, origin: .cache) }
        if let sidecar = sidecarText(t) { return LrcParser.parse(sidecar, origin: .sidecar) }
        guard onlineAllowed else { return nil }
        var c = URLComponents(string: "https://lrclib.net/api/get")!
        c.queryItems = [URLQueryItem(name: "track_name", value: t.title), URLQueryItem(name: "artist_name", value: t.artist)]
            + (t.album.isEmpty ? [] : [URLQueryItem(name: "album_name", value: t.album)])
            + (t.durationMs > 0 ? [URLQueryItem(name: "duration", value: String(t.durationMs / 1000))] : [])
        guard let url = c.url, let (data, resp) = try? await URLSession.shared.data(from: url), (resp as? HTTPURLResponse)?.statusCode == 200,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let text = (obj["syncedLyrics"] as? String) ?? (obj["plainLyrics"] as? String), !text.isEmpty else { return nil }
        try? text.write(to: file(t.id), atomically: true, encoding: .utf8)
        return LrcParser.parse(text, origin: .online)
    }

    private func sidecarText(_ t: Track) -> String? {
        guard let url = URL(string: t.uri), url.isFileURL else { return nil }
        return try? String(contentsOf: url.deletingPathExtension().appendingPathExtension("lrc"), encoding: .utf8)
    }
}
