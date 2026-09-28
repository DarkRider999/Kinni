import Foundation
import Combine

/// SafeZone screen pool. Utility screens double as decoys; games live in
/// `Features/SafeZone`.
enum SafeZoneScreen: String, CaseIterable {
    case calculator, notes, weather
    case game2048, snake, ticTacToe, memory, slidingTiles
    case quickMath, patternMatch, wordShuffle, bubblePop

    var isGame: Bool {
        switch self {
        case .calculator, .notes, .weather: return false
        default: return true
        }
    }
}

/// Picks the next screen with the spec's rules: never repeat the previous
/// screen, and reshuffle the pool after each activation.
final class SafeZonePicker {
    private var pool: [SafeZoneScreen]
    private var last: SafeZoneScreen?
    private let enabled: Set<SafeZoneScreen>

    init(enabled: Set<SafeZoneScreen>) {
        self.enabled = enabled
        self.pool = enabled.shuffled()
    }

    func next() -> SafeZoneScreen {
        if pool.isEmpty { pool = enabled.shuffled() }
        var choice = pool.removeFirst()
        if choice == last, !pool.isEmpty {
            let alt = pool.removeFirst(); pool.append(choice); choice = alt
        }
        last = choice
        return choice
    }
}

/// Drives activation/exit and the auto-lock timeout.
final class SafeZoneController: ObservableObject {
    @Published var activeScreen: SafeZoneScreen?
    private let buffer: RamMessageBuffer
    private let picker: SafeZonePicker
    private let onAutoLock: () -> Void
    private let autoLockTimeout: TimeInterval
    private var activatedAt = Date.distantPast

    init(buffer: RamMessageBuffer, picker: SafeZonePicker,
         autoLockTimeout: TimeInterval = 60, onAutoLock: @escaping () -> Void) {
        self.buffer = buffer; self.picker = picker
        self.autoLockTimeout = autoLockTimeout; self.onAutoLock = onAutoLock
    }

    func activate(conversationId: String?) {
        if let id = conversationId { buffer.clearConversationView(id) }
        activatedAt = Date()
        activeScreen = picker.next()
    }

    func exit() {
        guard activeScreen != nil else { return }
        if Date().timeIntervalSince(activatedAt) > autoLockTimeout {
            activeScreen = nil; onAutoLock(); return
        }
        activeScreen = nil
    }
}
