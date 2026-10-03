package com.subzero.messenger.data

import android.content.Context

/**
 * User-configurable relay settings, entered on the in-app setup screen and
 * persisted locally. Blank [url] keeps the app fully offline (the default), so
 * no setup is required to use every on-device feature.
 *
 * These are routing settings, not secrets (the relay only ever sees ciphertext),
 * so plain app-private SharedPreferences is appropriate.
 */
class RelaySettings(context: Context) {

    private val prefs = context.getSharedPreferences("subzero.relay", Context.MODE_PRIVATE)

    var url: String
        get() = prefs.getString(KEY_URL, "") ?: ""
        set(v) = prefs.edit().putString(KEY_URL, v.trim()).apply()

    var selfAddress: String
        get() = prefs.getString(KEY_SELF, "") ?: ""
        set(v) = prefs.edit().putString(KEY_SELF, v.trim()).apply()

    var peerAddress: String
        get() = prefs.getString(KEY_PEER, "") ?: ""
        set(v) = prefs.edit().putString(KEY_PEER, v.trim()).apply()

    val enabled: Boolean
        get() = url.isNotBlank() && selfAddress.isNotBlank() && peerAddress.isNotBlank()

    fun save(url: String, selfAddress: String, peerAddress: String) {
        prefs.edit()
            .putString(KEY_URL, url.trim())
            .putString(KEY_SELF, selfAddress.trim())
            .putString(KEY_PEER, peerAddress.trim())
            .apply()
    }

    private companion object {
        const val KEY_URL = "url"
        const val KEY_SELF = "self"
        const val KEY_PEER = "peer"
    }
}
