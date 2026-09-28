package com.subzero.messenger

import android.app.Application
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Application entry point. Kept deliberately thin — no analytics, no crash
 * reporter that ships content.
 *
 * A local crash catcher writes the last stack trace to app-private storage so
 * MainActivity can show it on the next launch. This never leaves the device; it
 * just turns a silent "blank screen" into a readable, shareable error while the
 * app is still being tested.
 */
class SubZeroApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                val sw = StringWriter()
                error.printStackTrace(PrintWriter(sw))
                File(filesDir, CRASH_FILE).writeText(
                    "SubZero ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL} " +
                        "(Android ${android.os.Build.VERSION.RELEASE}, API ${android.os.Build.VERSION.SDK_INT})\n\n$sw"
                )
            } catch (_: Throwable) { /* best effort */ }
            previous?.uncaughtException(thread, error)
        }
    }

    companion object {
        const val CRASH_FILE = "last_crash.txt"
    }
}
