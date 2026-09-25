import Foundation
import NocternalModel

/// RBJ biquad (stereo, transposed direct form II). Same coefficients as Kotlin `Biquad`.
public struct Biquad {
    var b0 = 1.0, b1 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0
    var z1L = 0.0, z2L = 0.0, z1R = 0.0, z2R = 0.0
    public private(set) var isIdentity = true
    public init() {}

    mutating func set(_ nb0: Double, _ nb1: Double, _ nb2: Double, _ na0: Double, _ na1: Double, _ na2: Double) {
        b0 = nb0 / na0; b1 = nb1 / na0; b2 = nb2 / na0; a1 = na1 / na0; a2 = na2 / na0; isIdentity = false
    }
    public mutating func setIdentity() { b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; isIdentity = true }

    public mutating func setPeaking(fs: Double, f0: Double, q: Double, gainDb: Double) {
        if gainDb == 0 { setIdentity(); return }
        let a = pow(10, gainDb / 40), w = 2 * .pi * min(max(f0, 10), fs * 0.45) / fs, alpha = sin(w) / (2 * q)
        set(1 + alpha * a, -2 * cos(w), 1 - alpha * a, 1 + alpha / a, -2 * cos(w), 1 - alpha / a)
    }
    public mutating func setLowShelf(fs: Double, f0: Double, gainDb: Double) {
        if gainDb == 0 { setIdentity(); return }
        let a = pow(10, gainDb / 40), w = 2 * .pi * f0 / fs, alpha = sin(w) / 2 * sqrt(2.0), c = cos(w), s = 2 * sqrt(a) * alpha
        set(a * ((a + 1) - (a - 1) * c + s), 2 * a * ((a - 1) - (a + 1) * c), a * ((a + 1) - (a - 1) * c - s),
            (a + 1) + (a - 1) * c + s, -2 * ((a - 1) + (a + 1) * c), (a + 1) + (a - 1) * c - s)
    }
    public mutating func setLowPass(fs: Double, f0: Double, q: Double = 0.7071) {
        let w = 2 * .pi * f0 / fs, alpha = sin(w) / (2 * q), c = cos(w)
        set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha)
    }
    public mutating func processL(_ x: Float) -> Float {
        let xd = Double(x), y = b0 * xd + z1L
        z1L = b1 * xd - a1 * y + z2L; z2L = b2 * xd - a2 * y
        return Float(y)
    }
    public mutating func processR(_ x: Float) -> Float {
        let xd = Double(x), y = b0 * xd + z1R
        z1R = b1 * xd - a1 * y + z2R; z2R = b2 * xd - a2 * y
        return Float(y)
    }
    public func magnitudeDb(fs: Double, f: Double) -> Double {
        let w = 2 * .pi * f / fs
        let nr = b0 + b1 * cos(w) + b2 * cos(2 * w), ni = -(b1 * sin(w) + b2 * sin(2 * w))
        let dr = 1 + a1 * cos(w) + a2 * cos(2 * w), di = -(a1 * sin(w) + a2 * sin(2 * w))
        return 10 * log10((nr * nr + ni * ni) / (dr * dr + di * di))
    }
}

/// Settings for the custom effects that AVAudioEngine has no built-in unit for.
public struct CustomFxSettings: Equatable, Sendable {
    public var stereoWidth: Float = 1
    public var vocalRemover: Float = 0
    public var surround: Float = 0
    public var phaserMix: Float = 0
    public var flangerMix: Float = 0
    public var noiseReduction: Float = 0
    public var fader: Float = 1
    public var limiterCeilingDb: Float = -1
    public init() {}
}

/// Custom stereo DSP applied to decoded buffers before they are scheduled on the AVAudioPlayerNode:
/// vocal remover, stereo widener, 3D surround, flanger, phaser, noise gate, fader and a brick-wall limiter.
/// (EQ, bass shelf, reverb, compression and pitch use Apple's native audio units.)
public final class CustomFxProcessor {
    public var settings = CustomFxSettings()
    private var fs: Double = 48000
    private var vocalLP = Biquad()
    private var env: Float = 0
    private var flangerBuf = [Float](repeating: 0, count: 4096), flangerPos = 0
    private var phase: Double = 0
    private var apL = [Float](repeating: 0, count: 6), apR = [Float](repeating: 0, count: 6)
    private var gateEnv: Float = 0
    public init() {}

    public func prepare(sampleRate: Double) { fs = sampleRate; vocalLP.setLowPass(fs: fs, f0: 150) }

    /// Processes non-interleaved stereo (left/right pointers) in place.
    public func process(left: UnsafeMutablePointer<Float>, right: UnsafeMutablePointer<Float>, frames: Int) {
        let s = settings
        let ceiling = Float(pow(10, Double(s.limiterCeilingDb) / 20))
        let release = Float(exp(-1 / (0.08 * fs)))
        for i in 0..<frames {
            var l = left[i], r = right[i]
            if s.noiseReduction > 0 {
                let p = max(abs(l), abs(r)); gateEnv = max(p, gateEnv * 0.999)
                let thresh = Float(pow(10, (-55 + 15 * Double(s.noiseReduction)) / 20))
                if gateEnv < thresh { let g = (gateEnv / thresh) * (gateEnv / thresh); l *= g; r *= g }
            }
            if s.vocalRemover > 0 {
                let lowL = vocalLP.processL(l), lowR = vocalLP.processR(r)
                let hl = l - lowL, hr = r - lowR
                let mid = (hl + hr) * 0.5 * (1 - s.vocalRemover), side = (hl - hr) * 0.5 * (1 + 0.4 * s.vocalRemover)
                l = lowL + mid + side; r = lowR + mid - side
            }
            if s.flangerMix > 0 {
                phase += 2 * .pi * 0.25 / fs
                let delay = Int((0.001 + 0.0025 * (0.5 + 0.5 * sin(phase))) * fs)
                let idx = (flangerPos - delay + flangerBuf.count) % flangerBuf.count
                let y = flangerBuf[idx]
                flangerBuf[flangerPos] = (l + r) * 0.5 + y * 0.5
                flangerPos = (flangerPos + 1) % flangerBuf.count
                l += (y - l) * s.flangerMix * 0.5; r += (y - r) * s.flangerMix * 0.5
            }
            if s.phaserMix > 0 {
                phase += 2 * .pi * 0.5 / fs
                let f = 200 * pow(10, 0.5 + 0.4 * sin(phase)), t = tan(.pi * f / fs), a = Float((t - 1) / (t + 1))
                var yl = l, yr = r
                for k in 0..<6 {
                    let ol = a * yl + apL[k]; apL[k] = yl - a * ol; yl = ol
                    let or = a * yr + apR[k]; apR[k] = yr - a * or; yr = or
                }
                l += (yl - l) * s.phaserMix * 0.5; r += (yr - r) * s.phaserMix * 0.5
            }
            if s.stereoWidth != 1 || s.surround > 0 {
                let m = (l + r) * 0.5, side = (l - r) * 0.5 * s.stereoWidth * (1 + 0.6 * s.surround)
                l = m + side; r = m - side
            }
            l *= s.fader; r *= s.fader
            let peak = max(abs(l), abs(r))
            env = peak > env ? peak : peak + (env - peak) * release
            let g = env > ceiling ? ceiling / env : 1
            left[i] = min(max(l * g, -ceiling), ceiling)
            right[i] = min(max(r * g, -ceiling), ceiling)
        }
    }
}
