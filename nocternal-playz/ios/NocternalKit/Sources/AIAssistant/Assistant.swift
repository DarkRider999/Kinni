import Foundation
import NocternalModel
import ThemeManager
import Playlists
import AutoMixEngine
import FXEngine

public enum TransportCommand: String, Sendable { case play, pause, next, previous, shuffle, repeatMode, volumeUp, volumeDown, like }

public enum AssistantIntent: Equatable, Sendable {
    case playGenre(String), playMood(Mood), playSearch(String, AudioSource)
    case suggestPlaylist(genreId: String?, mood: Mood?, bpmMin: Double?, bpmMax: Double?)
    case adjustBass(up: Bool), recommendEq, activateTheme(String), switchSource(AudioSource)
    case sleepTimer(minutes: Int), transport(TransportCommand), enhance(EnhancerMode), vocalRemover(on: Bool)
    case explain(String), identifySong, generateArt, autoMix, unknown(String)
}

public enum AssistantAction: Sendable {
    case playQueue(Playlist, genreId: String?)
    case search(String, AudioSource)
    case setEq(EqPreset)
    case changeBass(Double)
    case applyGenreTheme(String)
    case switchSource(AudioSource)
    case setSleepTimer(Int)
    case transport(TransportCommand)
    case enhance(EnhancerMode)
    case setVocalRemover(Float)
    case startRecognition
    case showAlbumArt(NeonArtSpec)
    case enableAutoMix(Bool)
}

public struct AssistantResponse: Sendable {
    public let reply: String
    public let actions: [AssistantAction]
    public let suggestions: [String]
    public let fromLLM: Bool
    public init(_ reply: String, _ actions: [AssistantAction] = [], suggestions: [String] = [], fromLLM: Bool = false) {
        self.reply = reply; self.actions = actions; self.suggestions = suggestions; self.fromLLM = fromLLM
    }
}

public enum OutputRoute: String, Sendable { case speaker, wired, bluetooth }

public struct AssistantContext: Sendable {
    public var tracks: [Track] = [], favorites: Set<String> = [], history: [PlayEvent] = []
    public var nowPlaying: Track? = nil, hour = 12, source: AudioSource = .local, route: OutputRoute = .speaker, privateMode = false
    public init() {}
}

/// On-device command parsing (same vocabulary as Android's `CommandParser`).
public enum CommandParser {
    static let playVerbs = ["play", "put on", "start", "queue", "bajao", "chalao", "listen to", "i want"]
    static let genreWords: [(String, String)] = GenreCatalog.all
        .flatMap { g in ([g.displayName.lowercased(), g.id.replacingOccurrences(of: "_", with: " ")] + g.aliases).map { ($0, g.id) } }
        .sorted { $0.0.count > $1.0.count }
    static let moodWords: [(String, Mood)] = [("calm", .calm), ("relax", .calm), ("chill", .calm), ("energetic", .energetic), ("energy", .energetic), ("hype", .energetic),
        ("happy", .happy), ("upbeat", .happy), ("sad", .melancholic), ("romantic", .romantic), ("love", .romantic), ("focus", .focused), ("study", .focused),
        ("spiritual", .spiritual), ("sleepy", .sleepy), ("tired", .sleepy), ("party", .party), ("dance", .party)]

    public static func parse(_ input: String) -> AssistantIntent {
        var t = input.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        while let l = t.last, ".!?".contains(l) { t.removeLast() }
        if t.isEmpty { return .unknown(input) }
        if let cmd = transport(t) { return .transport(cmd) }
        if let m = sleepMinutes(t) { return .sleepTimer(minutes: m) }
        if has(t, "what song", "what's this song", "identify", "recognize", "shazam") { return .identifySong }
        if has(t, "album art", "cover art", "artwork") { return .generateArt }
        if has(t, "auto mix", "automix", "dj mode") { return .autoMix }
        if has(t, "vocal remover", "remove vocal", "karaoke") { return .vocalRemover(on: !has(t, "off", "disable")) }
        if let e = enhancer(t) { return .enhance(e) }
        if has(t, "bass") {
            if has(t, "boost", "more", "increase", "up", "pump") { return .adjustBass(up: true) }
            if has(t, "less", "reduce", "decrease", "down", "cut") { return .adjustBass(up: false) }
        }
        if has(t, "eq", "equalizer", "optimize sound") && has(t, "recommend", "suggest", "optimize", "optimise", "best", "which") { return .recommendEq }
        if has(t, "theme", "vibe", "lighting"), let g = genre(t) { return .activateTheme(g) }
        if let src = source(t), has(t, "switch", "go to", "open", "change to") { return .switchSource(src) }
        if has(t, "explain", "what is", "how does", "tell me about"), let topic = FeatureExplainer.topic(for: t) { return .explain(topic) }
        let bpm = bpmRange(t)
        if has(t, "suggest", "recommend", "make me", "create", "generate") && has(t, "playlist", "mix", "songs") {
            return .suggestPlaylist(genreId: genre(t), mood: mood(t), bpmMin: bpm?.0, bpmMax: bpm?.1)
        }
        if playVerbs.contains(where: { t.hasPrefix($0) || t.contains(" \($0) ") }) || t.hasSuffix("bajao") {
            if let g = genre(t) { return .playGenre(g) }
            if let m = mood(t) { return .playMood(m) }
            if let b = bpm { return .suggestPlaylist(genreId: nil, mood: nil, bpmMin: b.0, bpmMax: b.1) }
            var q = t
            for v in playVerbs { q = q.replacingOccurrences(of: v, with: " ") }
            q = q.split(separator: " ").filter { !["some", "me", "the", "a", "song", "songs", "by", "please"].contains(String($0)) }.joined(separator: " ")
            if let src = source(t), src != .local { return .playSearch(q.replacingOccurrences(of: "youtube", with: "").replacingOccurrences(of: "radio", with: "").trimmingCharacters(in: .whitespaces), src) }
            return q.isEmpty || q == "music" || q == "something" ? .transport(.play) : .playSearch(q, .local)
        }
        return .unknown(input)
    }

    public static func genre(_ t: String) -> String? {
        genreWords.first { w, _ in t.range(of: "(^|[^a-z])\(NSRegularExpression.escapedPattern(for: w))([^a-z]|$)", options: .regularExpression) != nil }?.1
    }
    public static func mood(_ t: String) -> Mood? { moodWords.first { t.range(of: "\\b\($0.0)\\b", options: .regularExpression) != nil }?.1 }
    static func has(_ t: String, _ words: String...) -> Bool { words.contains { t.contains($0) } }
    static func transport(_ t: String) -> TransportCommand? {
        switch t {
        case "pause", "stop", "pause music": return .pause
        case "play", "resume", "continue": return .play
        case "next", "skip", "next song": return .next
        case "previous", "back", "previous song": return .previous
        case "shuffle": return .shuffle
        case "repeat": return .repeatMode
        case "volume up", "louder": return .volumeUp
        case "volume down", "quieter": return .volumeDown
        case "like", "like this", "add to favorites": return .like
        default: return nil
        }
    }
    static func sleepMinutes(_ t: String) -> Int? {
        guard has(t, "sleep", "timer", "stop after", "stop in") else { return nil }
        if let m = t.range(of: #"(\d+)\s*(h|hr|hour|hours)\b"#, options: .regularExpression) { return (Int(t[m].prefix { $0.isNumber }) ?? 1) * 60 }
        if let m = t.range(of: #"(\d+)\s*(m|min|mins|minute|minutes)\b"#, options: .regularExpression) { return Int(t[m].prefix { $0.isNumber }) }
        return has(t, "timer") ? 30 : nil
    }
    static func enhancer(_ t: String) -> EnhancerMode? {
        guard has(t, "enhance", "clarity", "noise", "restore", "vocal focus", "improve") else { return nil }
        if has(t, "noise", "hiss") { return .noiseRemoval }
        if has(t, "bass") { return .bassEnhancement }
        if has(t, "old", "restore") { return .oldRecording }
        if has(t, "vocal", "voice") { return .vocalFocus }
        return .clarity
    }
    static func source(_ t: String) -> AudioSource? {
        if has(t, "youtube") { return .youtube }
        if has(t, "radio", " fm", "station") { return .radio }
        if has(t, "local", "my music", "library") { return .local }
        return nil
    }
    static func bpmRange(_ t: String) -> (Double, Double)? {
        guard let r = t.range(of: #"(\d{2,3})\s*bpm"#, options: .regularExpression), let b = Double(t[r].prefix { $0.isNumber }) else { return nil }
        return (b - 5, b + 5)
    }
}

public struct MoodEstimate: Sendable { public let mood: Mood; public let confidence: Double; public let reason: String }

/// Transparent mood scoring from genre, tempo, energy, key mode and time (same model as Android).
public struct MoodDetector: Sendable {
    let genres: GenreDetector
    public init(genres: GenreDetector = GenreDetector()) { self.genres = genres }
    public func detect(_ t: Track, hour: Int? = nil) -> MoodEstimate? {
        var s: [Mood: Double] = [:], why: [String] = []
        if let g = genres.detect(t) { s[g.genre.defaultMood, default: 0] += 1.2 * g.confidence; why.append(g.genre.displayName) }
        if let e = t.energy {
            if e > 0.75 { s[.energetic, default: 0] += 0.8; s[.party, default: 0] += 0.5; why.append("high energy") }
            else if e < 0.3 { s[.calm, default: 0] += 0.6; s[.sleepy, default: 0] += 0.4; why.append("low energy") }
            else { s[.focused, default: 0] += 0.2 }
        }
        if let bpm = t.bpm { if bpm >= 124 { s[.party, default: 0] += 0.4; s[.energetic, default: 0] += 0.4 } else if bpm < 80 { s[.calm, default: 0] += 0.4 } }
        if let minor = t.camelotKey.flatMap(MusicalKey.fromCamelot)?.minor {
            if minor && (t.energy ?? 0.5) < 0.5 { s[.melancholic, default: 0] += 0.5; why.append("minor key") }
            if !minor && (t.energy ?? 0.5) >= 0.5 { s[.happy, default: 0] += 0.4; why.append("major key") }
        }
        if let h = hour, !s.isEmpty, h >= 23 || h < 5 { s[.sleepy, default: 0] += 0.2 }
        let sorted = s.sorted { $0.value > $1.value }
        guard let best = sorted.first else { return nil }
        let total = s.values.reduce(0, +)
        let margin = (best.value - (sorted.count > 1 ? sorted[1].value : 0)) / total
        return MoodEstimate(mood: best.key, confidence: min(max(0.35 + margin + 0.1 * Double(why.count), 0), 0.95), reason: why.joined(separator: ", "))
    }
}

/// Playlist suggestions by genre, mood, BPM and time of day.
public struct RecommendationEngine {
    let genres = GenreDetector(), moods = MoodDetector()
    public init() {}
    public func suggest(_ ctx: AssistantContext, genreId: String?, mood: Mood?, bpmMin: Double?, bpmMax: Double?, size: Int = 40) -> Playlist {
        let genre = genreId.flatMap(GenreCatalog.byId) ?? (mood == nil && bpmMin == nil ? TimeOfDayThemes.genreForHour(ctx.hour) : nil)
        let counts = SmartPlaylistEngine.playCounts(ctx.history), maxCount = Double(counts.values.max() ?? 1)
        let ids = ctx.tracks.map { t -> (Track, Double) in
            var s = 0.0
            if let genre { let g = genres.detect(t); s += g?.genre.id == genre.id ? 3 * (g?.confidence ?? 0) : -1 }
            if let mood, let m = moods.detect(t, hour: ctx.hour), m.mood == mood { s += 2 * m.confidence }
            if let lo = bpmMin, let hi = bpmMax {
                if let b = t.bpm { s += (lo...hi).contains(b) ? 2 : ((lo...hi).contains(b * 2) || (lo...hi).contains(b / 2) ? 1 : -2) } else { s -= 0.5 }
            }
            if ctx.favorites.contains(t.id) { s += 0.6 }
            s += 0.4 * Double(counts[t.id] ?? 0) / maxCount
            return (t, s)
        }.filter { $0.1 > 0.5 }.sorted { $0.1 > $1.1 }.prefix(size).map { $0.0.id }
        let name = [genre?.displayName, mood?.label, bpmMin.map { "\(Int($0))–\(Int(bpmMax ?? $0)) BPM" }].compactMap { $0 }.joined(separator: " · ")
        return Playlist(id: "ai_\(name.lowercased())", name: "AI · \(name.isEmpty ? "For you" : name)", trackIds: Array(ids), kind: .ai, genreId: genre?.id,
                        description: genre?.aiSuggestions.first ?? "Picked by Nocternal AI")
    }
}

public enum EqAdvisor {
    public static func recommend(_ track: Track?, route: OutputRoute) -> (EqPreset, String) {
        let genre = track.flatMap { GenreDetector().detect($0)?.genre }
        var p = genre.map { EqPresets.byId($0.eqPresetId) } ?? EqPresets.flat
        if route == .speaker {
            let sub = (p.bandGainsDb[0] + p.bandGainsDb[1]) / 2
            p.bandGainsDb[0] = min(p.bandGainsDb[0], -2); p.bandGainsDb[1] = min(p.bandGainsDb[1], 0)
            p.bandGainsDb[2] = min(max(p.bandGainsDb[2] + sub * 0.5, -12), 6); p.bandGainsDb[6] += 1.5
            p.id += "_speaker"; p.name += " (speaker)"; p.bassBoost = 0
            return (p, "\(genre?.displayName ?? "This track") on the phone speaker: sub-bass moved up to where the speaker can play it")
        }
        return (p, "\(p.name) suits \(genre?.displayName ?? "this track") on \(route == .bluetooth ? "Bluetooth" : "headphones")")
    }
}

public enum FeatureExplainer {
    static let topics: [(String, [String], String)] = [
        ("equalizer", ["eq", "equalizer"], "The 10-band equalizer boosts or cuts ten ranges from 31 Hz (sub-bass) to 16 kHz (air). Raise 60–125 Hz for punch, 2–4 kHz for vocal clarity, 8–16 kHz for sparkle."),
        ("normalization", ["normaliz", "volume jumps"], "Smart normalization plays every song at about −14 LUFS using ReplayGain tags or my own measurement, so volume stays even."),
        ("gapless", ["gapless"], "Gapless playback schedules the next file sample-accurately so albums and mixes flow without a gap."),
        ("crossfade", ["crossfade", "fader", "fade"], "The auto-fader fades the current song out and the next one in (3 s each by default); set 0–12 s in Settings."),
        ("auto mix", ["auto mix", "automix", "dj", "camelot"], "DJ auto-mix picks the next song by Camelot key and tempo (±8 %) and blends over 8–16 bars."),
        ("vocal remover", ["vocal remover", "karaoke"], "The vocal remover cancels centre-panned sound above 150 Hz — usually the lead voice — and keeps bass and kick."),
        ("lighting", ["light bar", "edge lighting", "lighting"], "The light bar and edge lighting react live to the music: bass drives flashes, mids drive ribbons, treble spawns stars."),
        ("private mode", ["private mode"], "Private mode stops history, play counts and scrobbles, and keeps them out of backups."),
    ]
    public static func topic(for t: String) -> String? { topics.first { $0.1.contains { t.contains($0) } }?.0 }
    public static func explain(_ topic: String) -> String { topics.first { $0.0 == topic }?.2 ?? "I can explain the EQ, normalization, gapless, crossfade, auto-mix, vocal remover, lighting and private mode." }
}

/// Deterministic neon cover art spec, rendered by SwiftUI Canvas (see `NeonArtView`).
public struct NeonArtSpec: Sendable, Hashable {
    public enum Shape: String, CaseIterable, Sendable { case ring, sun, grid, mountains, wave, triangle, orb, stars, mandala, waveform }
    public struct Layer: Sendable, Hashable { public let shape: Shape; public let x, y, size, rotation: Double; public let colorIndex: Int }
    public let seed: UInt64
    public let palette: [NeonColor]
    public let layers: [Layer]
    public let prompt: String

    public static func generate(for t: Track) -> NeonArtSpec {
        var rng = SplitMix64(seed: UInt64(truncatingIfNeeded: (t.artist + "|" + t.title + "|" + t.album).utf8.reduce(5381) { ($0 << 5) &+ $0 &+ Int($1) }))
        let genre = GenreDetector().detect(t)?.genre
        let preset = genre.map { ThemePresets.byId($0.themePresetId) } ?? ThemePresets.nocternalDefault
        let palette = [preset.accent, preset.secondaryAccent, preset.accent.lerp(preset.secondaryAccent, 0.5), NeonColor(hex: "#FFFFFF")]
        let motif: [Shape]
        switch genre?.id {
        case "devotional": motif = [.mandala, .sun, .ring]
        case "meditation", "ambient", "sleep": motif = [.orb, .ring, .stars]
        case "night_drive": motif = [.sun, .grid, .mountains]
        case "edm", "techno", "party_mix", "workout": motif = [.triangle, .waveform, .grid]
        case "lofi", "chillout": motif = [.wave, .sun, .stars]
        default: motif = [.ring, .orb, .stars]
        }
        let layers = motif.enumerated().map { i, s in
            Layer(shape: s, x: 0.5 + (rng.next() - 0.5) * 0.3 * Double(i), y: 0.45 + (rng.next() - 0.5) * 0.3, size: 0.3 + rng.next() * 0.4 / Double(i + 1), rotation: rng.next() * 360, colorIndex: i % palette.count)
        }
        return NeonArtSpec(seed: rng.state, palette: palette, layers: layers,
                           prompt: "Neon synthwave album cover for \"\(t.title)\" by \(t.artist): \(motif.map(\.rawValue).joined(separator: ", ")), \(preset.name) palette, glowing lines on black, no text")
    }
}

struct SplitMix64 {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> Double {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return Double((z ^ (z >> 31)) >> 11) / Double(1 << 53)
    }
}
