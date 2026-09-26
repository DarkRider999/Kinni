package com.subzero.messenger.data

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Relay client. Implements both [ChatRepository.Transport] (opaque ciphertext
 * envelopes) and [ChatRepository.Directory] (publish/fetch public prekey
 * bundles) over one WebSocket to the SubZero relay. The relay only ever sees the
 * routing address and opaque payloads — never plaintext or keys.
 */
class WebSocketTransport(
    private val url: String,
    private val selfAddress: String,
    private val peerAddress: String,
) : ChatRepository.Transport, ChatRepository.Directory {

    private val client = OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build()
    private var socket: WebSocket? = null
    private var envelopeHandler: ((String) -> Unit)? = null
    private var bundleHandler: ((String) -> Unit)? = null
    private val pending = ArrayDeque<String>()

    init { connect() }

    private fun connect() {
        socket = client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(JSONObject().put("t", "reg").put("address", selfAddress).toString())
                while (pending.isNotEmpty()) webSocket.send(pending.removeFirst())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val obj = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (obj.optString("t")) {
                    "env" -> if (obj.optString("kind") == "message")
                        envelopeHandler?.invoke(obj.optString("payload"))
                    "bundle" -> obj.optString("bundle").takeIf { it.isNotEmpty() }?.let { bundleHandler?.invoke(it) }
                }
            }
        })
    }

    private fun emit(frame: String) {
        val s = socket
        if (s == null || !s.send(frame)) pending.addLast(frame)
    }

    // Transport
    override fun send(envelope: String) {
        emit(JSONObject().put("t", "env").put("to", peerAddress).put("kind", "message").put("payload", envelope).toString())
    }

    override fun onReceive(handler: (String) -> Unit) { envelopeHandler = handler }

    // Directory
    override fun publish(bundleWire: String) {
        emit(JSONObject().put("t", "bundle").put("address", selfAddress).put("bundle", bundleWire).toString())
    }

    override fun requestPeerBundle() {
        emit(JSONObject().put("t", "getBundle").put("address", peerAddress).toString())
    }

    override fun onPeerBundle(handler: (String) -> Unit) { bundleHandler = handler }

    fun close() { socket?.close(1000, null); client.dispatcher.executorService.shutdown() }
}
