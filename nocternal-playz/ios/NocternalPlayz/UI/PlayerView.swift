import SwiftUI
import NocternalModel
import LyricsEngine
import AIAssistant
import ThemeManager
import FXEngine

/// Player (spec §10): album art with neon frame, waveform seek bar, neon controls, light bar, lyrics.
struct PlayerView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    @EnvironmentObject var library: LibraryStore
    let openAssistant: () -> Void
    @State private var showLyrics = false
    @State private var showEq = false

    var body: some View {
        let t = audio.current
        VStack(spacing: 14) {
            HStack {
                VStack(alignment: .leading) {
                    Text("NOW PLAYING").font(.caption.monospaced()).foregroundStyle(theme.accent)
                    Text((t?.source.label ?? "") + (audio.autoMix ? " · DJ auto-mix" : "")).font(.caption2).foregroundStyle(theme.muted)
                }
                Spacer()
                Button { showLyrics.toggle() } label: { Image(systemName: "quote.bubble").foregroundStyle(showLyrics ? theme.accent : theme.text) }
            }
            if showLyrics {
                LyricsPanel(lyrics: model.lyrics, positionMs: audio.positionMs) { audio.seek(to: $0) }
            } else {
                ZStack {
                    if let t { NeonArtView(spec: .generate(for: t)) } else { Color.black }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 28))
                .overlay(RoundedRectangle(cornerRadius: 28).stroke(AngularGradient(colors: [theme.accent, theme.secondary, theme.accent], center: .center, angle: .degrees(Double(audio.spectrum.bass) * 40)), lineWidth: 3 + 4 * CGFloat(audio.spectrum.bass)))
                .neonGlow(theme.accent, theme.glow * (0.6 + 0.6 * Double(audio.spectrum.bass)), radius: 20)
                .padding(.horizontal, 24)
            }
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(t?.title ?? "Nothing playing").font(.title3.bold()).lineLimit(1).foregroundStyle(theme.text)
                    Text(t?.artist ?? "Pick a song, a genre or a station").lineLimit(1).foregroundStyle(theme.muted)
                    let meta = [t?.bpm.map { "\(Int($0)) BPM" }, t?.camelotKey.map { "Key \($0)" }].compactMap { $0 }
                    if !meta.isEmpty { Text(meta.joined(separator: " · ")).font(.caption.monospaced()).foregroundStyle(theme.accent) }
                }
                Spacer()
                if let t { Button { library.toggleFavorite(t.id) } label: { Image(systemName: library.data.favorites.contains(t.id) ? "heart.fill" : "heart").font(.title2).foregroundStyle(theme.secondary) } }
            }
            WaveformSeekBar(trackId: t?.id ?? "", positionMs: audio.positionMs, durationMs: t?.durationMs ?? 0, bass: Double(audio.spectrum.bass)) { audio.seek(to: $0) }
            HStack(spacing: 26) {
                ControlButton(icon: "shuffle", active: audio.shuffle) { audio.shuffle.toggle() }
                ControlButton(icon: "backward.fill") { audio.previous() }
                Button { audio.togglePlay() } label: {
                    Image(systemName: audio.isPlaying ? "pause.fill" : "play.fill").font(.system(size: 34)).foregroundStyle(.black)
                        .frame(width: 78, height: 78).background(Circle().fill(LinearGradient(colors: [theme.accent, theme.secondary], startPoint: .topLeading, endPoint: .bottomTrailing)))
                        .neonGlow(theme.accent, theme.glow * (0.7 + 0.3 * Double(audio.spectrum.bass)))
                }
                ControlButton(icon: "forward.fill") { audio.next() }
                ControlButton(icon: audio.repeatMode == .one ? "repeat.1" : "repeat", active: audio.repeatMode != .off) {
                    audio.repeatMode = audio.repeatMode == .off ? .all : audio.repeatMode == .all ? .one : .off
                }
            }
            HStack(spacing: 22) {
                ControlButton(icon: "slider.vertical.3") { showEq = true }
                Menu {
                    ForEach([15, 30, 45, 60, 90], id: \.self) { m in Button("\(m) min") { audio.setSleepTimer(minutes: m) } }
                    if audio.sleepRemaining != nil { Button("Cancel timer", role: .destructive) { audio.setSleepTimer(minutes: nil) } }
                } label: { Image(systemName: "moon.zzz.fill").foregroundStyle(audio.sleepRemaining != nil ? theme.accent : theme.text).frame(width: 40, height: 40) }
                ControlButton(icon: "dial.medium", active: audio.autoMix) { audio.autoMix.toggle() }
                ControlButton(icon: "sparkles", action: openAssistant)
            }
            NeonLightBar(settings: model.lighting.lightBar, spectrum: audio.spectrum)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background { if model.lighting.backdrop { LightingCanvas(animation: model.lighting.lightBar.animation, spectrum: audio.spectrum, primary: theme.accent, secondary: theme.secondary, intensity: 0.35).ignoresSafeArea() } }
        .sheet(isPresented: $showEq) { EQView().presentationBackground(theme.backgroundColor) }
    }
}

struct ControlButton: View {
    @EnvironmentObject var theme: ThemeState
    let icon: String; var active = false; let action: () -> Void
    init(icon: String, active: Bool = false, action: @escaping () -> Void) { self.icon = icon; self.active = active; self.action = action }
    var body: some View {
        Button(action: action) {
            Image(systemName: icon).foregroundStyle(active ? theme.accent : theme.text).frame(width: 44, height: 44)
                .background(Circle().fill(active ? theme.accent.opacity(0.2) : theme.surface)).overlay(Circle().stroke(theme.accent.opacity(active ? 1 : 0.35)))
        }.buttonStyle(.plain)
    }
}

struct WaveformSeekBar: View {
    @EnvironmentObject var theme: ThemeState
    let trackId: String; let positionMs: Int64; let durationMs: Int64; let bass: Double
    let onSeek: (Int64) -> Void
    @State private var drag: Double?
    var body: some View {
        let frac = drag ?? (durationMs > 0 ? min(max(Double(positionMs) / Double(durationMs), 0), 1) : 0)
        let bars = Self.bars(for: trackId)
        VStack(spacing: 4) {
            GeometryReader { geo in
                Canvas { ctx, size in
                    let w = size.width / Double(bars.count)
                    for (i, v) in bars.enumerated() {
                        let x = Double(i) * w + w / 2, played = (Double(i) + 0.5) / Double(bars.count) <= frac
                        let atHead = abs((Double(i) + 0.5) / Double(bars.count) - frac) < 1 / Double(bars.count)
                        let h = size.height * v * (atHead ? 1 + bass * 0.4 : 1) * 0.8
                        var p = Path(); p.move(to: CGPoint(x: x, y: size.height / 2 - h / 2)); p.addLine(to: CGPoint(x: x, y: size.height / 2 + h / 2))
                        ctx.stroke(p, with: played ? .linearGradient(Gradient(colors: [theme.accent, theme.secondary]), startPoint: .zero, endPoint: CGPoint(x: size.width, y: 0)) : .color(theme.muted.opacity(0.35)), style: StrokeStyle(lineWidth: w * 0.55, lineCap: .round))
                    }
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { drag = min(max($0.location.x / geo.size.width, 0), 1) }
                    .onEnded { _ in if let d = drag { onSeek(Int64(d * Double(durationMs))) }; drag = nil })
            }.frame(height: 56)
            HStack {
                Text(fmt(Int64(frac * Double(durationMs)))).font(.caption2.monospaced()).foregroundStyle(theme.muted)
                Spacer()
                Text(durationMs > 0 ? fmt(durationMs) : "LIVE").font(.caption2.monospaced()).foregroundStyle(durationMs > 0 ? theme.muted : theme.accent)
            }
        }
    }
    /// Stable per-track pseudo-waveform.
    static func bars(for id: String) -> [Double] {
        var seed = UInt64(truncatingIfNeeded: id.utf8.reduce(7) { $0 &* 31 &+ Int($1) })
        return (0..<64).map { i in
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return (0.25 + 0.75 * abs(sin(Double(i) * 0.37 + Double(seed >> 40) / Double(1 << 24)))) * (0.6 + 0.4 * Double(seed >> 52) / 4096)
        }
    }

    private func fmt(_ ms: Int64) -> String { let s = ms / 1000; return String(format: "%d:%02d", s / 60, s % 60) }
}

struct LyricsPanel: View {
    @EnvironmentObject var theme: ThemeState
    let lyrics: Lyrics?; let positionMs: Int64; let onSeek: (Int64) -> Void
    var body: some View {
        if let l = lyrics {
            let pos = LrcParser.position(l, at: positionMs)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(Array(l.lines.enumerated()), id: \.offset) { i, line in
                            karaoke(line, active: i == pos.line, word: pos.word)
                                .font(i == pos.line ? .title2.bold() : .title3)
                                .foregroundStyle(i == pos.line ? theme.accent : (i < pos.line ? theme.muted : theme.text.opacity(0.7)))
                                .multilineTextAlignment(.center).id(i)
                                .onTapGesture { if l.synced { onSeek(line.startMs) } }
                        }
                    }.padding(.vertical, 120)
                }
                .onChange(of: pos.line) { _, n in withAnimation { proxy.scrollTo(max(n, 0), anchor: .center) } }
            }
        } else {
            Text("No lyrics yet — they download automatically when you're online.").foregroundStyle(theme.muted).frame(maxHeight: .infinity)
        }
    }

    private func karaoke(_ line: LyricsLine, active: Bool, word: Int) -> Text {
        guard active, !line.words.isEmpty else { return Text(line.text) }
        return line.words.enumerated().reduce(Text("")) { acc, e in
            acc + Text(e.element.text + " ").foregroundColor(e.offset <= word ? theme.accent : theme.text)
        }
    }
}

/// EQ & FX (spec §10): 10 sliders, presets, FX grid, AI optimize, enhancer.
struct EQView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    private let labels = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("EQ & FX").font(.title2.bold()).foregroundStyle(theme.text)
                GlowCard {
                    HStack(alignment: .bottom, spacing: 4) {
                        ForEach(0..<10, id: \.self) { i in
                            VStack {
                                Text(String(format: "%+.0f", audio.fx.eqGains[i])).font(.caption2.monospaced()).foregroundStyle(theme.accent)
                                Slider(value: Binding(get: { audio.fx.eqGains[i] }, set: { audio.fx.eqGains[i] = ($0 * 2).rounded() / 2 }), in: -12...12)
                                    .rotationEffect(.degrees(-90)).frame(width: 180, height: 26).frame(width: 26, height: 180).tint(theme.accent)
                                Text(labels[i]).font(.system(size: 9).monospaced()).foregroundStyle(theme.muted)
                            }.frame(maxWidth: .infinity)
                        }
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(EqPresets.all) { p in NeonChip(text: p.name, selected: audio.fx.eqGains == p.bandGainsDb) { audio.applyPreset(p) } } }
                }
                Button {
                    let (p, _) = EqAdvisor.recommend(audio.current, route: .speaker)
                    audio.applyPreset(p)
                } label: {
                    Label("AI optimize for this song", systemImage: "sparkles").font(.headline).foregroundStyle(.black).frame(maxWidth: .infinity).padding(12)
                        .background(Capsule().fill(LinearGradient(colors: [theme.accent, theme.secondary], startPoint: .leading, endPoint: .trailing)))
                }
                SectionTitle(text: "Enhance")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(EnhancerModeList.all, id: \.self) { m in NeonChip(text: m.label) { _ = model.run([.enhance(m)]) } } }
                }
                SectionTitle(text: "Sound")
                fxSlider("Preamp", $audio.fx.preampDb, -12...12)
                fxSlider("Bass boost", $audio.fx.bassBoost, 0...1)
                fxSlider("Reverb", $audio.fx.reverbWet, 0...1)
                fxSlider("Pitch (semitones)", $audio.fx.pitchSemitones, -12...12)
                fxSlider("Stereo width", Binding(get: { Double(audio.fx.custom.stereoWidth) }, set: { audio.fx.custom.stereoWidth = Float($0) }), 0...2)
                fxSlider("3D surround", Binding(get: { Double(audio.fx.custom.surround) }, set: { audio.fx.custom.surround = Float($0) }), 0...1)
                SectionTitle(text: "FX grid")
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3)) {
                    tile("Compressor", audio.fx.compressor) { audio.fx.compressor.toggle() }
                    tile("Flanger", audio.fx.custom.flangerMix > 0) { audio.fx.custom.flangerMix = audio.fx.custom.flangerMix > 0 ? 0 : 0.6 }
                    tile("Phaser", audio.fx.custom.phaserMix > 0) { audio.fx.custom.phaserMix = audio.fx.custom.phaserMix > 0 ? 0 : 0.7 }
                    tile("Vocal remover", audio.fx.custom.vocalRemover > 0) { audio.fx.custom.vocalRemover = audio.fx.custom.vocalRemover > 0 ? 0 : 1 }
                    tile("Noise gate", audio.fx.custom.noiseReduction > 0) { audio.fx.custom.noiseReduction = audio.fx.custom.noiseReduction > 0 ? 0 : 0.6 }
                    tile("Reset", false) { audio.applyPreset(EqPresets.flat); audio.fx = AudioEngine.FxState() }
                }
            }.padding(20)
        }
    }

    private func fxSlider(_ label: String, _ value: Binding<Double>, _ range: ClosedRange<Double>) -> some View {
        HStack {
            Text(label).frame(width: 120, alignment: .leading).foregroundStyle(theme.text)
            Slider(value: value, in: range).tint(theme.accent)
            Text(String(format: "%.1f", value.wrappedValue)).font(.caption.monospaced()).foregroundStyle(theme.accent).frame(width: 40)
        }
    }

    private func tile(_ name: String, _ on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading) { Text(name).font(.subheadline.bold()); Text(on ? "ON" : "OFF").font(.caption2) }
                .foregroundStyle(on ? theme.accent : theme.text).frame(maxWidth: .infinity, minHeight: 56, alignment: .leading).padding(10)
                .background(RoundedRectangle(cornerRadius: 16).fill(theme.surface)).overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.accent.opacity(on ? 1 : 0.25)))
        }.buttonStyle(.plain)
    }
}

enum EnhancerModeList { static let all = EnhancerMode.allCases }
