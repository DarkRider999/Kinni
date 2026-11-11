package com.subzero.messenger.call

/**
 * Media-transport abstraction for calls. The call state machine ([CallManager])
 * talks only to this interface, so the WebRTC implementation is a swappable
 * detail.
 *
 * A production [WebRtcEngine] wraps `PeerConnectionFactory` / `PeerConnection`
 * from the WebRTC library: it creates the local audio/video tracks, generates
 * the SDP offer/answer, and emits ICE candidates through [Listener]. Media is
 * encrypted in transit by WebRTC's mandatory DTLS-SRTP; the SDP/ICE signaling on
 * top is additionally E2E-encrypted by [CallManager] before it hits the network.
 *
 * A [LoopbackRtcEngine] is provided so the full call UI and state machine run
 * today without the native WebRTC dependency or a signaling server (the same way
 * chat runs against a stub transport). TODO(subzero): add WebRtcEngine + a
 * signaling server to carry live media between two phones.
 */
interface RtcEngine {

    interface Listener {
        fun onLocalSdp(sdp: String)
        fun onIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String)
        fun onConnected()
        fun onEnded()
    }

    fun start(type: CallType, asCaller: Boolean, listener: Listener)
    fun acceptRemoteOffer(sdp: String)
    fun acceptRemoteAnswer(sdp: String)
    fun addRemoteIce(sdpMid: String, sdpMLineIndex: Int, candidate: String)
    fun setMicMuted(muted: Boolean)
    fun setVideoEnabled(enabled: Boolean)
    fun switchCamera()
    fun close()
}

/**
 * Dependency-free demo engine: it immediately produces a fake local SDP and,
 * shortly after, reports "connected" so the UI can be exercised end to end. It
 * moves no real media. Swap for WebRtcEngine to place real calls.
 */
class LoopbackRtcEngine : RtcEngine {
    private var listener: RtcEngine.Listener? = null

    override fun start(type: CallType, asCaller: Boolean, listener: RtcEngine.Listener) {
        this.listener = listener
        listener.onLocalSdp("v=0\r\n<demo-loopback-sdp>")
        // Simulate the peer connecting after signaling would have completed.
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            listener.onConnected()
        }, 1200)
    }

    override fun acceptRemoteOffer(sdp: String) { listener?.onLocalSdp("v=0\r\n<demo-loopback-answer>") }
    override fun acceptRemoteAnswer(sdp: String) {}
    override fun addRemoteIce(sdpMid: String, sdpMLineIndex: Int, candidate: String) {}
    override fun setMicMuted(muted: Boolean) {}
    override fun setVideoEnabled(enabled: Boolean) {}
    override fun switchCamera() {}
    override fun close() { listener?.onEnded(); listener = null }
}
