package com.subzero.messenger.identity

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/**
 * A selectable app "face": launcher label + icon. Each maps to a
 * <activity-alias> declared in the manifest. Switching enables the chosen alias
 * and disables the others, so the home-screen icon and name change.
 *
 * This is store-compliant identity switching (the app remains visible in system
 * Settings and the app list). It is NOT app-hiding — see docs/SECURITY.md.
 */
enum class AppIdentity(val aliasSuffix: String, val label: String) {
    DEFAULT("Default", "SubZero"),
    CALCULATOR("Calculator", "Calculator"),
    NOTES("Notes", "Notes"),
    WEATHER("Weather", "Weather"),
    GALLERY("Gallery", "Gallery"),
    SYSTEM_UPDATE("System", "System Update");
}

class IdentityManager(private val context: Context) {

    private val pm: PackageManager get() = context.packageManager
    private val pkg: String get() = context.packageName

    private fun component(identity: AppIdentity) =
        ComponentName(pkg, "$pkg.identity.Launcher${identity.aliasSuffix}")

    /**
     * Enable [target]'s alias and disable every other. The app must keep exactly
     * one enabled launcher entry or it disappears from the launcher entirely, so
     * enable-target-first ordering is enforced.
     */
    fun switchTo(target: AppIdentity) {
        pm.setComponentEnabledSetting(
            component(target),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP,
        )
        AppIdentity.entries.filter { it != target }.forEach { other ->
            pm.setComponentEnabledSetting(
                component(other),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP,
            )
        }
    }

    fun current(): AppIdentity =
        AppIdentity.entries.firstOrNull {
            pm.getComponentEnabledSetting(component(it)) ==
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } ?: AppIdentity.DEFAULT

    /** Manual user choice of a random disguise, avoiding the current one. */
    fun rotateRandom() {
        val candidates = AppIdentity.entries.filter { it != current() }
        switchTo(candidates.random())
    }
}
