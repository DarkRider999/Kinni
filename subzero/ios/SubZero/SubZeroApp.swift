import SwiftUI
import LocalAuthentication

@main
struct SubZeroApp: App {
    @StateObject private var buffer = RamMessageBuffer()
    @StateObject private var safeZone: SafeZoneController
    @State private var locked = true
    @Environment(\.scenePhase) private var scenePhase

    private let conversationId = "demo-conversation"

    init() {
        let buf = RamMessageBuffer()
        let picker = SafeZonePicker(enabled: Set(SafeZoneScreen.allCases))
        _buffer = StateObject(wrappedValue: buf)
        _safeZone = StateObject(wrappedValue: SafeZoneController(
            buffer: buf, picker: picker,
            onAutoLock: { IdentityManager.rotateRandom() }  // rotate identity after auto-lock
        ))
    }

    var body: some Scene {
        WindowGroup {
            RootView(buffer: buffer, safeZone: safeZone,
                     conversationId: conversationId, locked: $locked)
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { locked = true }  // re-lock on background
                }
        }
    }
}

struct RootView: View {
    @ObservedObject var buffer: RamMessageBuffer
    @ObservedObject var safeZone: SafeZoneController
    let conversationId: String
    @Binding var locked: Bool

    @StateObject private var chatVM: ChatViewModel

    init(buffer: RamMessageBuffer, safeZone: SafeZoneController,
         conversationId: String, locked: Binding<Bool>) {
        self.buffer = buffer; self.safeZone = safeZone
        self.conversationId = conversationId; self._locked = locked
        _chatVM = StateObject(wrappedValue: ChatViewModel(conversationId: conversationId, buffer: buffer))
    }

    var body: some View {
        Group {
            if locked {
                LockGate(locked: $locked)
            } else if let screen = safeZone.activeScreen {
                SafeZoneHostView(screen: screen) { safeZone.exit() }
            } else {
                ChatView(viewModel: chatVM, buffer: buffer) {
                    safeZone.activate(conversationId: conversationId)
                }
            }
        }
    }
}

/// Biometric unlock gate (Face ID / Touch ID).
struct LockGate: View {
    @Binding var locked: Bool
    var body: some View {
        Color(red: 0.043, green: 0.059, blue: 0.078).ignoresSafeArea()
            .onAppear(perform: authenticate)
    }
    private func authenticate() {
        let ctx = LAContext()
        var error: NSError?
        if ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                               localizedReason: "Unlock SubZero") { success, _ in
                DispatchQueue.main.async { if success { locked = false } }
            }
        } else {
            locked = false  // no biometrics enrolled (documented limitation)
        }
    }
}

/// Renders the chosen SafeZone screen full-bleed with a hidden double-tap return
/// gesture in the top-right corner.
struct SafeZoneHostView: View {
    let screen: SafeZoneScreen
    let onReturn: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            content
            // Hidden return target: double-tap top-right corner.
            Color.clear.frame(width: 60, height: 60)
                .contentShape(Rectangle())
                .onTapGesture(count: 2, perform: onReturn)
        }
    }

    @ViewBuilder private var content: some View {
        switch screen {
        case .calculator: CalculatorView()
        case .ticTacToe: TicTacToeView()
        // TODO(subzero): 2048, Snake, Memory, etc. + Notes/Weather decoys.
        default: CalculatorView()
        }
    }
}
