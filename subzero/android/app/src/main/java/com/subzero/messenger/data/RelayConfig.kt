package com.subzero.messenger.data

/**
 * Where the app reaches the relay server, and who it is talking to.
 *
 * Leave [URL] blank to keep the app fully offline (default): no messages leave
 * the device. Set it to your deployed relay's `wss://…` address to enable
 * delivery between the two phones. [selfAddress] / [peerAddress] are the routing
 * labels each phone registers under (use any two agreed, hard-to-guess strings,
 * or a hash of each identity key). The server treats them as opaque.
 *
 * These live in code for a two-person build; a fuller app would collect them in
 * a first-run setup screen.
 */
object RelayConfig {
    const val URL: String = ""                 // e.g. "wss://subzero-relay.onrender.com"
    const val selfAddress: String = "device-a" // set differently on each phone
    const val peerAddress: String = "device-b"

    val enabled: Boolean get() = URL.isNotBlank()
}
