import Foundation
import NocternalModel

/// Radix-2 FFT (in place) + Hann window.
public struct FFT {
    public let size: Int
    let window: [Float]
    public init(size: Int) {
        precondition(size > 1 && size & (size - 1) == 0)
        self.size = size
        window = (0..<size).map { Float(0.5 - 0.5 * cos(2 * Double.pi * Double($0) / Double(size - 1))) }
    }

    public func magnitudes(_ input: [Float]) -> [Float] {
        var re = (0..<size).map { i in (i < input.count ? input[i] : 0) * window[i] }
        var im = [Float](repeating: 0, count: size)
        var j = 0
        for i in 1..<size {
            var bit = size >> 1
            while j & bit != 0 { j ^= bit; bit >>= 1 }
            j ^= bit
            if i < j { re.swapAt(i, j); im.swapAt(i, j) }
        }
        var len = 2
        while len <= size {
            let ang = -2 * Double.pi / Double(len)
            for start in stride(from: 0, to: size, by: len) {
                for k in 0..<(len / 2) {
                    let wr = Float(cos(ang * Double(k))), wi = Float(sin(ang * Double(k)))
                    let a = start + k, b = a + len / 2
                    let xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr
                    re[b] = re[a] - xr; im[b] = im[a] - xi
                    re[a] += xr; im[a] += xi
                }
            }
            len <<= 1
        }
        return (0..<(size / 2)).map { sqrt(re[$0] * re[$0] + im[$0] * im[$0]) }
    }
}

/// Live spectrum for the lighting engine (same banding and beat logic as Kotlin `SpectrumAnalyzer`).
public final class SpectrumAnalyzer {
    private let fft: FFT
    private var ring: [Float]
    private var write = 0
    private var smooth = [Float](repeating: 0, count: SpectrumFrame.bandCount)
    private var edges: [Int] = []
    private var bassAvg: Float = 0, lastBass: Float = 0, hold = 0
    private let lock = NSLock()

    public init(sampleRate: Double, fftSize: Int = 1024) {
        fft = FFT(size: fftSize)
        ring = [Float](repeating: 0, count: fftSize)
        let binHz = sampleRate / Double(fftSize), lo = 30.0, hi = min(16000, sampleRate / 2 - binHz)
        edges = (0...SpectrumFrame.bandCount).map { i in max(1, min(fftSize / 2 - 1, Int(lo * pow(hi / lo, Double(i) / Double(SpectrumFrame.bandCount)) / binHz))) }
        for i in 1..<edges.count where edges[i] <= edges[i - 1] { edges[i] = edges[i - 1] + 1 }
    }

    public func push(left: UnsafePointer<Float>, right: UnsafePointer<Float>, frames: Int) {
        lock.lock(); defer { lock.unlock() }
        for i in 0..<frames { ring[write] = (left[i] + right[i]) * 0.5; write = (write + 1) % ring.count }
    }

    public func compute() -> SpectrumFrame {
        lock.lock()
        let snap = Array(ring[write...] + ring[..<write])
        lock.unlock()
        let mags = fft.magnitudes(snap)
        var bands = [Float](repeating: 0, count: SpectrumFrame.bandCount)
        for b in 0..<bands.count {
            var peak: Float = 0
            for k in edges[b]..<min(max(edges[b + 1], edges[b] + 1), mags.count) { peak = max(peak, mags[k]) }
            let db = 20 * log10(peak / Float(fft.size / 4) + 1e-9) + Float(b) * 0.25
            let v = min(max((db + 70) / 70, 0), 1)
            smooth[b] = v > smooth[b] ? v : smooth[b] * 0.85 + v * 0.15
            bands[b] = smooth[b]
        }
        let third = bands.count / 3
        func avg(_ s: ArraySlice<Float>) -> Float { s.reduce(0, +) / Float(max(s.count, 1)) }
        let bass = avg(bands[0..<(third / 2 + 2)]), mid = avg(bands[third..<(2 * third)]), treble = avg(bands[(2 * third)...])
        bassAvg = bassAvg * 0.95 + bass * 0.05
        let flux = bass - lastBass; lastBass = bass
        let beat = hold == 0 && flux > 0.04 && bass > bassAvg * 1.15 && bass > 0.3
        hold = beat ? 6 : max(0, hold - 1)
        return SpectrumFrame(bands: bands, bass: bass, mid: mid, treble: treble, level: avg(bands[...]), beat: beat)
    }
}

/// Smart normalization gain toward −14 LUFS (ReplayGain reference −18).
public enum LoudnessNormalizer {
    public static func gainDb(replayGainDb: Double?, measuredLoudnessDb: Double?, targetDb: Double = -14) -> Double {
        let g: Double
        if let rg = replayGainDb { g = rg + (targetDb + 18) } else if let m = measuredLoudnessDb { g = targetDb - m } else { g = 0 }
        return min(max(g, -12), 12)
    }
}

/// AI Song Enhancer modes, identical to Android.
public enum EnhancerMode: String, CaseIterable, Sendable {
    case clarity, noiseRemoval, bassEnhancement, vocalFocus, oldRecording
    public var label: String {
        switch self {
        case .clarity: return "Clarity"
        case .noiseRemoval: return "Noise removal"
        case .bassEnhancement: return "Bass enhancement"
        case .vocalFocus: return "Vocal focus"
        case .oldRecording: return "Restore old recording"
        }
    }
    /// EQ offsets (10 bands) added by this mode.
    public var eqOffsets: [Double] {
        switch self {
        case .clarity: return [0, 0, -1, -2, -1, 0, 2, 3, 3, 2]
        case .noiseRemoval: return [-2, -1, 0, 0, 0, 0, 0, -1, -3, -6]
        case .bassEnhancement: return [2, 2, 1, -1, 0, 0, 0, 0, 0, 0]
        case .vocalFocus: return [-3, -2, -1, 0, 1, 3, 3, 2, 0, -1]
        case .oldRecording: return [1, 2, 2, 1, 0, 0, 1, 1, -1, -3]
        }
    }
}

/// Tempo estimate from a spectral-flux onset envelope + autocorrelation (same method as Android).
public enum BpmDetector {
    public static func detect(_ mono: [Float], sampleRate: Double) -> Double? {
        let n = 1024, hop = 512
        guard mono.count > n * 4 else { return nil }
        let fft = FFT(size: n)
        var prev = [Float](repeating: 0, count: n / 2), env: [Float] = []
        var i = 0
        while i + n <= mono.count {
            let cur = fft.magnitudes(Array(mono[i..<(i + n)]))
            var flux: Float = 0
            for k in 1..<(n / 2) { let d = log(1 + 100 * cur[k]) - log(1 + 100 * prev[k]); if d > 0 { flux += d } }
            env.append(flux); prev = cur; i += hop
        }
        var avg = env.first ?? 0
        env = env.map { v in avg = avg * 0.9 + v * 0.1; return max(0, v - avg) }
        let fps = sampleRate / Double(hop)
        let minLag = max(1, Int(fps * 60 / 200)), maxLag = min(env.count - 2, Int(fps * 60 / 60))
        guard maxLag > minLag else { return nil }
        var ac = [Float](repeating: 0, count: maxLag + 2)
        for lag in minLag...(maxLag + 1) where lag < env.count {
            var s: Float = 0
            for j in 0..<(env.count - lag) { s += env[j] * env[j + lag] }
            ac[lag] = s / Float(env.count - lag)
        }
        var best = -1, bestScore: Float = 0
        for lag in minLag...maxLag {
            let bpm = 60 * fps / Double(lag)
            let prior = Float(exp(-0.5 * pow(log2(bpm / 120) / 0.9, 2)))
            let harmonic: Float = 2 * lag < ac.count ? ac[2 * lag] * 0.5 : 0
            let score = (ac[lag] + harmonic) * prior
            if score > bestScore { bestScore = score; best = lag }
        }
        guard best > 0 else { return nil }
        let y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1], den = y0 - 2 * y1 + y2
        let shift = abs(den) > 1e-12 ? min(max(0.5 * (y0 - y2) / den, -0.5), 0.5) : 0
        return 60 * fps / (Double(best) + Double(shift))
    }
}
