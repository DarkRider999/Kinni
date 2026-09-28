import Foundation
import Combine

enum CallType { case audio, video }
enum CallDirection { case outgoing, incoming }
enum CallPhase { case idle, dialing, ringing, connecting, connected, ended }

struct CallSession {
    var peerName = ""
    var type: CallType = .audio
    var direction: CallDirection = .outgoing
    var phase: CallPhase = .idle
    var micMuted = false
    var videoEnabled = true
    var frontCamera = true
    var startedAt: Date?
}

/// WebRTC signaling, E2E-encrypted (via the Double Ratchet) before it leaves the
/// device — the signaling server never sees SDP/ICE in the clear.
enum SignalingMessage {
    case offer(sdp: String, type: CallType)
    case answer(sdp: String)
    case ice(sdpMid: String, sdpMLineIndex: Int, candidate: String)
    case hangup
}

/// Media-transport abstraction. `WebRtcEngine` (backed by GoogleWebRTC /
/// WebRTC.framework) plugs in here; `LoopbackRtcEngine` runs the UI without it.
protocol RtcEngine: AnyObject {
    var onLocalSdp: ((String) -> Void)? { get set }
    var onConnected: (() -> Void)? { get set }
    var onEnded: (() -> Void)? { get set }
    func start(type: CallType, asCaller: Bool)
    func acceptRemoteOffer(_ sdp: String)
    func acceptRemoteAnswer(_ sdp: String)
    func setMicMuted(_ muted: Bool)
    func setVideoEnabled(_ enabled: Bool)
    func switchCamera()
    func close()
}

/// Dependency-free demo engine: fakes local SDP then reports connected so the
/// call UI is exercisable today. Moves no real media.
final class LoopbackRtcEngine: RtcEngine {
    var onLocalSdp: ((String) -> Void)?
    var onConnected: (() -> Void)?
    var onEnded: (() -> Void)?

    func start(type: CallType, asCaller: Bool) {
        onLocalSdp?("v=0\r\n<demo-loopback-sdp>")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in self?.onConnected?() }
    }
    func acceptRemoteOffer(_ sdp: String) { onLocalSdp?("v=0\r\n<demo-loopback-answer>") }
    func acceptRemoteAnswer(_ sdp: String) {}
    func setMicMuted(_ muted: Bool) {}
    func setVideoEnabled(_ enabled: Bool) {}
    func switchCamera() {}
    func close() { onEnded?() }
}

/// Drives one call's lifecycle and publishes it for SwiftUI.
final class CallManager: ObservableObject {
    @Published var session = CallSession()
    private let engine: RtcEngine
    private let sendSignaling: (SignalingMessage) -> Void

    init(engine: RtcEngine, sendSignaling: @escaping (SignalingMessage) -> Void) {
        self.engine = engine
        self.sendSignaling = sendSignaling
        engine.onLocalSdp = { [weak self] sdp in
            guard let self else { return }
            self.sendSignaling(self.session.direction == .outgoing ? .offer(sdp: sdp, type: self.session.type) : .answer(sdp: sdp))
        }
        engine.onConnected = { [weak self] in
            self?.session.phase = .connected
            self?.session.startedAt = Date()
        }
        engine.onEnded = { [weak self] in self?.session.phase = .ended }
    }

    func placeCall(_ peer: String, type: CallType) {
        session = CallSession(peerName: peer, type: type, direction: .outgoing, phase: .dialing)
        engine.start(type: type, asCaller: true)
    }
    func acceptIncoming() { session.phase = .connecting; engine.start(type: session.type, asCaller: false) }
    func hangup() { sendSignaling(.hangup); engine.close(); session.phase = .ended }
    func toggleMute() { session.micMuted.toggle(); engine.setMicMuted(session.micMuted) }
    func toggleVideo() { session.videoEnabled.toggle(); engine.setVideoEnabled(session.videoEnabled) }
    func switchCamera() { session.frontCamera.toggle(); engine.switchCamera() }
    func reset() { session = CallSession() }
}
