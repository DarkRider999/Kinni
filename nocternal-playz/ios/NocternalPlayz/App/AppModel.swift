import SwiftUI
import Combine
import NocternalModel
import ThemeManager
import Playlists
import LyricsEngine
import BackupManager
import FXEngine
import AIAssistant

/// App-wide wiring (iOS counterpart of Android's AppContainer).
final class AppModel: ObservableObject {
    let theme = ThemeState()
    let lighting = LightingState()
    let audio = AudioEngine()
    let library = LibraryStore()
    let radio = RadioBrowser()
    let recognizer = SongRecognizer()
    let lyricsRepo = LyricsRepository(cacheDir: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("lyrics"))
    let genres = GenreDetector()
    let moods = MoodDetector()
    lazy var smart = SmartPlaylistEngine(detector: genres, moodOf: { [moods] in moods.detect($0)?.mood })
    lazy var switcher = ThemeSwitcher(applier: ThemeApplier(theme: theme, lighting: lighting, eq: audio, background: theme), settings: { [unowned self] in self.settings }, detector: genres)

    @Published var settings: AppSettings { didSet { settingsChanged() } }
    @Published var themeDecision: ThemeDecision?
    @Published var lyrics: Lyrics?
    @Published var requestedSource: AudioSource?
    @Published var panelSearch: (AudioSource, String)?
    @Published private(set) var assistant: AssistantEngine

    private var bag = Set<AnyCancellable>()
    private static let settingsKey = "app_settings"

    init() {
        let s = UserDefaults.standard.data(forKey: AppModel.settingsKey).flatMap { try? JSONDecoder().decode(AppSettings.self, from: $0) } ?? AppSettings()
        var withKey = s
        withKey.assistantApiKey = Keychain.get("claude_api_key")
        settings = withKey
        assistant = AssistantEngine(llm: withKey.assistantApiKey.map { ClaudeLLM(apiKey: $0) })
        wire()
        settingsChanged()
    }

    private func wire() {
        audio.libraryPool = { [unowned self] in self.library.data.tracks }
        audio.onTrackStarted = { [unowned self] track, genreId in
            onMain {
                self.switcher.handle(.songStarted(track, queueGenreId: genreId))
                let hour = Calendar.current.component(.hour, from: Date())
                if let m = self.moods.detect(track, hour: hour) { self.switcher.handle(.moodDetected(m.mood, confidence: m.confidence, hour: hour)) }
                self.lyrics = nil
                if track.source == .local {
                    Task { let l = await self.lyricsRepo.lyrics(for: track, onlineAllowed: !self.settings.privateMode); await MainActor.run { self.lyrics = l } }
                }
            }
        }
        audio.onTrackFinished = { [unowned self] t, ms in
            onMain { self.library.record(PlayEvent(trackId: t.id, startedAtEpochMs: Int64(Date().timeIntervalSince1970 * 1000) - ms, listenedMs: ms, completed: t.durationMs > 0 && Double(ms) >= Double(t.durationMs) * 0.8)) }
        }
        switcher.onChange = { [unowned self] d in onMain { self.themeDecision = d } }
        // Forward nested objects' changes so views observing AppModel refresh.
        [theme.objectWillChange, lighting.objectWillChange, library.objectWillChange].forEach { $0.sink { [unowned self] _ in self.objectWillChange.send() }.store(in: &bag) }
        Timer.publish(every: 600, on: .main, in: .common).autoconnect().sink { [unowned self] _ in
            self.switcher.handle(.timeTick(hour: Calendar.current.component(.hour, from: Date())))
        }.store(in: &bag)
    }

    private func settingsChanged() {
        var stored = settings; stored.assistantApiKey = nil
        if let d = try? JSONEncoder().encode(stored) { UserDefaults.standard.set(d, forKey: AppModel.settingsKey) }
        audio.settings = settings
        library.privateMode = settings.privateMode
        theme.setThemeMode(settings.themeMode)
        if let c = settings.customAccent { theme.setAccentColor(c) }
        lighting.lightBar.enabled = settings.lightBar.enabled
        lighting.lightBar.color = settings.lightBar.color
        lighting.lightBar.glowIntensity = settings.lightBar.glowIntensity
        lighting.edge.enabled = settings.edgeLighting.enabled
    }

    func setApiKey(_ key: String?) {
        Keychain.set("claude_api_key", key)
        settings.assistantApiKey = key
        assistant = AssistantEngine(llm: key.map { ClaudeLLM(apiKey: $0) })
    }

    func context() -> AssistantContext {
        var c = AssistantContext()
        c.tracks = library.data.tracks; c.favorites = library.data.favorites
        c.history = settings.privateMode ? [] : library.data.history
        c.nowPlaying = audio.current; c.hour = Calendar.current.component(.hour, from: Date()); c.privateMode = settings.privateMode
        return c
    }

    func playPlaylist(_ p: Playlist) {
        if let g = p.genreId { switcher.handle(.genrePlaylistOpened(g)) }
        audio.play(p.trackIds.compactMap(library.track), genreId: p.genreId)
    }

    /// Executes assistant actions (same mapping as Android's ActionExecutor).
    func run(_ actions: [AssistantAction]) -> Bool {
        var wantsRecognition = false
        for a in actions {
            switch a {
            case .playQueue(let p, let g): var pl = p; pl.genreId = g ?? p.genreId; playPlaylist(pl)
            case .search(let q, let src): requestedSource = src; panelSearch = (src, q)
            case .setEq(let p): audio.applyPreset(p)
            case .changeBass(let d): audio.fx.bassBoost = min(max(audio.fx.bassBoost + d, 0), 1)
            case .applyGenreTheme(let g): switcher.handle(.genreTileSelected(g))
            case .switchSource(let s): requestedSource = s
            case .setSleepTimer(let m): audio.setSleepTimer(minutes: m)
            case .transport(let c):
                switch c {
                case .play, .pause: audio.togglePlay()
                case .next: audio.next()
                case .previous: audio.previous()
                case .shuffle: audio.shuffle.toggle()
                case .repeatMode: audio.repeatMode = audio.repeatMode == .off ? .all : audio.repeatMode == .all ? .one : .off
                case .volumeUp, .volumeDown: break // hardware volume on iOS
                case .like: if let t = audio.current { library.toggleFavorite(t.id) }
                }
            case .enhance(let m):
                audio.fx.eqGains = zip(audio.fx.eqGains, m.eqOffsets).map { min(max($0 + $1, -12), 12) }
                if m == .noiseRemoval || m == .oldRecording { audio.fx.custom.noiseReduction = 0.6 }
                if m == .clarity || m == .vocalFocus { audio.fx.compressor = true }
                if m == .bassEnhancement { audio.fx.bassBoost = min(audio.fx.bassBoost + 0.5, 1) }
            case .setVocalRemover(let v): audio.fx.custom.vocalRemover = v
            case .startRecognition: wantsRecognition = true
            case .showAlbumArt: break
            case .enableAutoMix(let on): audio.autoMix = on
            }
        }
        return wantsRecognition
    }

    // MARK: Backup (same JSON as Android)

    func exportBackup() throws -> Data {
        try BackupManager(appVersion: "1.0.0").export(LibraryState(settings: settings, playlists: library.data.playlists, favorites: library.data.favorites, history: library.data.history), tracks: library.data.tracks)
    }

    func restoreBackup(_ data: Data, merge: Bool) throws -> Int {
        let current = LibraryState(settings: settings, playlists: library.data.playlists, favorites: library.data.favorites, history: library.data.history)
        let (state, unmatched) = try BackupManager(appVersion: "1.0.0").restore(data, localTracks: library.data.tracks, current: current, merge: merge)
        var s = state.settings; s.assistantApiKey = settings.assistantApiKey
        settings = s
        library.replace(favorites: state.favorites, history: state.history, playlists: state.playlists)
        return unmatched
    }
}
