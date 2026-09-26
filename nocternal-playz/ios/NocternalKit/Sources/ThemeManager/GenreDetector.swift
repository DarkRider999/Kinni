import Foundation
import NocternalModel

public struct GenreMatch: Sendable {
    public let genre: GenreDefinition
    public let confidence: Double
    public let reason: String
}

/// Same detection rules as Kotlin `GenreDetector`: tag (aliases, then store tag families) → folder → specific
/// words in title/artist → podcast → tempo/energy. Text is normalised ("Hip-Hop/Rap" → "hip hop rap").
public struct GenreDetector: Sendable {
    private let aliases: [(String, GenreDefinition)]
    private let strong: [(String, GenreDefinition)]

    public static let genericWords: Set<String> = [
        "rain", "love", "chill", "dance", "party", "morning", "focus", "study", "sleep", "gym", "fitness", "running", "cardio",
        "motivation", "coding", "zen", "trap", "soul", "ballad", "romance", "romantic", "club", "feel good", "coffee", "sunrise",
        "acoustic", "folk", "guitar", "piano", "flute", "score", "episode", "news", "talk", "speech", "interview", "thunder",
        "house", "minimal", "acid", "industrial", "drone", "bedroom", "deep work", "concentration", "productivity", "evergreen",
        "disco", "slow jam", "healing", "yoga", "mindful", "lullaby", "ocean waves", "night sounds", "uplifting", "space music",
        "soundscape", "sitar", "retro bollywood", "golden era", "rap", "hip hop", "chillout", "chill out", "downtempo", "lounge",
    ]
    static let meaningless: Set<String> = ["other", "unknown", "misc", "miscellaneous", "genre", "none", "general", "various", "music", "<unknown>"]

    public init(genres: [GenreDefinition] = GenreCatalog.all) {
        var seen = Set<String>(), list: [(String, GenreDefinition)] = []
        for g in genres { for a in g.aliases { let n = GenreDetector.normalize(a); if seen.insert(n + "|" + g.id).inserted { list.append((n, g)) } } }
        aliases = list
        strong = list.filter { !GenreDetector.genericWords.contains($0.0) }
    }

    public static func normalize(_ s: String) -> String {
        s.lowercased().replacingOccurrences(of: #"[-_/\\.,;:+]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    }

    public func detect(_ t: Track) -> GenreMatch? {
        if let raw = t.genreTag {
            let tag = GenreDetector.normalize(raw)
            if !tag.isEmpty && !GenreDetector.meaningless.contains(tag) {
                if let m = match(tag, aliases) { return GenreMatch(genre: m.1, confidence: 0.95, reason: "genre tag “\(raw)”") }
                if let g = family(tag, t) { return GenreMatch(genre: g, confidence: 0.8, reason: "genre tag “\(raw)”") }
            }
        }
        if t.isPodcast { return GenreMatch(genre: GenreCatalog.podcastMode, confidence: 0.9, reason: "podcast episode") }
        if let m = match(GenreDetector.normalize(t.folder), aliases) { return GenreMatch(genre: m.1, confidence: 0.8, reason: "folder “\(t.folder)”") }
        let text = GenreDetector.normalize([t.title, t.album, t.artist].joined(separator: " | "))
        if let m = match(text, strong) { return GenreMatch(genre: m.1, confidence: 0.7, reason: "“\(m.0)” in title/artist") }
        return byTempo(t)
    }

    private func family(_ tag: String, _ t: Track) -> GenreDefinition? {
        let e = t.energy ?? 0.5, bpm = t.bpm ?? 0
        func has(_ w: String...) -> Bool { w.contains { wordIndex(tag, $0) != nil } }
        if has("bollywood", "hindi", "filmi", "indian", "desi", "tamil", "telugu", "kannada", "malayalam", "marathi", "bengali", "bhojpuri", "gujarati", "tollywood", "kollywood") {
            if (t.year ?? 3000) < 2000 { return GenreCatalog.hindiClassics }
            return e > 0.65 || bpm >= 118 ? GenreCatalog.partyMix : GenreCatalog.romantic
        }
        if has("punjabi", "bhangra", "haryanvi") { return GenreCatalog.partyMix }
        if has("rock", "metal", "punk", "grunge", "alternative", "hardcore") { return GenreCatalog.workout }
        if has("electronic", "electronica", "electro", "dance", "club", "idm") { return e < 0.4 ? GenreCatalog.chillout : GenreCatalog.edm }
        if has("jazz", "blues", "bossa", "swing", "reggae", "easy listening") { return GenreCatalog.chillout }
        if has("classical", "ost", "film score", "orchestra", "opera", "baroque") { return GenreCatalog.instrumental }
        if has("country", "singer songwriter", "americana", "bluegrass") { return GenreCatalog.morningVibes }
        if has("k pop", "kpop", "j pop", "latin", "world", "afrobeat", "afrobeats") { return GenreCatalog.partyMix }
        if has("pop", "indie", "top 40") { return e > 0.6 || bpm >= 118 ? GenreCatalog.partyMix : GenreCatalog.morningVibes }
        if has("new age", "relaxation", "nature") { return GenreCatalog.meditation }
        if has("audiobook", "spoken", "comedy", "radio show") { return GenreCatalog.podcastMode }
        return nil
    }

    private func byTempo(_ t: Track) -> GenreMatch? {
        guard t.bpm != nil || t.energy != nil else { return nil }
        let e = t.energy ?? 0.5, b = t.bpm ?? 100
        let g: GenreDefinition
        switch true {
        case b >= 165 && e > 0.6: g = GenreCatalog.workout
        case (136...150).contains(b) && e > 0.6: g = GenreCatalog.trance
        case (122...136).contains(b) && e > 0.7: g = GenreCatalog.edm
        case (118...135).contains(b) && e > 0.55: g = GenreCatalog.partyMix
        case b < 70 && e < 0.3: g = GenreCatalog.sleep
        case b < 90 && e < 0.45: g = GenreCatalog.chillout
        case e >= 0.7: g = b > 140 ? GenreCatalog.workout : GenreCatalog.partyMix
        case e < 0.3: g = GenreCatalog.ambient
        case b < 100: g = GenreCatalog.lofi
        default: g = GenreCatalog.morningVibes
        }
        return GenreMatch(genre: g, confidence: 0.4, reason: "tempo \(Int(b)) BPM, energy \(Int(e * 100))%")
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

    private func match(_ text: String, _ index: [(String, GenreDefinition)]) -> (String, GenreDefinition)? {
        var best: (Int, String, GenreDefinition)?
        for (alias, g) in index {
            guard let i = wordIndex(text, alias) else { continue }
            if best == nil || i < best!.0 || (i == best!.0 && alias.count > best!.1.count) { best = (i, alias, g) }
        }
        return best.map { ($0.1, $0.2) }
    }

    private func wordIndex(_ text: String, _ alias: String) -> Int? {
        let chars = Array(text), a = Array(alias)
        guard !a.isEmpty, a.count <= chars.count else { return nil }
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
