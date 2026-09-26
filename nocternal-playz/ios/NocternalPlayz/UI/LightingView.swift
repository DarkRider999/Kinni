import SwiftUI
import NocternalModel
import ThemeManager

/// Lighting (spec §5/§6/§10): light bar, edge lighting, animation grid and theme presets.
struct LightingView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var audio: AudioEngine
    private let swatches = ["#00F0FF", "#FF00E5", "#8F00FF", "#00A3FF", "#00F5A0", "#B6FF00", "#FFC940", "#FF1744", "#FFFFFF"].map { NeonColor(hex: $0) }
    private var preview: SpectrumFrame {
        audio.isPlaying ? audio.spectrum : SpectrumFrame(bands: (0..<32).map { i in Float(0.35 + 0.3 * pow(sin(Double(i) * 0.5), 2)) }, bass: 0.5, mid: 0.45, treble: 0.5, level: 0.45, beat: false)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Lighting").font(.title2.bold()).foregroundStyle(theme.text)
                if let d = model.themeDecision { Text("Theme: \(d.preset.name) · \(d.reason)").font(.caption.monospaced()).foregroundStyle(theme.accent) }
                SectionTitle(text: "Light bar")
                GlowCard {
                    NeonLightBar(settings: model.lighting.lightBar, spectrum: preview)
                    Toggle("Enabled", isOn: Binding(get: { model.settings.lightBar.enabled }, set: { model.settings.lightBar.enabled = $0 })).tint(theme.accent)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            NeonChip(text: "Auto", selected: model.settings.lightBar.color == nil) { model.settings.lightBar.color = nil }
                            ForEach(swatches, id: \.self) { c in
                                Circle().fill(c.color).frame(width: 32, height: 32).overlay(Circle().stroke(.white, lineWidth: model.settings.lightBar.color == c ? 3 : 0))
                                    .onTapGesture { model.settings.lightBar.color = c }
                            }
                        }
                    }
                    HStack { Text("Glow intensity").foregroundStyle(theme.muted); Slider(value: Binding(get: { model.settings.lightBar.glowIntensity }, set: { model.settings.lightBar.glowIntensity = $0 })).tint(theme.accent) }
                }
                SectionTitle(text: "Edge lighting")
                GlowCard {
                    Toggle("Enabled", isOn: Binding(get: { model.settings.edgeLighting.enabled }, set: { model.settings.edgeLighting.enabled = $0 })).tint(theme.accent)
                    Picker("Mode", selection: Binding(get: { model.lighting.edge.mode }, set: { model.settings.edgeLighting.mode = $0; model.settings.edgeLighting.customMode = true })) {
                        ForEach([EdgeLightingMode.staticGlow, .gradient, .musicReactive], id: \.self) { Text($0.label).tag($0) }
                    }.pickerStyle(.segmented)
                    HStack { Text("Thickness").foregroundStyle(theme.muted); Slider(value: Binding(get: { model.lighting.edge.thickness }, set: { model.settings.edgeLighting.thickness = $0; model.settings.edgeLighting.brightness = model.lighting.edge.brightness; model.settings.edgeLighting.customStyle = true }), in: 1...12).tint(theme.accent) }
                    HStack { Text("Brightness").foregroundStyle(theme.muted); Slider(value: Binding(get: { model.lighting.edge.brightness }, set: { model.settings.edgeLighting.brightness = $0; model.settings.edgeLighting.thickness = model.lighting.edge.thickness; model.settings.edgeLighting.customStyle = true })).tint(theme.accent) }
                }
                if model.settings.edgeLighting.customStyle || model.settings.edgeLighting.customMode {
                    NeonChip(text: "Follow genre theme again") { model.settings.edgeLighting.customStyle = false; model.settings.edgeLighting.customMode = false }
                }
                SectionTitle(text: "Animations")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(LightingAnimation.allCases, id: \.self) { a in
                        VStack(alignment: .leading, spacing: 4) {
                            LightingCanvas(animation: a, spectrum: preview, primary: theme.accent, secondary: theme.secondary, intensity: 0.9).frame(height: 110).background(.black)
                            Text(a.label).font(.caption.monospaced()).foregroundStyle(model.lighting.lightBar.animation == a ? theme.accent : theme.text).padding(6)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(model.lighting.lightBar.animation == a ? theme.accent : theme.muted.opacity(0.3), lineWidth: model.lighting.lightBar.animation == a ? 2 : 1))
                        .onTapGesture { model.settings.lightBar.animation = a; model.settings.lightBar.customAnimation = true }
                    }
                }
                Toggle("Full-screen visualizer behind the player", isOn: Binding(get: { model.lighting.backdrop }, set: { model.lighting.backdrop = $0 })).tint(theme.accent)
                SectionTitle(text: "Neon theme presets")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(ThemePresets.all) { p in
                        GlowCard(glow: p.accent.color) {
                            HStack { Circle().fill(p.accent.color).frame(width: 14); Circle().fill(p.secondaryAccent.color).frame(width: 14) }.frame(height: 14)
                            Text(p.name).font(.subheadline).foregroundStyle(theme.text)
                            Text(p.lightBarAnimation.label).font(.caption2).foregroundStyle(theme.muted)
                        }.onTapGesture { model.switcher.handle(.manualThemeSelected(p.id)) }
                    }
                }
                NeonChip(text: "Resume automatic themes") { model.switcher.handle(.manualLockReleased) }
            }.padding(16).padding(.bottom, 120)
        }
    }
}
