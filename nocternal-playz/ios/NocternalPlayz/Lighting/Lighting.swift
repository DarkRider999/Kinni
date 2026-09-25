import SwiftUI
import NocternalModel

/// The ten lighting animations (spec §6) drawn with SwiftUI Canvas. Same visual logic as Android's
/// `LightingAnimations`: bass drives flashes/size, mids drive ribbons/twist, treble spawns stars.
struct LightingCanvas: View {
    let animation: LightingAnimation
    let spectrum: SpectrumFrame
    var primary: Color
    var secondary: Color
    var intensity: Double = 1
    @State private var pulse: Double = 0

    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in draw(&ctx, size, t) }
        }
        .onChange(of: spectrum.beat) { _, beat in if beat { pulse = 1; withAnimation(.easeOut(duration: 0.35)) { pulse = 0 } } }
        .clipped()
    }

    private func band(_ i: Int) -> Double { Double(spectrum.bands[min(max(i, 0), spectrum.bands.count - 1)]) }
    private func mix(_ a: Color, _ b: Color, _ k: Double) -> Color { k < 0.5 ? a : b }

    private func draw(_ ctx: inout GraphicsContext, _ size: CGSize, _ t: Double) {
        let c = CGPoint(x: size.width / 2, y: size.height / 2)
        let bass = Double(spectrum.bass), mid = Double(spectrum.mid), level = Double(spectrum.level), treble = Double(spectrum.treble)
        func circle(_ p: CGPoint, _ r: Double) -> Path { Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)) }
        switch animation {
        case .pulseWaveSpectrum:
            let maxR = max(size.width, size.height) * 0.6
            for i in 0..<6 {
                let f = (t * 0.35 + Double(i) / 6).truncatingRemainder(dividingBy: 1), b = band(i * 5)
                ctx.stroke(circle(c, maxR * f * (0.7 + 0.5 * b)), with: .color(mix(primary, secondary, f).opacity((1 - f) * (0.3 + 0.7 * b) * intensity)), lineWidth: 2 + 10 * b * (1 - f))
            }
        case .hyperBeamEdgeFlow:
            let per = 2 * (size.width + size.height), speed = 0.25 + level * 0.8
            for beam in 0..<3 {
                let head = ((t * speed + Double(beam) / 3).truncatingRemainder(dividingBy: 1)) * per
                for k in 0..<24 {
                    let d = (head - per * 0.18 * (0.5 + mid) * Double(k) / 24).truncatingRemainder(dividingBy: per)
                    let p = perimeter((d + per).truncatingRemainder(dividingBy: per), size)
                    ctx.fill(circle(p, 3 + 5 * (1 - Double(k) / 24) * (0.5 + bass)), with: .color((beam % 2 == 0 ? primary : secondary).opacity((1 - Double(k) / 24) * intensity)))
                }
            }
        case .auroraRibbon:
            for r in 0..<3 {
                var p = Path()
                let base = size.height * (0.35 + Double(r) * 0.15), amp = size.height * (0.06 + 0.18 * mid) * (1 - Double(r) * 0.2)
                for s in 0...48 {
                    let x = size.width * Double(s) / 48, y = base + amp * sin(Double(s) / 48 * .pi * 3 + t * (0.6 + Double(r) * 0.2) + Double(r))
                    if s == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
                }
                let col = r % 2 == 0 ? primary : secondary
                ctx.stroke(p, with: .color(col.opacity(0.35 * intensity)), style: StrokeStyle(lineWidth: 18 + 30 * mid, lineCap: .round))
                ctx.stroke(p, with: .color(col.opacity(0.9 * intensity)), lineWidth: 2)
            }
        case .bassShockFlash:
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(primary.opacity(0.45 * pulse * intensity)))
            ctx.stroke(circle(c, max(size.width, size.height) * (1.1 - pulse) * 0.7), with: .color(secondary.opacity(pulse * intensity)), lineWidth: 6 + 24 * pulse)
            ctx.fill(circle(c, min(size.width, size.height) * 0.4), with: .radialGradient(Gradient(colors: [primary.opacity(bass * intensity), .clear]), center: c, startRadius: 0, endRadius: min(size.width, size.height) * 0.4))
        case .prismCycle:
            let hue = (t * (20 + 120 * level)).truncatingRemainder(dividingBy: 360)
            let colors = (0..<8).map { Color(hue: ((hue + Double($0) * 45).truncatingRemainder(dividingBy: 360)) / 360, saturation: 1, brightness: 1).opacity(0.55 * intensity) }
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .conicGradient(Gradient(colors: colors), center: c))
            ctx.fill(circle(c, min(size.width, size.height) * (0.35 - 0.1 * bass)), with: .color(.black.opacity(0.55)))
        case .vortexSpiral:
            let rot = t * (0.7 + 3.5 * level), twist = 3 + 4 * mid
            for a in 0..<5 {
                var p = Path()
                for s in 0...60 {
                    let f = Double(s) / 60, ang = Double(a) * 2 * .pi / 5 + f * twist + rot, r = f * max(size.width, size.height) * 0.55
                    let pt = CGPoint(x: c.x + cos(ang) * r, y: c.y + sin(ang) * r)
                    if s == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
                ctx.stroke(p, with: .color((a % 2 == 0 ? primary : secondary).opacity(intensity)), style: StrokeStyle(lineWidth: 3 + 8 * bass, lineCap: .round))
            }
        case .eqBarMirage:
            let n = spectrum.bands.count, w = size.width / Double(n), midY = size.height * 0.6
            for i in 0..<n {
                let h = midY * 0.9 * band(i), col = mix(primary, secondary, Double(i) / Double(n))
                ctx.fill(Path(CGRect(x: Double(i) * w + w * 0.15, y: midY - h, width: w * 0.7, height: h)), with: .linearGradient(Gradient(colors: [col.opacity(intensity), col.opacity(0.2 * intensity)]), startPoint: CGPoint(x: 0, y: midY - h), endPoint: CGPoint(x: 0, y: midY)))
                ctx.fill(Path(CGRect(x: Double(i) * w + w * 0.15 + sin(t * 6 + Double(i)) * 3, y: midY + 4, width: w * 0.7, height: h * 0.5)), with: .color(col.opacity(0.18 * intensity)))
            }
        case .starfallReactive:
            for i in 0..<70 {
                let x = Double((i * 7919) % 997) / 997, speed = 0.05 + Double((i * 31) % 20) / 100 * (1 + 2 * level)
                let y = (Double((i * 104729) % 991) / 991 + t * speed).truncatingRemainder(dividingBy: 1)
                let bright = 0.3 + 0.7 * (treble > 0.45 && i % 3 == 0 ? 1 : 0.5)
                let p = CGPoint(x: x * size.width, y: y * size.height)
                var trail = Path(); trail.move(to: CGPoint(x: p.x, y: p.y - 40 * speed * 5)); trail.addLine(to: p)
                ctx.stroke(trail, with: .color(primary.opacity(bright * 0.6 * intensity)), lineWidth: 2)
                ctx.fill(circle(p, 2 + 2 * bright), with: .color(.white.opacity(bright * intensity)))
            }
        case .crystalGrid:
            let horizon = size.height * 0.3
            for r in 0...8 { for col in 0...8 {
                let depth = Double(r) / 8, y = horizon + (size.height - horizon) * depth * depth
                let x = size.width / 2 + (Double(col) - 4) / 8 * size.width * (0.3 + 0.7 * depth) * 1.4
                let b = band(col + r * 8 % spectrum.bands.count)
                ctx.fill(circle(CGPoint(x: x, y: y), 2 + 8 * b * depth), with: .color(mix(primary, secondary, b).opacity((0.2 + 0.8 * b) * intensity)))
            } }
        case .infinityLoop:
            let a = min(size.width, size.height) * (0.32 + 0.08 * level), breathe = 1 + 0.15 * sin(t * 1.2) + 0.2 * bass
            for k in 0..<80 {
                let s = t * 0.8 - Double(k) * 0.03, d = 1 + sin(s) * sin(s), fade = 1 - Double(k) / 80
                let p = CGPoint(x: c.x + a * breathe * cos(s) / d, y: c.y + a * breathe * sin(s) * cos(s) / d)
                ctx.fill(circle(p, 2 + 6 * fade), with: .color(mix(primary, secondary, Double(k) / 80).opacity(fade * intensity)))
            }
        }
    }

    private func perimeter(_ d: Double, _ s: CGSize) -> CGPoint {
        let w = s.width, h = s.height
        if d < w { return CGPoint(x: d, y: 0) }
        if d < w + h { return CGPoint(x: w, y: d - w) }
        if d < 2 * w + h { return CGPoint(x: w - (d - w - h), y: h) }
        return CGPoint(x: 0, y: h - (d - 2 * w - h))
    }
}

/// Neon light bar (spec §5A).
struct NeonLightBar: View {
    @EnvironmentObject var theme: ThemeState
    let settings: LightBarSettings
    let spectrum: SpectrumFrame
    var height: CGFloat = 52
    var body: some View {
        if settings.enabled {
            LightingCanvas(animation: settings.animation, spectrum: spectrum, primary: settings.color?.color ?? theme.accent, secondary: theme.secondary, intensity: settings.glowIntensity)
                .frame(height: height).clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }
}

/// Edge lighting around the screen (spec §5B): static, gradient or music reactive.
struct EdgeLightingOverlay: View {
    @EnvironmentObject var theme: ThemeState
    let settings: EdgeLightingSettings
    let spectrum: SpectrumFrame
    var body: some View {
        if settings.enabled && settings.mode != .off {
            TimelineView(.animation) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                let reactive = settings.mode == .musicReactive
                let level = reactive ? 0.35 + 0.65 * Double(spectrum.bass) : 1
                let width = settings.thickness * (reactive ? 0.7 + 0.6 * Double(spectrum.bass) : 1)
                let colors: [Color] = settings.mode == .staticGlow ? [theme.accent, theme.accent] : [theme.accent, theme.secondary, theme.accent, theme.secondary, theme.accent]
                let gradient = AngularGradient(colors: colors, center: .center, angle: .degrees(settings.mode == .gradient ? t * 40 : 0))
                ZStack {
                    RoundedRectangle(cornerRadius: 44).strokeBorder(gradient, lineWidth: width * 3).blur(radius: 12).opacity(0.5 * level * settings.brightness)
                    RoundedRectangle(cornerRadius: 44).strokeBorder(gradient, lineWidth: width).opacity(level * settings.brightness)
                }
            }
            .ignoresSafeArea().allowsHitTesting(false)
        }
    }
}
