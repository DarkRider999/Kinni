package com.subzero.messenger.data

import android.content.Context

/**
 * General app settings (separate from relay connection settings). All local.
 *
 * appLockEnabled defaults to OFF so the app is immediately usable and never
 * traps the user on a lock screen; they can turn on biometric lock in Settings.
 */
class AppPreferences(context: Context) {

    private val prefs = context.getSharedPreferences("subzero.app", Context.MODE_PRIVATE)

    var appLockEnabled: Boolean
        get() = prefs.getBoolean(KEY_LOCK, false)
        set(v) = prefs.edit().putBoolean(KEY_LOCK, v).apply()

    /** Disappearing-message timer in seconds; 0 = off. */
    var disappearingSeconds: Int
        get() = prefs.getInt(KEY_TTL, 0)
        set(v) = prefs.edit().putInt(KEY_TTL, v).apply()

    private companion object {
        const val KEY_LOCK = "lock_enabled"
        const val KEY_TTL = "disappearing_seconds"
    }
}
