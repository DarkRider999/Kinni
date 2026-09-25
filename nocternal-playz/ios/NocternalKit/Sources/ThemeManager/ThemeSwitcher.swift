import Foundation
import NocternalModel

// The four sinks from spec §9 ("ThemeManager.setAccentColor … BackgroundManager.setStyle").
public protocol ThemeManaging: AnyObject {
    func setAccentColor(_ c: NeonColor)
    func setSecondaryAccentColor(_ c: NeonColor)
    func setGlowIntensity(_ v: Double)
    func setThemeMode(_ m: ThemeMode)
}
public protocol LightingEngine: AnyObject {
    func setEdgeMode(_ m: EdgeLightingMode)
    func setEdgeStyle(thickness: Double, brightness: Double)
    func setLightBarAnimation(_ a: LightingAnimation)
}
public protocol EQManaging: AnyObject { func applyPreset(_ p: EqPreset) }
public protocol BackgroundManaging: AnyObject { func setStyle(_ s: BackgroundStyle) }

public final class ThemeApplier {
    let theme: ThemeManaging, lighting: LightingEngine, eq: EQManaging, background: BackgroundManaging
    public init(theme: ThemeManaging, lighting: LightingEngine, eq: EQManaging, background: BackgroundManaging) {
        self.theme = theme; self.lighting = lighting; self.eq = eq; self.background = background
    }
    public func applyTheme(_ t: ThemePreset, applyEq: Bool = true) {
        theme.setAccentColor(t.accent)
        theme.setSecondaryAccentColor(t.secondaryAccent)
        theme.setGlowIntensity(t.glowIntensity)
        lighting.setEdgeMode(t.edgeLightingMode)
        lighting.setEdgeStyle(thickness: t.edgeThickness, brightness: t.edgeBrightness)
        lighting.setLightBarAnimation(t.lightBarAnimation)
        if applyEq { eq.applyPreset(EqPresets.byId(t.eqPresetId)) }
        background.setStyle(t.backgroundStyle)
    }
}

public enum ThemeTrigger: Int, Sendable {
    case timeOfDay = 10, sourceChanged = 30, aiMoodDetected = 40, songStarted = 60, genrePlaylistOpened = 80, genreTileSelected = 81, manual = 100
    var priority: Int { self == .genreTileSelected ? 80 : rawValue }
}

public enum ThemeEvent: Sendable {
    case songStarted(Track, queueGenreId: String?)
    case genrePlaylistOpened(String)
    case moodDetected(Mood, confidence: Double, hour: Int?)
    case sourceChanged(AudioSource, nowPlaying: Track?)
    case genreTileSelected(String)
    case timeTick(hour: Int)
    case manualThemeSelected(String)
    case manualLockReleased
}

public struct ThemeDecision: Sendable {
    public let preset: ThemePreset
    public let genre: GenreDefinition?
    public let trigger: ThemeTrigger
    public let reason: String
}

/// Genre-based theme switching (spec §9) with the same rules as the Kotlin `ThemeSwitcher`.
public final class ThemeSwitcher {
    private let applier: ThemeApplier
    private let settings: () -> AppSettings
    private let detector: GenreDetector
    private let moodThreshold = 0.6
    public private(set) var current = ThemeDecision(preset: ThemePresets.nocternalDefault, genre: nil, trigger: .timeOfDay, reason: "default theme")
    public var onChange: ((ThemeDecision) -> Void)?
    private var manualLock = false
    private var contextGenreId: String?
    private var lastSongGenreKnown = false

    public init(applier: ThemeApplier, settings: @escaping () -> AppSettings, detector: GenreDetector = GenreDetector()) {
        self.applier = applier; self.settings = settings; self.detector = detector
    }

    @discardableResult
    public func handle(_ event: ThemeEvent) -> ThemeDecision? {
        let s = settings()
        let decision: ThemeDecision?
        switch event {
        case .manualThemeSelected(let id):
            manualLock = true
            decision = ThemeDecision(preset: ThemePresets.byId(id), genre: nil, trigger: .manual, reason: "chosen by you")
        case .manualLockReleased:
            manualLock = false
            decision = contextGenreId.flatMap { forGenre($0, .genrePlaylistOpened, "back to playlist theme") }
                ?? ThemeDecision(preset: ThemePresets.nocternalDefault, genre: nil, trigger: .timeOfDay, reason: "auto theme resumed")
        default:
            decision = manualLock ? nil : auto(event, s)
        }
        guard let d = decision else { return nil }
        var isManual = false
        if case .manualThemeSelected = event { isManual = true }
        if d.preset.id == current.preset.id && !isManual {
            current = ThemeDecision(preset: current.preset, genre: d.genre, trigger: d.trigger, reason: d.reason)
            return nil
        }
        var preset = d.preset
        if let accent = s.customAccent { preset.accent = accent }
        applier.applyTheme(preset, applyEq: s.eqFollowsTheme)
        current = ThemeDecision(preset: preset, genre: d.genre, trigger: d.trigger, reason: d.reason)
        onChange?(current)
        return current
    }

    private func auto(_ event: ThemeEvent, _ s: AppSettings) -> ThemeDecision? {
        switch event {
        case .genreTileSelected(let id):
            contextGenreId = id
            return forGenre(id, .genreTileSelected, "genre tile")
        case .genrePlaylistOpened(let id):
            contextGenreId = id
            return forGenre(id, .genrePlaylistOpened, "genre playlist")
        case .songStarted(let track, let queueGenreId):
            if let q = queueGenreId { contextGenreId = q } else { contextGenreId = nil }
            if let id = contextGenreId { lastSongGenreKnown = true; return forGenre(id, .genrePlaylistOpened, "playing from genre playlist") }
            guard s.autoThemeByGenre else { return nil }
            let m = detector.detect(track)
            lastSongGenreKnown = m != nil
            return m.flatMap { forGenre($0.genre.id, .songStarted, $0.reason) }
        case .moodDetected(let mood, let confidence, let hour):
            let weaker = current.trigger.priority <= ThemeTrigger.aiMoodDetected.priority
            guard s.autoThemeByMood, confidence >= moodThreshold, weaker || !lastSongGenreKnown, contextGenreId == nil else { return nil }
            return forGenre(detector.forMood(mood, hour: hour).id, .aiMoodDetected, "mood looks \(mood.label.lowercased())")
        case .sourceChanged(let source, let nowPlaying):
            contextGenreId = nil
            if let g = nowPlaying.flatMap({ detector.detect($0)?.genre }) { return forGenre(g.id, .sourceChanged, "\(source.label) · \(g.displayName)") }
            let preset: ThemePreset = source == .youtube ? ThemePresets.cyberRedPulse : source == .radio ? ThemePresets.bluePurpleGalaxy : ThemePresets.nocternalDefault
            return ThemeDecision(preset: preset, genre: nil, trigger: .sourceChanged, reason: "switched to \(source.label)")
        case .timeTick(let hour):
            guard s.autoThemeByTime, current.trigger.priority <= ThemeTrigger.timeOfDay.priority else { return nil }
            return forGenre(TimeOfDayThemes.genreForHour(hour).id, .timeOfDay, "time of day")
        case .manualThemeSelected, .manualLockReleased:
            return nil
        }
    }

    private func forGenre(_ id: String, _ trigger: ThemeTrigger, _ reason: String) -> ThemeDecision? {
        guard let g = GenreCatalog.byId(id) else { return nil }
        return ThemeDecision(preset: ThemePresets.byId(GenreCatalog.genreThemeMap[id] ?? g.themePresetId), genre: g, trigger: trigger, reason: reason)
    }
}
