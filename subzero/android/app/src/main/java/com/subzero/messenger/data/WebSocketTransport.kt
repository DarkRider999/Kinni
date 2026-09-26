package com.subzero.messenger.data

import android.util.Base64
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Delivers end-to-end-encrypted envelopes over the SubZero relay
 * ([RelayConfig]). The ratchet header and ciphertext are base64-wrapped into an
 * opaque payload — the relay never sees plaintext or keys, only routing.
 *
 * Reconnects are handled by re-creating the transport; this class keeps one live
 * socket and re-registers on open, flushing any queued outbound frames.
 */
class WebSocketTransport(
    private val url: String,
    private val selfAddress: String,
    private val peerAddress: String,
    private val conversationId: String,
) : ChatRepository.Transport {

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private var socket: WebSocket? = null
    private var handler: ((String, ByteArray, ByteArray) -> Unit)? = null
    private val pending = ArrayDeque<String>()

    init { connect() }

    private fun connect() {
        val request = Request.Builder().url(url).build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(JSONObject().put("t", "reg").put("address", selfAddress).toString())
                while (pending.isNotEmpty()) webSocket.send(pending.removeFirst())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val obj = runCatching { JSONObject(text) }.getOrNull() ?: return
                if (obj.optString("t") != "env" || obj.optString("kind") != "message") return
                val payload = runCatching { JSONObject(String(b64d(obj.getString("payload")))) }.getOrNull() ?: return
                val header = b64d(payload.getString("h"))
                val ciphertext = b64d(payload.getString("c"))
                handler?.invoke(conversationId, header, ciphertext)
            }
        })
    }

    override fun send(conversationId: String, header: ByteArray, ciphertext: ByteArray) {
        val payload = JSONObject().put("h", b64e(header)).put("c", b64e(ciphertext)).toString()
        val frame = JSONObject()
            .put("t", "env").put("to", peerAddress).put("kind", "message")
            .put("payload", b64e(payload.toByteArray()))
            .toString()
        val s = socket
        if (s == null || !s.send(frame)) pending.addLast(frame)
    }

    override fun onReceive(handler: (String, ByteArray, ByteArray) -> Unit) {
        this.handler = handler
    }

    fun close() { socket?.close(1000, null); client.dispatcher.executorService.shutdown() }

    private fun b64e(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun b64d(s: String) = Base64.decode(s, Base64.NO_WRAP)
}
