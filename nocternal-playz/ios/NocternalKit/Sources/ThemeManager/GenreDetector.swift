import Foundation
import NocternalModel

public struct GenreMatch: Sendable {
    public let genre: GenreDefinition
    public let confidence: Double
    public let reason: String
}

/// Same detection rules as Kotlin `GenreDetector`: tag → keywords (whole words, earliest wins) → podcast → tempo/energy.
public struct GenreDetector: Sendable {
    private let aliases: [(String, GenreDefinition)]
    public init(genres: [GenreDefinition] = GenreCatalog.all) {
        aliases = genres.flatMap { g in g.aliases.map { ($0, g) } }
    }

    public func detect(_ t: Track) -> GenreMatch? {
        if let tag = t.genreTag?.lowercased(), let m = match(tag) {
            return GenreMatch(genre: m.1, confidence: 0.95, reason: "genre tag “\(t.genreTag ?? "")” matches “\(m.0)”")
        }
        if t.isPodcast { return GenreMatch(genre: GenreCatalog.podcastMode, confidence: 0.9, reason: "podcast episode") }
        let text = [t.folder, t.title, t.album, t.artist].joined(separator: " | ").lowercased()
        if let m = match(text) { return GenreMatch(genre: m.1, confidence: 0.75, reason: "keyword “\(m.0)” in title/folder/artist") }
        guard let bpm = t.bpm else { return nil }
        let e = t.energy ?? 0.5
        let g: GenreDefinition?
        switch true {
        case bpm >= 165 && e > 0.6: g = GenreCatalog.workout
        case (136...150).contains(bpm) && e > 0.6: g = GenreCatalog.trance
        case (122...136).contains(bpm) && e > 0.7: g = GenreCatalog.edm
        case (118...135).contains(bpm) && e > 0.55: g = GenreCatalog.partyMix
        case bpm < 70 && e < 0.3: g = GenreCatalog.sleep
        case bpm < 90 && e < 0.45: g = GenreCatalog.chillout
        default: g = nil
        }
        return g.map { GenreMatch(genre: $0, confidence: 0.45, reason: "tempo \(Int(bpm)) BPM, energy \(Int(e * 100))%") }
    }

    public func forMood(_ mood: Mood, hour: Int? = nil) -> GenreDefinition {
        switch mood {
        case .calm: return (hour ?? 0) >= 21 ? GenreCatalog.ambient : GenreCatalog.chillout
        case .energetic: return GenreCatalog.edm
        case .happy: return GenreCatalog.morningVibes
        case .melancholic: return GenreCatalog.lofi
        case .romantic: return GenreCatalog.romantic
        case .focused: return GenreCatalog.focus
        case .spiritual: return GenreCatalog.devotional
        case .sleepy: return GenreCatalog.sleep
        case .party: return GenreCatalog.partyMix
        }
    }

    private func match(_ text: String) -> (String, GenreDefinition)? {
        var best: (Int, String, GenreDefinition)?
        for (alias, g) in aliases {
            guard let i = wordIndex(text, alias) else { continue }
            if best == nil || i < best!.0 || (i == best!.0 && alias.count > best!.1.count) { best = (i, alias, g) }
        }
        return best.map { ($0.1, $0.2) }
    }

    private func wordIndex(_ text: String, _ alias: String) -> Int? {
        let chars = Array(text), a = Array(alias)
        guard a.count <= chars.count else { return nil }
        var i = 0
        while i + a.count <= chars.count {
            if Array(chars[i..<(i + a.count)]) == a {
                let before: Character = i == 0 ? " " : chars[i - 1]
                let after: Character = i + a.count >= chars.count ? " " : chars[i + a.count]
                if !(before.isLetter || before.isNumber) && !after.isLetter { return i }
            }
            i += 1
        }
        return nil
    }
}

public enum TimeOfDayThemes {
    public static func genreForHour(_ hour: Int) -> GenreDefinition {
        switch ((hour % 24) + 24) % 24 {
        case 5...8: return GenreCatalog.morningVibes
        case 9...16: return GenreCatalog.focus
        case 17...20: return GenreCatalog.chillout
        case 21...23: return GenreCatalog.nightDrive
        default: return GenreCatalog.sleep
        }
    }
}
