import SwiftUI
import NocternalModel
import ThemeManager

extension NeonColor { var color: Color { Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha) } }

/// Visual theme state, the iOS ThemeManager + BackgroundManager sink for the theme switcher.
final class ThemeState: ObservableObject, ThemeManaging, BackgroundManaging {
    @Published var accent = ThemePresets.nocternalDefault.accent.color
    @Published var secondary = ThemePresets.nocternalDefault.secondaryAccent.color
    @Published var glow = ThemePresets.nocternalDefault.glowIntensity
    @Published var mode: ThemeMode = .neon
    @Published var background: BackgroundStyle = .deepSpace

    func setAccentColor(_ c: NeonColor) { onMain { withAnimation(.easeInOut(duration: 0.6)) { self.accent = c.color } } }
    func setSecondaryAccentColor(_ c: NeonColor) { onMain { withAnimation(.easeInOut(duration: 0.6)) { self.secondary = c.color } } }
    func setGlowIntensity(_ v: Double) { onMain { self.glow = v } }
    func setThemeMode(_ m: ThemeMode) { onMain { self.mode = m } }
    func setStyle(_ s: BackgroundStyle) { onMain { self.background = s } }

    var backgroundColor: Color {
        switch mode {
        case .amoled: return .black
        case .neon: return Color(red: 10 / 255, green: 10 / 255, blue: 15 / 255)
        case .dark: return Color(red: 0.07, green: 0.07, blue: 0.09)
        case .light: return Color(red: 0.96, green: 0.96, blue: 0.98)
        }
    }
    var surface: Color { mode == .light ? .white : Color(red: 0.08, green: 0.08, blue: 0.11) }
    var text: Color { mode == .light ? Color(white: 0.07) : Color(red: 0.95, green: 0.95, blue: 1) }
    var muted: Color { mode == .light ? Color(white: 0.4) : Color(red: 0.54, green: 0.54, blue: 0.63) }
}

/// Lighting state, the iOS LightingEngine sink.
final class LightingState: ObservableObject, LightingEngine {
    @Published var lightBar = LightBarSettings()
    @Published var edge = EdgeLightingSettings()
    @Published var backdrop = false

    func setEdgeMode(_ m: EdgeLightingMode) { onMain { self.edge.mode = m; self.edge.enabled = m != .off } }
    func setEdgeStyle(thickness: Double, brightness: Double) { onMain { self.edge.thickness = thickness; self.edge.brightness = brightness } }
    func setLightBarAnimation(_ a: LightingAnimation) { onMain { self.lightBar.animation = a } }
}

func onMain(_ block: @escaping () -> Void) { if Thread.isMainThread { block() } else { DispatchQueue.main.async(execute: block) } }

// MARK: Neon components

struct NeonGlow: ViewModifier {
    let color: Color; let intensity: Double; var radius: CGFloat = 14
    func body(content: Content) -> some View {
        content.shadow(color: color.opacity(0.6 * intensity), radius: radius).shadow(color: color.opacity(0.3 * intensity), radius: radius * 2)
    }
}
extension View { func neonGlow(_ c: Color, _ i: Double, radius: CGFloat = 14) -> some View { modifier(NeonGlow(color: c, intensity: i, radius: radius)) } }

struct GlowCard<Content: View>: View {
    @EnvironmentObject var theme: ThemeState
    var glow: Color? = nil
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 20).fill(theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(LinearGradient(colors: [(glow ?? theme.accent), theme.secondary.opacity(0.4)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1))
            .neonGlow(glow ?? theme.accent, theme.glow * 0.4)
    }
}

struct NeonChip: View {
    @EnvironmentObject var theme: ThemeState
    let text: String; var selected = false; let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text).font(.subheadline).padding(.horizontal, 14).padding(.vertical, 8)
                .foregroundStyle(selected ? theme.accent : theme.text)
                .background(Capsule().fill(selected ? theme.accent.opacity(0.2) : theme.surface))
                .overlay(Capsule().stroke(theme.accent.opacity(selected ? 1 : 0.35)))
        }.buttonStyle(.plain)
    }
}

struct NeonLogo: View {
    @EnvironmentObject var theme: ThemeState
    var body: some View {
        VStack(spacing: 0) {
            Text("NOCTERNAL PLAYZ").font(.system(size: 24, weight: .black)).kerning(4)
                .foregroundStyle(LinearGradient(colors: [theme.accent, theme.secondary], startPoint: .leading, endPoint: .trailing))
                .neonGlow(theme.accent, theme.glow)
            Text("by Roshan").font(.caption2.monospaced()).foregroundStyle(theme.muted)
        }
    }
}

struct SectionTitle: View {
    @EnvironmentObject var theme: ThemeState
    let text: String
    var body: some View { Text(text.uppercased()).font(.caption.monospaced()).kerning(1.5).foregroundStyle(theme.accent).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 8) }
}

/// Animated background for the theme's BackgroundStyle.
struct NeonBackground: View {
    @EnvironmentObject var theme: ThemeState
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(theme.backgroundColor))
                func blob(_ c: Color, _ p: CGPoint, _ r: CGFloat) {
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .radialGradient(Gradient(colors: [c, .clear]), center: p, startRadius: 0, endRadius: r))
                }
                switch theme.background {
                case .amoledBlack: break
                case .deepSpace, .softGlow: blob(theme.accent.opacity(0.12), CGPoint(x: size.width * 0.2, y: size.height * 0.15), size.width)
                case .nebula, .auroraHaze, .sacredMandala:
                    blob(theme.accent.opacity(0.18), CGPoint(x: size.width * (0.3 + 0.1 * sin(t / 4)), y: size.height * 0.25), size.width)
                    blob(theme.secondary.opacity(0.15), CGPoint(x: size.width * 0.8, y: size.height * (0.7 + 0.05 * cos(t / 4))), size.width)
                case .starfield, .rainGlass:
                    for i in 0..<80 {
                        let x = Double((i * 7919) % 1000) / 1000, speed = 0.02 + Double(i % 7) / 100
                        let y = (Double((i * 104729) % 1000) / 1000 + t * speed).truncatingRemainder(dividingBy: 1)
                        ctx.fill(Path(ellipseIn: CGRect(x: x * size.width, y: y * size.height, width: 2, height: theme.background == .rainGlass ? 14 : 2)), with: .color(.white.opacity(0.35)))
                    }
                case .gridHorizon:
                    let horizon = size.height * 0.55
                    for i in 0...14 {
                        let f = ((Double(i) + t.truncatingRemainder(dividingBy: 4)) / 14).truncatingRemainder(dividingBy: 1)
                        var p = Path(); let y = horizon + (size.height - horizon) * f * f
                        p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: size.width, y: y))
                        ctx.stroke(p, with: .color(theme.accent.opacity(0.1 + 0.25 * f)), lineWidth: 1.5)
                    }
                }
            }
        }.ignoresSafeArea()
    }
}
