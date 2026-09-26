import Foundation

/// Platform-neutral ARGB colour (0xAARRGGBB), identical to the Kotlin `NeonColor`.
public struct NeonColor: Codable, Hashable, Sendable {
    public let argb: UInt32
    public init(argb: UInt32) { self.argb = argb }

    public init(from decoder: Decoder) throws { argb = UInt32(truncatingIfNeeded: try decoder.singleValueContainer().decode(Int64.self)) }
    public func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); try c.encode(Int64(argb)) }

    public init(hex: String) {
        var s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        if s.count == 6 { s = "FF" + s }
        self.argb = UInt32(s, radix: 16) ?? 0xFF00F0FF
    }

    public var alpha: Double { Double((argb >> 24) & 0xFF) / 255 }
    public var red: Double { Double((argb >> 16) & 0xFF) / 255 }
    public var green: Double { Double((argb >> 8) & 0xFF) / 255 }
    public var blue: Double { Double(argb & 0xFF) / 255 }
    public var hex: String { String(format: "#%06X", argb & 0xFFFFFF) }

    public func lerp(_ other: NeonColor, _ t: Double) -> NeonColor {
        let k = min(max(t, 0), 1)
        func ch(_ a: Double, _ b: Double) -> UInt32 { UInt32(min(max((a + (b - a) * k) * 255 + 0.5, 0), 255)) }
        return NeonColor(argb: ch(alpha, other.alpha) << 24 | ch(red, other.red) << 16 | ch(green, other.green) << 8 | ch(blue, other.blue))
    }

    public static func hsv(_ h: Double, _ s: Double, _ v: Double) -> NeonColor {
        let hh = ((h.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360) / 60
        let c = v * s, x = c * (1 - abs(hh.truncatingRemainder(dividingBy: 2) - 1)), m = v - c
        let (r, g, b): (Double, Double, Double)
        switch Int(hh) {
        case 0: (r, g, b) = (c, x, 0)
        case 1: (r, g, b) = (x, c, 0)
        case 2: (r, g, b) = (0, c, x)
        case 3: (r, g, b) = (0, x, c)
        case 4: (r, g, b) = (x, 0, c)
        default: (r, g, b) = (c, 0, x)
        }
        func ch(_ f: Double) -> UInt32 { UInt32(min(max((f + m) * 255 + 0.5, 0), 255)) }
        return NeonColor(argb: 0xFF00_0000 | ch(r) << 16 | ch(g) << 8 | ch(b))
    }
}

public enum ThemeMode: String, Codable, CaseIterable, Sendable { case light = "LIGHT", dark = "DARK", neon = "NEON", amoled = "AMOLED" }
public enum AudioSource: String, Codable, CaseIterable, Sendable {
    case local = "LOCAL", youtube = "YOUTUBE", radio = "RADIO"
    public var label: String {
        switch self {
        case .local: return "Local"
        case .youtube: return "YouTube Music"
        case .radio: return "Radio Hub"
        }
    }
}
public enum EdgeLightingMode: String, Codable, CaseIterable, Sendable {
    case off = "OFF", staticGlow = "STATIC", gradient = "GRADIENT", musicReactive = "MUSIC_REACTIVE"
    public var label: String {
        switch self {
        case .off: return "Off"
        case .staticGlow: return "Static"
        case .gradient: return "Gradient"
        case .musicReactive: return "Music reactive"
        }
    }
}

/// The ten advanced lighting animations (spec §6).
public enum LightingAnimation: String, Codable, CaseIterable, Sendable {
    case pulseWaveSpectrum = "PULSE_WAVE_SPECTRUM", hyperBeamEdgeFlow = "HYPERBEAM_EDGE_FLOW", auroraRibbon = "AURORA_RIBBON", bassShockFlash = "BASS_SHOCK_FLASH", prismCycle = "PRISM_CYCLE", vortexSpiral = "VORTEX_SPIRAL", eqBarMirage = "EQ_BAR_MIRAGE", starfallReactive = "STARFALL_REACTIVE", crystalGrid = "CRYSTAL_GRID", infinityLoop = "INFINITY_LOOP"
    public var label: String {
        switch self {
        case .pulseWaveSpectrum: "PulseWave Spectrum"
        case .hyperBeamEdgeFlow: "HyperBeam Edge Flow"
        case .auroraRibbon: "Aurora Ribbon"
        case .bassShockFlash: "BassShock Flash"
        case .prismCycle: "Prism Cycle"
        case .vortexSpiral: "Vortex Spiral"
        case .eqBarMirage: "EQ Bar Mirage"
        case .starfallReactive: "Starfall Reactive"
        case .crystalGrid: "Crystal Grid"
        case .infinityLoop: "Infinity Loop"
        }
    }
}

public enum BackgroundStyle: String, Codable, CaseIterable, Sendable {
    case amoledBlack = "AMOLED_BLACK", deepSpace = "DEEP_SPACE", nebula = "NEBULA", starfield = "STARFIELD", auroraHaze = "AURORA_HAZE", gridHorizon = "GRID_HORIZON", softGlow = "SOFT_GLOW", sacredMandala = "SACRED_MANDALA", rainGlass = "RAIN_GLASS"
}

public enum Mood: String, Codable, CaseIterable, Sendable {
    case calm = "CALM", energetic = "ENERGETIC", happy = "HAPPY", melancholic = "MELANCHOLIC", romantic = "ROMANTIC"
    case focused = "FOCUSED", spiritual = "SPIRITUAL", sleepy = "SLEEPY", party = "PARTY"
    public var label: String { String(rawValue.prefix(1)) + rawValue.dropFirst().lowercased() }
}

public enum RepeatMode: String, Codable, Sendable { case off = "OFF", one = "ONE", all = "ALL" }

public struct Track: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var uri: String
    public var title: String
    public var artist: String
    public var album: String
    public var genreTag: String?
    public var durationMs: Int64
    public var bpm: Double?
    public var camelotKey: String?
    public var folder: String
    public var year: Int?
    public var replayGainDb: Double?
    public var loudnessDb: Double?
    public var energy: Double?
    public var artworkUri: String?
    public var dateAddedEpochMs: Int64
    public var source: AudioSource
    public var isPodcast: Bool

    public init(id: String, uri: String = "", title: String, artist: String = "Unknown artist", album: String = "", genreTag: String? = nil,
                durationMs: Int64 = 0, bpm: Double? = nil, camelotKey: String? = nil, folder: String = "", year: Int? = nil,
                replayGainDb: Double? = nil, loudnessDb: Double? = nil, energy: Double? = nil, artworkUri: String? = nil,
                dateAddedEpochMs: Int64 = 0, source: AudioSource = .local, isPodcast: Bool = false) {
        self.id = id; self.uri = uri; self.title = title; self.artist = artist; self.album = album; self.genreTag = genreTag
        self.durationMs = durationMs; self.bpm = bpm; self.camelotKey = camelotKey; self.folder = folder; self.year = year
        self.replayGainDb = replayGainDb; self.loudnessDb = loudnessDb; self.energy = energy; self.artworkUri = artworkUri
        self.dateAddedEpochMs = dateAddedEpochMs; self.source = source; self.isPodcast = isPodcast
    }
}

public enum PlaylistKind: String, Codable, Sendable { case user = "USER", smart = "SMART", genre = "GENRE", ai = "AI" }

public struct Playlist: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var trackIds: [String]
    public var kind: PlaylistKind
    public var genreId: String?
    public var description: String
    public init(id: String, name: String, trackIds: [String], kind: PlaylistKind = .user, genreId: String? = nil, description: String = "") {
        self.id = id; self.name = name; self.trackIds = trackIds; self.kind = kind; self.genreId = genreId; self.description = description
    }
}

public struct PlayEvent: Codable, Hashable, Sendable {
    public var trackId: String
    public var startedAtEpochMs: Int64
    public var listenedMs: Int64
    public var completed: Bool
    public init(trackId: String, startedAtEpochMs: Int64, listenedMs: Int64, completed: Bool? = nil) {
        self.trackId = trackId; self.startedAtEpochMs = startedAtEpochMs; self.listenedMs = listenedMs; self.completed = completed ?? (listenedMs > 0)
    }
}

/// Centre frequencies of the 10-band EQ.
public let eqBandFrequencies: [Double] = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

public struct EqPreset: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var bandGainsDb: [Double]
    public var preampDb: Double
    public var bassBoost: Double
    public var surround: Double
    public var loudnessDb: Double
    public init(_ id: String, _ name: String, _ gains: [Double], preampDb: Double = 0, bassBoost: Double = 0, surround: Double = 0, loudnessDb: Double = 0) {
        precondition(gains.count == 10)
        self.id = id; self.name = name; self.bandGainsDb = gains; self.preampDb = preampDb; self.bassBoost = bassBoost; self.surround = surround; self.loudnessDb = loudnessDb
    }
}

public struct ThemePreset: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var accent: NeonColor
    public var secondaryAccent: NeonColor
    public var glowIntensity: Double
    public var edgeLightingMode: EdgeLightingMode
    public var edgeThickness: Double
    public var edgeBrightness: Double
    public var lightBarAnimation: LightingAnimation
    public var eqPresetId: String
    public var backgroundStyle: BackgroundStyle
    public var themeMode: ThemeMode

    public init(id: String, name: String, accent: String, secondary: String, glow: Double, edge: EdgeLightingMode, thickness: Double = 4, brightness: Double = 0.8,
                animation: LightingAnimation, eq: String, background: BackgroundStyle, mode: ThemeMode = .neon) {
        self.id = id; self.name = name; self.accent = NeonColor(hex: accent); self.secondaryAccent = NeonColor(hex: secondary)
        self.glowIntensity = glow; self.edgeLightingMode = edge; self.edgeThickness = thickness; self.edgeBrightness = brightness
        self.lightBarAnimation = animation; self.eqPresetId = eq; self.backgroundStyle = background; self.themeMode = mode
    }
}

public struct GenreDefinition: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var displayName: String
    public var emoji: String
    public var themePresetId: String
    public var eqPresetId: String
    public var aliases: [String]
    public var aiSuggestions: [String]
    public var radioTags: [String]
    public var defaultMood: Mood
    public var bpmMin: Double
    public var bpmMax: Double

    public init(id: String, displayName: String, emoji: String, themePresetId: String, eqPresetId: String, aliases: [String],
                aiSuggestions: [String], radioTags: [String], defaultMood: Mood, bpmMin: Double = 0, bpmMax: Double = 999) {
        self.id = id; self.displayName = displayName; self.emoji = emoji; self.themePresetId = themePresetId; self.eqPresetId = eqPresetId
        self.aliases = aliases; self.aiSuggestions = aiSuggestions; self.radioTags = radioTags; self.defaultMood = defaultMood
        self.bpmMin = bpmMin; self.bpmMax = bpmMax
    }
}

/// Post-FX analysis frame that drives the lighting (all values 0…1).
public struct SpectrumFrame: Sendable {
    public var bands: [Float]
    public var bass: Float, mid: Float, treble: Float, level: Float
    public var beat: Bool
    public init(bands: [Float], bass: Float, mid: Float, treble: Float, level: Float, beat: Bool) {
        self.bands = bands; self.bass = bass; self.mid = mid; self.treble = treble; self.level = level; self.beat = beat
    }
    public static let bandCount = 32
    public static let silent = SpectrumFrame(bands: Array(repeating: 0, count: bandCount), bass: 0, mid: 0, treble: 0, level: 0, beat: false)
}

public struct LightBarSettings: Codable, Hashable, Sendable {
    public var enabled = true
    public var color: NeonColor? = nil
    public var glowIntensity = 0.8
    public var animation: LightingAnimation = .pulseWaveSpectrum
    /// True once the user picks an animation; genre themes then stop changing it.
    public var customAnimation = false
    public init() {}
}

public struct EdgeLightingSettings: Codable, Hashable, Sendable {
    public var enabled = true
    public var mode: EdgeLightingMode = .musicReactive
    public var thickness = 4.0
    public var brightness = 0.8
    /// True once the user sets thickness/brightness (or the mode); genre themes then keep the user's values.
    public var customStyle = false
    public var customMode = false
    public init() {}
}

/// User settings (backed up and restored). Mirrors Kotlin `AppSettings`.
public struct AppSettings: Codable, Hashable, Sendable {
    public var themeMode: ThemeMode = .neon
    public var customAccent: NeonColor? = nil
    public var autoThemeByGenre = true
    public var autoThemeByMood = true
    public var autoThemeByTime = false
    public var eqFollowsTheme = true
    public var autoFaderEnabled = true
    public var crossfadeSeconds = 5.0
    public var gapless = true
    public var normalization = true
    public var speakerSafeMode = true
    public var privateMode = false
    public var smartOfflineMode = true
    public var useWifi = true
    public var useMobileData = true
    public var autoDownloadOnWifiOnly = false
    public var autoDownloadLyrics = true
    public var lightBar = LightBarSettings()
    public var edgeLighting = EdgeLightingSettings()
    public var enabledPlugins: Set<String> = []
    public var assistantApiKey: String? = nil
    public init() {}
}

extension AppSettings {
    public init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let v = try c.decodeIfPresent(ThemeMode.self, forKey: .themeMode) { themeMode = v }
        if c.contains(.customAccent) { customAccent = try c.decodeIfPresent(NeonColor.self, forKey: .customAccent) }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .autoThemeByGenre) { autoThemeByGenre = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .autoThemeByMood) { autoThemeByMood = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .autoThemeByTime) { autoThemeByTime = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .eqFollowsTheme) { eqFollowsTheme = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .autoFaderEnabled) { autoFaderEnabled = v }
        if let v = try c.decodeIfPresent(Double.self, forKey: .crossfadeSeconds) { crossfadeSeconds = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .gapless) { gapless = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .normalization) { normalization = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .speakerSafeMode) { speakerSafeMode = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .privateMode) { privateMode = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .smartOfflineMode) { smartOfflineMode = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .useWifi) { useWifi = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .useMobileData) { useMobileData = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .autoDownloadOnWifiOnly) { autoDownloadOnWifiOnly = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .autoDownloadLyrics) { autoDownloadLyrics = v }
        if let v = try c.decodeIfPresent(LightBarSettings.self, forKey: .lightBar) { lightBar = v }
        if let v = try c.decodeIfPresent(EdgeLightingSettings.self, forKey: .edgeLighting) { edgeLighting = v }
        if let v = try c.decodeIfPresent(Set<String>.self, forKey: .enabledPlugins) { enabledPlugins = v }
        if c.contains(.assistantApiKey) { assistantApiKey = try c.decodeIfPresent(String.self, forKey: .assistantApiKey) }
    }
}

extension LightBarSettings {
    public init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let v = try c.decodeIfPresent(Bool.self, forKey: .enabled) { enabled = v }
        if c.contains(.color) { color = try c.decodeIfPresent(NeonColor.self, forKey: .color) }
        if let v = try c.decodeIfPresent(Double.self, forKey: .glowIntensity) { glowIntensity = v }
        if let v = try c.decodeIfPresent(LightingAnimation.self, forKey: .animation) { animation = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .customAnimation) { customAnimation = v }
    }
}

extension EdgeLightingSettings {
    public init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let v = try c.decodeIfPresent(Bool.self, forKey: .enabled) { enabled = v }
        if let v = try c.decodeIfPresent(EdgeLightingMode.self, forKey: .mode) { mode = v }
        if let v = try c.decodeIfPresent(Double.self, forKey: .thickness) { thickness = v }
        if let v = try c.decodeIfPresent(Double.self, forKey: .brightness) { brightness = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .customStyle) { customStyle = v }
        if let v = try c.decodeIfPresent(Bool.self, forKey: .customMode) { customMode = v }
    }
}
