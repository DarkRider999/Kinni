import SwiftUI
import UniformTypeIdentifiers
import MediaPlayer
import NocternalModel

/// Settings (spec §10): theme mode, accent, crossfade, sleep timer, private mode, backup & restore, AI.
struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    @Binding var showBubble: Bool
    @State private var apiKey = ""
    @State private var exporting = false
    @State private var importing = false
    @State private var merge = true
    @State private var message: String?
    private let accents = ["#00F0FF", "#FF00E5", "#8F00FF", "#00A3FF", "#00F5A0", "#B6FF00", "#FFC940", "#FF1744"].map { NeonColor(hex: $0) }

    private func toggle(_ label: String, _ kp: WritableKeyPath<AppSettings, Bool>) -> some View {
        Toggle(label, isOn: Binding(get: { model.settings[keyPath: kp] }, set: { model.settings[keyPath: kp] = $0 })).tint(theme.accent).foregroundStyle(theme.text)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Settings").font(.title2.bold()).foregroundStyle(theme.text)
                SectionTitle(text: "Theme")
                GlowCard {
                    Picker("Mode", selection: Binding(get: { model.settings.themeMode }, set: { model.settings.themeMode = $0 })) {
                        Text("Light").tag(ThemeMode.light); Text("Dark").tag(ThemeMode.dark); Text("Neon").tag(ThemeMode.neon); Text("AMOLED").tag(ThemeMode.amoled)
                    }.pickerStyle(.segmented)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            NeonChip(text: "Auto (genre)", selected: model.settings.customAccent == nil) { model.settings.customAccent = nil }
                            ForEach(accents, id: \.self) { c in Circle().fill(c.color).frame(width: 32, height: 32).overlay(Circle().stroke(.white, lineWidth: model.settings.customAccent == c ? 3 : 0)).onTapGesture { model.settings.customAccent = c } }
                        }
                    }
                    toggle("Auto theme by genre", \.autoThemeByGenre)
                    toggle("Auto theme by AI mood", \.autoThemeByMood)
                    toggle("Auto theme by time of day", \.autoThemeByTime)
                    toggle("Theme also sets the EQ", \.eqFollowsTheme)
                }
                SectionTitle(text: "Playback")
                GlowCard {
                    toggle("Auto-fader (fade out + fade in)", \.autoFaderEnabled)
                    HStack { Text("Crossfade \(Int(model.settings.crossfadeSeconds)) s").foregroundStyle(theme.text); Slider(value: Binding(get: { model.settings.crossfadeSeconds }, set: { model.settings.crossfadeSeconds = $0.rounded() }), in: 0...12).tint(theme.accent) }
                    toggle("True gapless playback", \.gapless)
                    toggle("Smart audio normalization", \.normalization)
                    toggle("Hearing & speaker safe mode", \.speakerSafeMode)
                    HStack {
                        Text(audio.sleepRemaining.map { "Sleep timer: \(Int($0 / 60) + 1) min left" } ?? "Sleep timer").foregroundStyle(theme.muted)
                        Spacer()
                        ForEach([15, 30, 60], id: \.self) { m in NeonChip(text: "\(m)m") { audio.setSleepTimer(minutes: m) } }
                        NeonChip(text: "Off") { audio.setSleepTimer(minutes: nil) }
                    }
                    Toggle("Floating mini-player bubble", isOn: $showBubble).tint(theme.accent).foregroundStyle(theme.text)
                }
                SectionTitle(text: "Privacy & offline")
                GlowCard {
                    toggle("Private mode (no history)", \.privateMode)
                    toggle("Smart offline mode", \.smartOfflineMode)
                    toggle("Auto-download lyrics", \.autoDownloadLyrics)
                    toggle("Downloads on Wi-Fi only", \.autoDownloadOnWifiOnly)
                    NeonChip(text: "Clear playback history") { model.library.clearHistory() }
                }
                SectionTitle(text: "AI")
                GlowCard {
                    Text("Commands work offline. Add your own Claude API key to ask anything; it is stored in the Keychain and never backed up. Song recognition uses Shazam.").font(.caption).foregroundStyle(theme.muted)
                    SecureField("Claude API key", text: $apiKey).textFieldStyle(.roundedBorder)
                    NeonChip(text: "Save key") { model.setApiKey(apiKey.isEmpty ? nil : apiKey); message = "Saved" }
                }
                SectionTitle(text: "Backup & restore")
                GlowCard {
                    Text("Same format as the Android app — back up on one phone, restore on the other.").font(.caption).foregroundStyle(theme.muted)
                    Picker("", selection: $merge) { Text("Merge").tag(true); Text("Replace").tag(false) }.pickerStyle(.segmented)
                    HStack { NeonChip(text: "Back up") { exporting = true }; NeonChip(text: "Restore") { importing = true } }
                }
                SectionTitle(text: "Library")
                HStack {
                    NeonChip(text: "Rescan") { model.library.rescan() }
                    NeonChip(text: "Allow Apple Music library") { MPMediaLibrary.requestAuthorization { _ in DispatchQueue.main.async { model.library.rescan() } } }
                }
                if let m = message { Text(m).font(.caption).foregroundStyle(theme.accent) }
                NeonLogo().frame(maxWidth: .infinity).padding(.top, 20)
            }.padding(16).padding(.bottom, 120)
        }
        .onAppear { apiKey = model.settings.assistantApiKey ?? "" }
        .fileExporter(isPresented: $exporting, document: BackupDocument(data: (try? model.exportBackup()) ?? Data()), contentType: .json, defaultFilename: "nocternal-backup") { r in
            if case .failure(let e) = r { message = e.localizedDescription } else { message = "Backup saved" }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { r in
            guard case .success(let url) = r else { return }
            let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
            do { let d = try Data(contentsOf: url); let unmatched = try model.restoreBackup(d, merge: merge); message = "Restored" + (unmatched > 0 ? " · \(unmatched) songs not on this device" : "") }
            catch { message = error.localizedDescription }
        }
    }
}

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
