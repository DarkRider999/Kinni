import SwiftUI

/// Full-screen call UI driven by CallManager. With the demo engine there is no
/// live video, so the areas render as themed placeholders.
struct CallView: View {
    @ObservedObject var manager: CallManager
    let onFinished: () -> Void
    @State private var elapsed = 0
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let neon = Color(red: 0.208, green: 0.878, blue: 0.769)

    private var status: String {
        switch manager.session.phase {
        case .dialing: return "Calling…"
        case .ringing: return "Incoming \(manager.session.type == .video ? "video" : "voice") call"
        case .connecting: return "Connecting…"
        case .connected: return String(format: "%02d:%02d", elapsed / 60, elapsed % 60)
        case .ended: return "Call ended"
        case .idle: return ""
        }
    }

    var body: some View {
        ZStack {
            Color(red: 0.027, green: 0.035, blue: 0.047).ignoresSafeArea()
            VStack(spacing: 14) {
                Spacer().frame(height: 72)
                ZStack {
                    Circle().fill(Color(red: 0.086, green: 0.125, blue: 0.169)).frame(width: 120, height: 120)
                    Text(manager.session.peerName.prefix(1).uppercased())
                        .font(.system(size: 52, weight: .bold)).foregroundColor(neon)
                }
                Text(manager.session.peerName.isEmpty ? "SubZero contact" : manager.session.peerName)
                    .font(.system(size: 26, weight: .semibold)).foregroundColor(.white)
                Text(status).foregroundColor(.gray)
                if manager.session.type == .video, manager.session.phase == .connected {
                    Text("🔒 End-to-end encrypted (DTLS-SRTP)").font(.caption).foregroundColor(neon)
                }
                Spacer()
                controls
                Spacer().frame(height: 40)
            }
        }
        .onReceive(timer) { _ in if manager.session.phase == .connected { elapsed += 1 } }
        .onChange(of: manager.session.phase) { _, p in
            if p == .ended { DispatchQueue.main.asyncAfter(deadline: .now() + 0.7, execute: onFinished) }
        }
    }

    @ViewBuilder private var controls: some View {
        if manager.session.phase == .ringing, manager.session.direction == .incoming {
            HStack(spacing: 60) {
                roundButton("Decline", .red) { manager.hangup() }
                roundButton("Accept", .green) { manager.acceptIncoming() }
            }
        } else {
            VStack(spacing: 28) {
                HStack(spacing: 24) {
                    toggle(manager.session.micMuted ? "Unmute" : "Mute", manager.session.micMuted) { manager.toggleMute() }
                    if manager.session.type == .video {
                        toggle(manager.session.videoEnabled ? "Video" : "Video off", !manager.session.videoEnabled) { manager.toggleVideo() }
                        toggle("Flip", false) { manager.switchCamera() }
                    }
                }
                roundButton("End", .red) { manager.hangup() }
            }
        }
    }

    private func roundButton(_ label: String, _ color: Color, _ action: @escaping () -> Void) -> some View {
        VStack(spacing: 6) {
            Button(action: action) {
                Text(label == "End" || label == "Decline" ? "✕" : "✓")
                    .font(.system(size: 26)).foregroundColor(.white)
                    .frame(width: 68, height: 68).background(color).clipShape(Circle())
            }
            Text(label).font(.system(size: 13)).foregroundColor(.white)
        }
    }

    private func toggle(_ label: String, _ active: Bool, _ action: @escaping () -> Void) -> some View {
        VStack(spacing: 6) {
            Button(action: action) {
                Text(String(label.prefix(1))).font(.system(size: 20))
                    .foregroundColor(active ? .black : .white)
                    .frame(width: 58, height: 58)
                    .background(active ? neon : Color(red: 0.106, green: 0.145, blue: 0.188)).clipShape(Circle())
            }
            Text(label).font(.system(size: 12)).foregroundColor(.gray)
        }
    }
}
