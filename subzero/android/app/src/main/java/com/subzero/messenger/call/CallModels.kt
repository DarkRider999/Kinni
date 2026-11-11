package com.subzero.messenger.call

/** Audio-only or audio+video. */
enum class CallType { AUDIO, VIDEO }

enum class CallDirection { OUTGOING, INCOMING }

/** Lifecycle of a single call. */
enum class CallPhase { IDLE, DIALING, RINGING, CONNECTING, CONNECTED, ENDED }

data class CallSession(
    val peerName: String = "",
    val type: CallType = CallType.AUDIO,
    val direction: CallDirection = CallDirection.OUTGOING,
    val phase: CallPhase = CallPhase.IDLE,
    val micMuted: Boolean = false,
    val videoEnabled: Boolean = true,
    val frontCamera: Boolean = true,
    val startedAtMillis: Long = 0L,
)

/**
 * WebRTC signaling exchanged with the peer to set up media. These are serialized
 * and **end-to-end encrypted through the existing [com.subzero.messenger.crypto.CryptoEngine]**
 * before they leave the device, so the signaling server never sees SDP or ICE in
 * the clear (sealed signaling).
 */
sealed class SignalingMessage {
    data class Offer(val sdp: String, val type: CallType) : SignalingMessage()
    data class Answer(val sdp: String) : SignalingMessage()
    data class IceCandidate(val sdpMid: String, val sdpMLineIndex: Int, val candidate: String) : SignalingMessage()
    object Hangup : SignalingMessage()
}
