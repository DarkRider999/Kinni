import SwiftUI
import NocternalModel

struct RootView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    @State private var tab = 0
    @State private var assistantOpen = false
    @State private var showBubble = false

    var body: some View {
        ZStack {
            NeonBackground()
            TabView(selection: $tab) {
                HomeView(openPlayer: { tab = 1 }).tag(0).tabItem { Label("Home", systemImage: "house.fill") }
                PlayerView(openAssistant: { assistantOpen = true }).tag(1).tabItem { Label("Player", systemImage: "play.circle.fill") }
                LightingView().tag(2).tabItem { Label("Lighting", systemImage: "lightbulb.fill") }
                SettingsView(showBubble: $showBubble).tag(3).tabItem { Label("Settings", systemImage: "gearshape.fill") }
            }
            .tint(theme.accent)
            .safeAreaInset(edge: .bottom) { if audio.current != nil && tab != 1 { MiniPlayer { tab = 1 }.padding(.bottom, 52) } }
            if tab != 1 {
                VStack { Spacer(); HStack { Spacer(); VoiceOrbButton(size: 60) { assistantOpen = true }.padding(.trailing, 18).padding(.bottom, audio.current != nil ? 130 : 70) } }
            }
            if showBubble { FloatingBubble(openApp: { tab = 1 }, close: { showBubble = false }) }
            EdgeLightingOverlay(settings: model.lighting.edge, spectrum: audio.spectrum)
        }
        .sheet(isPresented: $assistantOpen) { AssistantView().presentationDetents([.large]).presentationBackground(theme.backgroundColor) }
    }
}

struct MiniPlayer: View {
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    let open: () -> Void
    var body: some View {
        if let t = audio.current {
            HStack(spacing: 10) {
                NeonArtView(spec: .generate(for: t)).frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading) {
                    Text(t.title).font(.subheadline.bold()).lineLimit(1).foregroundStyle(theme.text)
                    Text(t.artist).font(.caption).lineLimit(1).foregroundStyle(theme.muted)
                }
                Spacer()
                Button { audio.togglePlay() } label: { Image(systemName: audio.isPlaying ? "pause.fill" : "play.fill").foregroundStyle(theme.accent) }
                Button { audio.next() } label: { Image(systemName: "forward.fill").foregroundStyle(theme.text) }
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 18).fill(theme.surface))
            .neonGlow(theme.accent, theme.glow * (0.4 + 0.6 * Double(audio.spectrum.bass)))
            .padding(.horizontal, 12)
            .onTapGesture(perform: open)
        }
    }
}

/// iOS does not allow drawing over other apps, so the floating mini-player bubble floats over this app's UI
/// (and the lock screen / Dynamic Island use the system Now Playing controls).
struct FloatingBubble: View {
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    let openApp: () -> Void
    let close: () -> Void
    @State private var offset = CGSize(width: 0, height: 200)
    @State private var expanded = false
    var body: some View {
        HStack {
            Circle().fill(LinearGradient(colors: [theme.accent, theme.secondary], startPoint: .top, endPoint: .bottom)).frame(width: 56, height: 56)
                .overlay(Image(systemName: "music.note").foregroundStyle(.black))
                .onTapGesture { expanded.toggle() }.onTapGesture(count: 2, perform: openApp)
            if expanded {
                Button { audio.togglePlay() } label: { Image(systemName: audio.isPlaying ? "pause.fill" : "play.fill") }
                Button { audio.next() } label: { Image(systemName: "forward.fill") }
                Button(action: close) { Image(systemName: "xmark") }
            }
        }
        .foregroundStyle(theme.accent).padding(4).background(Capsule().fill(theme.surface))
        .neonGlow(theme.accent, theme.glow * (0.5 + 0.5 * Double(audio.spectrum.bass)))
        .offset(offset)
        .gesture(DragGesture().onChanged { offset = CGSize(width: $0.translation.width, height: 200 + $0.translation.height) })
    }
}

struct VoiceOrbButton: View {
    @EnvironmentObject var theme: ThemeState
    var size: CGFloat = 80
    var level: Double = 0
    var listening = false
    let action: () -> Void
    @State private var pulse = false
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(RadialGradient(colors: [theme.accent.opacity(0.5 * theme.glow), .clear], center: .center, startRadius: 0, endRadius: size * 0.7))
                    .scaleEffect(listening ? 1 + level * 0.4 : (pulse ? 1.1 : 0.9))
                Circle().fill(AngularGradient(colors: [theme.accent, theme.secondary, theme.accent], center: .center)).frame(width: size * 0.7, height: size * 0.7)
                Circle().fill(.black.opacity(0.35)).frame(width: size * 0.42, height: size * 0.42)
                Image(systemName: listening ? "waveform" : "sparkles").foregroundStyle(.white)
            }.frame(width: size, height: size)
        }
        .buttonStyle(.plain)
        .onAppear { withAnimation(.easeInOut(duration: 1.2).repeatForever()) { pulse = true } }
    }
}
