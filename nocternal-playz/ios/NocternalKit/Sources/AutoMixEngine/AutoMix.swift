import Foundation
import NocternalModel

public enum KeyRelation: String, Sendable {
    case same, relative, adjacent, energyBoost, diagonal, clash, unknown
    public var score: Double {
        switch self {
        case .same: return 1
        case .relative: return 0.9
        case .adjacent: return 0.85
        case .energyBoost: return 0.6
        case .diagonal: return 0.5
        case .clash: return 0
        case .unknown: return 0.4
        }
    }
}

public enum Harmonic {
    public static func relation(_ a: MusicalKey?, _ b: MusicalKey?) -> KeyRelation {
        guard let a, let b else { return .unknown }
        let na = a.camelotNumber, nb = b.camelotNumber
        let d = abs(na - nb) % 12, step = min(d, 12 - d), sameMode = a.minor == b.minor
        if step == 0 { return sameMode ? .same : .relative }
        if step == 1 { return sameMode ? .adjacent : .diagonal }
        if step == 2 && sameMode && (nb - na + 12) % 12 == 2 { return .energyBoost }
        return .clash
    }
}

public struct TempoMatch: Sendable { public let ratio: Double; public let score: Double }

public enum Tempo {
    /// Playback-rate change for `next` to match `current`, allowing half/double time.
    public static func match(_ current: Double?, _ next: Double?, maxStretch: Double = 0.08) -> TempoMatch {
        guard let c = current, let n = next, c > 0, n > 0 else { return TempoMatch(ratio: 1, score: 0.4) }
        let best = [n, n * 2, n / 2].min { abs(c / $0 - 1) < abs(c / $1 - 1) }!
        let ratio = c / best, stretch = abs(ratio - 1)
        return stretch > maxStretch ? TempoMatch(ratio: 1, score: 0) : TempoMatch(ratio: ratio, score: 1 - stretch / maxStretch * 0.7)
    }
}

public enum CrossfadeCurve: Sendable { case linear, equalPower, sCurve }

public enum Crossfade {
    public static func gains(_ t: Double, _ curve: CrossfadeCurve) -> (outgoing: Double, incoming: Double) {
        let x = min(max(t, 0), 1)
        switch curve {
        case .linear: return (1 - x, x)
        case .equalPower: return (cos(x * .pi / 2), sin(x * .pi / 2))
        case .sCurve: let s = 0.5 - 0.5 * cos(.pi * x); return (1 - s, s)
        }
    }
}

/// 3 s fade-out + 3 s fade-in envelope (spec auto-fader).
public struct AutoFader: Sendable {
    public var fadeOutMs: Int64, fadeInMs: Int64
    public init(fadeOutMs: Int64 = 3000, fadeInMs: Int64 = 3000) { self.fadeOutMs = fadeOutMs; self.fadeInMs = fadeInMs }
    public func volume(at pos: Int64, duration: Int64) -> Double {
        guard duration > 0 else { return 1 }
        let fin = fadeInMs > 0 && pos < fadeInMs ? Double(pos) / Double(fadeInMs) : 1
        let remaining = duration - pos
        let fout = fadeOutMs > 0 && remaining < fadeOutMs ? Double(remaining) / Double(fadeOutMs) : 1
        return min(max(min(fin, fout), 0), 1)
    }
}

/// DJ auto-mix: next-track ranking by key, tempo and energy flow.
public struct AutoMixPlanner: Sendable {
    public init() {}
    public struct Candidate: Sendable { public let track: Track; public let score: Double; public let relation: KeyRelation; public let tempo: TempoMatch }

    public func rank(current: Track, pool: [Track], recentlyPlayed: Set<String> = []) -> [Candidate] {
        let ck = current.camelotKey.flatMap(MusicalKey.fromCamelot)
        return pool.filter { $0.id != current.id && !recentlyPlayed.contains($0.id) }.map { t in
            let rel = Harmonic.relation(ck, t.camelotKey.flatMap(MusicalKey.fromCamelot))
            let tempo = Tempo.match(current.bpm, t.bpm)
            let energy = 1 - abs((t.energy ?? 0.5) - (current.energy ?? 0.5))
            return Candidate(track: t, score: rel.score * 0.45 + tempo.score * 0.4 + energy * 0.15, relation: rel, tempo: tempo)
        }.sorted { $0.score > $1.score }
    }

    public func next(current: Track, pool: [Track], recentlyPlayed: Set<String> = []) -> Candidate? {
        rank(current: current, pool: pool, recentlyPlayed: recentlyPlayed).first
    }

    /// Blend length in ms: 8 or 16 bars at the current tempo, clamped.
    public func blendMs(from: Track, to: Track, defaultMs: Int64 = 3000) -> Int64 {
        guard let bpm = from.bpm, Tempo.match(from.bpm, to.bpm).score > 0 else { return defaultMs }
        let rel = Harmonic.relation(from.camelotKey.flatMap(MusicalKey.fromCamelot), to.camelotKey.flatMap(MusicalKey.fromCamelot))
        let bars = rel.score >= 0.85 ? 16.0 : 8.0
        return min(max(Int64(bars * 4 * 60000 / bpm), 2000), 16000)
    }
}
