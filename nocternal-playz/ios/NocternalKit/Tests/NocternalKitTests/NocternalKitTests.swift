import XCTest
import NocternalModel
import ThemeManager
import Playlists
import AutoMixEngine
import LyricsEngine
import BackupManager
import FXEngine
import AIAssistant

final class Sink: ThemeManaging, LightingEngine, EQManaging, BackgroundManaging {
    var accent: NeonColor?, animation: LightingAnimation?, eq: EqPreset?, bg: BackgroundStyle?
    func setAccentColor(_ c: NeonColor) { accent = c }
    func setSecondaryAccentColor(_ c: NeonColor) {}
    func setGlowIntensity(_ v: Double) {}
    func setThemeMode(_ m: ThemeMode) {}
    func setEdgeMode(_ m: EdgeLightingMode) {}
    func setEdgeStyle(thickness: Double, brightness: Double) {}
    func setLightBarAnimation(_ a: LightingAnimation) { animation = a }
    func applyPreset(_ p: EqPreset) { eq = p }
    func setStyle(_ s: BackgroundStyle) { bg = s }
}

final class NocternalKitTests: XCTestCase {
    func testSpecGenreThemeMap() {
        let expected = ["devotional": "Sacred Gold Aura", "meditation": "Emerald Tranquility", "sleep": "Moonlit Cyan Drift", "hindi_classics": "Royal Purple Gold",
                        "edm": "Electric Blue Pulse", "trance": "Violet Hyperspace", "techno": "Cyber Red Pulse", "night_drive": "Blue-Purple Galaxy",
                        "lofi": "Soft Pink Glow", "chillout": "Aqua Drift"]
        for (g, name) in expected { XCTAssertEqual(ThemePresets.byId(GenreCatalog.genreThemeMap[g]!).name, name) }
        XCTAssertEqual(GenreCatalog.all.count, 18)
        XCTAssertEqual(ThemePresets.all.count, 19)
    }

    func testThemeSwitcher() {
        let sink = Sink()
        let sw = ThemeSwitcher(applier: ThemeApplier(theme: sink, lighting: sink, eq: sink, background: sink), settings: { AppSettings() })
        let d = sw.handle(.songStarted(Track(id: "1", title: "Om Jai", genreTag: "Bhajan"), queueGenreId: nil))
        XCTAssertEqual(d?.preset.id, "sacred_gold_aura")
        XCTAssertEqual(sink.animation, .auroraRibbon)
        XCTAssertEqual(sink.eq?.id, "vocal_clarity")
        XCTAssertNil(sw.handle(.songStarted(Track(id: "2", title: "Aarti", genreTag: "Devotional"), queueGenreId: nil)))
        sw.handle(.manualThemeSelected("aqua_drift"))
        XCTAssertNil(sw.handle(.songStarted(Track(id: "3", title: "x", genreTag: "Techno"), queueGenreId: nil)))
    }

    func testGenreDetection() {
        let d = GenreDetector()
        XCTAssertEqual(d.detect(Track(id: "a", title: "x", genreTag: "Lo-Fi Hip Hop"))?.genre.id, "lofi")
        XCTAssertEqual(d.detect(Track(id: "b", title: "Trance Nation"))?.genre.id, "trance")
        XCTAssertEqual(d.detect(Track(id: "c", title: "Gentle rain for sleeping"))?.genre.id, "sleep")
    }

    func testCamelotAndAutoMix() {
        for pc in 0..<12 { for minor in [false, true] { let k = MusicalKey(pc, minor: minor); XCTAssertEqual(MusicalKey.fromCamelot(k.camelot), k) } }
        XCTAssertEqual(MusicalKey.parse("A minor")?.camelot, "8A")
        XCTAssertEqual(Harmonic.relation(MusicalKey.fromCamelot("8A"), MusicalKey.fromCamelot("9A")), .adjacent)
        XCTAssertEqual(Tempo.match(140, 70).ratio, 1, accuracy: 1e-9)
        XCTAssertEqual(AutoFader().volume(at: 1500, duration: 60_000), 0.5, accuracy: 1e-9)
    }

    func testLyrics() {
        let l = LrcParser.parse("[00:01.00]First\n[00:10.00]<00:10.00>Kara <00:10.50>oke", origin: .sidecar)
        XCTAssertTrue(l.synced)
        XCTAssertEqual(l.lines[1].text, "Kara oke")
        XCTAssertEqual(LrcParser.position(l, at: 10_600).word, 1)
    }

    func testBackupRoundTripAndKotlinCompatibility() throws {
        let a = [Track(id: "a1", title: "Kun Faya Kun", artist: "A.R. Rahman", durationMs: 473_000)]
        let b = [Track(id: "b9", title: "Kun Faya Kun", artist: "A.R. Rahman", durationMs: 473_400)]
        var settings = AppSettings(); settings.assistantApiKey = "secret"; settings.customAccent = NeonColor(hex: "#123456")
        let state = LibraryState(settings: settings, playlists: [Playlist(id: "p", name: "Sufi", trackIds: ["a1"])], favorites: ["a1"], history: [])
        let data = try BackupManager(appVersion: "1").export(state, tracks: a)
        XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("secret"))
        let (restored, unmatched) = try BackupManager(appVersion: "1").restore(data, localTracks: b, current: LibraryState(settings: AppSettings(), playlists: [], favorites: [], history: []), merge: false)
        XCTAssertEqual(unmatched, 0)
        XCTAssertEqual(restored.favorites, ["b9"])
        XCTAssertEqual(restored.settings.customAccent, NeonColor(hex: "#123456"))
        // A settings blob as written by Android's kotlinx.serialization (enum names, colour as a number, missing keys).
        let kotlin = #"{"themeMode":"AMOLED","customAccent":4278190335,"lightBar":{"animation":"VORTEX_SPIRAL"},"edgeLighting":{"mode":"MUSIC_REACTIVE"}}"#
        let s = try JSONDecoder().decode(AppSettings.self, from: Data(kotlin.utf8))
        XCTAssertEqual(s.themeMode, .amoled)
        XCTAssertEqual(s.customAccent, NeonColor(hex: "#0000FF"))
        XCTAssertEqual(s.lightBar.animation, .vortexSpiral)
        XCTAssertTrue(s.autoThemeByGenre)
    }

    func testCommands() {
        XCTAssertEqual(CommandParser.parse("Play trance playlist"), .playGenre("trance"))
        XCTAssertEqual(CommandParser.parse("Boost bass"), .adjustBass(up: true))
        XCTAssertEqual(CommandParser.parse("Activate meditation theme"), .activateTheme("meditation"))
        XCTAssertEqual(CommandParser.parse("sleep in 45 minutes"), .sleepTimer(minutes: 45))
        XCTAssertEqual(CommandParser.parse("what song is this?"), .identifySong)
    }

    func testFFTAndBiquad() {
        let n = 4096, sr = 44100.0
        let tone = (0..<n).map { Float(sin(2 * Double.pi * 1000 * Double($0) / sr)) }
        let mags = FFT(size: n).magnitudes(tone)
        let peak = mags.indices.max { mags[$0] < mags[$1] }!
        XCTAssertEqual(Double(peak) * sr / Double(n), 1000, accuracy: 15)
        var bq = Biquad(); bq.setPeaking(fs: 48000, f0: 1000, q: 1.41, gainDb: 6)
        XCTAssertEqual(bq.magnitudeDb(fs: 48000, f: 1000), 6, accuracy: 0.2)
    }

    func testAssistantEngine() async {
        var ctx = AssistantContext()
        ctx.tracks = [Track(id: "t1", title: "Anthem", genreTag: "Psytrance", bpm: 140, energy: 0.9)]
        let r = await AssistantEngine(llm: nil).handle("play trance", ctx)
        XCTAssertEqual(r.actions.count, 2)
    }
}
