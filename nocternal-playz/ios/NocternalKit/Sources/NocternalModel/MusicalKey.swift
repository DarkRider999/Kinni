import Foundation

/// Musical key ↔ Camelot wheel (same maths as the Kotlin `MusicalKey`).
public struct MusicalKey: Codable, Hashable, Sendable {
    public let pitchClass: Int
    public let minor: Bool
    public init(_ pitchClass: Int, minor: Bool) { self.pitchClass = ((pitchClass % 12) + 12) % 12; self.minor = minor }

    public static let names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    static let alternates = ["Db": 1, "D#": 3, "Gb": 6, "G#": 8, "A#": 10, "Cb": 11, "E#": 5, "Fb": 4, "B#": 0]

    public var camelotNumber: Int {
        let majorPc = minor ? (pitchClass + 3) % 12 : pitchClass
        return ((majorPc * 7 % 12) + 7) % 12 + 1
    }
    public var camelot: String { "\(camelotNumber)\(minor ? "A" : "B")" }
    public var name: String { MusicalKey.names[pitchClass] + (minor ? "m" : "") }

    public static func fromCamelot(_ code: String) -> MusicalKey? {
        let c = code.trimmingCharacters(in: .whitespaces).uppercased()
        guard let last = c.last, last == "A" || last == "B", let n = Int(c.dropLast()), (1...12).contains(n) else { return nil }
        let majorPc = ((n - 8 + 12) % 12) * 7 % 12
        return last == "A" ? MusicalKey((majorPc + 9) % 12, minor: true) : MusicalKey(majorPc, minor: false)
    }

    public static func parse(_ text: String) -> MusicalKey? {
        let t = text.trimmingCharacters(in: .whitespaces)
        guard let first = t.first else { return nil }
        if first.isNumber { return fromCamelot(t) }
        let chars = Array(t)
        let rootLen = chars.count >= 2 && (chars[1] == "#" || chars[1] == "b") ? 2 : 1
        let root = String(chars[0]).uppercased() + String(chars[1..<rootLen])
        guard let pc = names.firstIndex(of: root) ?? alternates[root] else { return nil }
        let rest = String(chars[rootLen...]).trimmingCharacters(in: .whitespaces).lowercased()
        return MusicalKey(pc, minor: rest.hasPrefix("m") && !rest.hasPrefix("maj"))
    }
}
