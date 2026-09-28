package com.subzero.messenger.call

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Drives one call's lifecycle and exposes it as observable [CallSession] state.
 *
 * Signaling ([SignalingMessage]) is handed to [sendSignaling], which the app
 * wires to the encrypted transport (E2E via CryptoEngine, same channel style as
 * chat). Inbound signaling is delivered via [onSignaling]. Media flows through
 * the injected [RtcEngine].
 */
class CallManager(
    private val engine: RtcEngine,
    private val sendSignaling: (SignalingMessage) -> Unit,
) : RtcEngine.Listener {

    private val _session = MutableStateFlow(CallSession())
    val session: StateFlow<CallSession> = _session.asStateFlow()

    // --- outgoing / incoming setup ---

    fun placeCall(peerName: String, type: CallType) {
        _session.value = CallSession(peerName, type, CallDirection.OUTGOING, CallPhase.DIALING)
        engine.start(type, asCaller = true, listener = this)
    }

    fun receiveIncoming(peerName: String, type: CallType) {
        _session.value = CallSession(peerName, type, CallDirection.INCOMING, CallPhase.RINGING)
    }

    fun acceptIncoming() {
        _session.value = _session.value.copy(phase = CallPhase.CONNECTING)
        engine.start(_session.value.type, asCaller = false, listener = this)
    }

    fun declineOrHangup() {
        sendSignaling(SignalingMessage.Hangup)
        engine.close()
        _session.value = _session.value.copy(phase = CallPhase.ENDED)
    }

    // --- in-call controls ---

    fun toggleMute() {
        val muted = !_session.value.micMuted
        engine.setMicMuted(muted)
        _session.value = _session.value.copy(micMuted = muted)
    }

    fun toggleVideo() {
        val on = !_session.value.videoEnabled
        engine.setVideoEnabled(on)
        _session.value = _session.value.copy(videoEnabled = on)
    }

    fun switchCamera() {
        engine.switchCamera()
        _session.value = _session.value.copy(frontCamera = !_session.value.frontCamera)
    }

    // --- inbound signaling from the peer ---

    fun onSignaling(message: SignalingMessage) {
        when (message) {
            is SignalingMessage.Offer -> {
                receiveIncoming(_session.value.peerName.ifEmpty { "Unknown" }, message.type)
                engine.acceptRemoteOffer(message.sdp)
            }
            is SignalingMessage.Answer -> engine.acceptRemoteAnswer(message.sdp)
            is SignalingMessage.IceCandidate ->
                engine.addRemoteIce(message.sdpMid, message.sdpMLineIndex, message.candidate)
            SignalingMessage.Hangup -> { engine.close(); _session.value = _session.value.copy(phase = CallPhase.ENDED) }
        }
    }

    // --- RtcEngine.Listener ---

    override fun onLocalSdp(sdp: String) {
        val s = _session.value
        sendSignaling(
            if (s.direction == CallDirection.OUTGOING) SignalingMessage.Offer(sdp, s.type)
            else SignalingMessage.Answer(sdp)
        )
    }

    override fun onIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
        sendSignaling(SignalingMessage.IceCandidate(sdpMid, sdpMLineIndex, candidate))
    }

    override fun onConnected() {
        _session.value = _session.value.copy(phase = CallPhase.CONNECTED, startedAtMillis = System.currentTimeMillis())
    }

    override fun onEnded() {
        _session.value = _session.value.copy(phase = CallPhase.ENDED)
    }

    fun reset() { _session.value = CallSession() }
}
