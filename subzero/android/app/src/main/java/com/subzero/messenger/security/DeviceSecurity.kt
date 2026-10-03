package com.subzero.messenger.security

import android.app.Activity
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.io.File

/** Blocks screenshots and hides content in the app switcher/recents thumbnail. */
object ScreenSecurity {
    fun protect(activity: Activity) {
        activity.window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
    }
    fun unprotect(activity: Activity) {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}

/** Biometric app lock. Wraps AndroidX BiometricPrompt with strong-class auth. */
class AppLock(private val activity: FragmentActivity) {

    fun canAuthenticate(): Boolean =
        BiometricManager.from(activity).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG,
        ) == BiometricManager.BIOMETRIC_SUCCESS

    fun authenticate(onSuccess: () -> Unit, onFailure: () -> Unit) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = onSuccess()
            override fun onAuthenticationError(code: Int, msg: CharSequence) = onFailure()
        })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock SubZero")
            .setSubtitle("Confirm it's you")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setNegativeButtonText("Cancel")
            .build()
        prompt.authenticate(info)
    }
}

/**
 * Best-effort root/emulator awareness. This is an INFORMATIONAL signal shown to
 * the user (see SECURITY.md) — it never wipes data or hides the app, and it is
 * intentionally not treated as a hard security boundary (root detection is
 * always defeatable). Its only job is to let a privacy-conscious user know their
 * device may not be trustworthy.
 */
object RootAwareness {
    private val suPaths = listOf(
        "/system/bin/su", "/system/xbin/su", "/sbin/su",
        "/system/app/Superuser.apk", "/data/local/bin/su",
    )

    fun looksRooted(): Boolean {
        if (suPaths.any { File(it).exists() }) return true
        val tags = android.os.Build.TAGS
        if (tags != null && tags.contains("test-keys")) return true
        return false
    }

    /** Message to surface in a non-blocking banner when [looksRooted]. */
    fun advisory(): String =
        "This device appears to be rooted. Rooted devices are easier for malware " +
            "to inspect. SubZero still works, but your messages may be less protected."
}
