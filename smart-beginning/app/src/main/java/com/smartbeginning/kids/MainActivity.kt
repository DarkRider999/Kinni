package com.smartbeginning.kids

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ScrollView
import android.widget.TextView
import java.io.PrintWriter
import java.io.StringWriter
import java.util.Locale

/**
 * The whole app is a single offline-first page (assets/www/index.html). This
 * Activity is only the shell: a full-screen WebView, a native text-to-speech
 * bridge (the device has no Web Speech API inside a WebView, so narration is
 * spoken natively), and a small orientation bridge so the Music Studio can be
 * played sideways like a real toy instrument while every other screen stays
 * portrait.
 */
class MainActivity : Activity() {

    private var webView: WebView? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            initTts()

            val wv = WebView(this)
            webView = wv
            setContentView(wv)
            configureWebView(wv)
            wv.addJavascriptInterface(TtsBridge(), "AndroidTTS")
            wv.addJavascriptInterface(OrientationBridge(), "AndroidOrientation")
            wv.loadUrl("file:///android_asset/www/index.html")
        } catch (t: Throwable) {
            // A WebView-based app has exactly one way to fail hard: the
            // device's WebView implementation is missing, disabled, or too
            // old to construct (seen on phones where a user or MDM policy
            // disabled "Android System WebView"). Never let that - or any
            // other startup error - take the whole app down silently; show
            // what broke so it can actually be fixed, instead of the OS's
            // bare "keeps stopping" dialog.
            showFatalError(t)
        }
    }

    /** Narration is a nice-to-have; a broken TTS engine must never crash the app. */
    private fun initTts() {
        try {
            tts = TextToSpeech(applicationContext) { status ->
                ttsReady = (status == TextToSpeech.SUCCESS)
                try {
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {}
                        override fun onDone(utteranceId: String?) {}
                        @Deprecated("Deprecated in API 21+, kept for older devices")
                        override fun onError(utteranceId: String?) {}
                    })
                } catch (t: Throwable) {
                    ttsReady = false
                }
            }
        } catch (t: Throwable) {
            tts = null
            ttsReady = false
        }
    }

    private fun showFatalError(t: Throwable) {
        val sw = StringWriter()
        t.printStackTrace(PrintWriter(sw))
        val text = TextView(this).apply {
            text = "Smart Beginning couldn't start.\n\n" +
                "This usually means the device's WebView component is missing, " +
                "disabled or out of date - check Settings → Apps → " +
                "Android System WebView is enabled and updated from the Play Store.\n\n" +
                "If it still doesn't open, please screenshot the details below:\n\n" +
                sw.toString()
            setPadding(48, 96, 48, 48)
            textSize = 13f
            gravity = Gravity.START
            setTextIsSelectable(true)
            movementMethod = ScrollingMovementMethod()
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }

    private fun hideSystemBars() {
        // A kids' app should feel like a toy, not like a browser - no status
        // bar / nav bar chrome stealing attention or screen space. This is
        // cosmetic only, so a failure here (seen on at least one real
        // device: window.insetsController threw a NullPointerException
        // internally rather than returning null) must never crash the app.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
                window.insetsController?.let { controller ->
                    controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                    )
            }
        } catch (t: Throwable) {
            // Keep the chrome visible rather than crash; not worth losing the app over.
        }
    }

    private fun configureWebView(wv: WebView) {
        val s: WebSettings = wv.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.allowFileAccess = true
        s.setSupportZoom(false)
        s.builtInZoomControls = false
        s.displayZoomControls = false
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        // The app auto-plays a short tune / narration line right after some
        // navigations (not from a direct tap), so playback must not be
        // blocked for lack of a "fresh" user gesture.
        s.mediaPlaybackRequiresUserGesture = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                // Keep the app's own bundled pages inside the WebView; hand
                // anything external (e.g. a Watch & Learn video link) to a
                // real browser / the YouTube app instead of loading it here.
                if (url.startsWith("file:///android_asset/")) return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                } catch (e: Exception) {
                    false
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // The window's decor view isn't reliably attached yet during
        // onCreate() - on this exact device (Samsung, reported crash),
        // window.insetsController throws a NullPointerException internally
        // instead of returning null when called too early. Focus-gained is
        // the standard, race-free point to apply immersive system-UI flags;
        // it also re-hides the bars if the user swipes them back in.
        if (hasFocus) hideSystemBars()
    }

    override fun onBackPressed() {
        val wv = webView
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        try { tts?.stop(); tts?.shutdown() } catch (t: Throwable) { /* already going down */ }
        try { webView?.destroy() } catch (t: Throwable) { /* already going down */ }
        super.onDestroy()
    }

    /** Resolves a BCP-47-ish tag ("ta-IN", "en-US", ...) to a Locale and checks it's installed. */
    private fun localeFor(tag: String?): Locale {
        if (tag.isNullOrBlank()) return Locale.US
        val parts = tag.replace('_', '-').split('-')
        return if (parts.size >= 2) Locale(parts[0], parts[1]) else Locale(parts[0])
    }

    /**
     * Exposed to JS as `window.AndroidTTS`. Mirrors the signature the web
     * app calls: speak(text, lang, pitch, rate). pitch/rate follow Android's
     * TextToSpeech scale (1.0 = normal), not the Web Speech Synthesis scale.
     */
    inner class TtsBridge {
        @JavascriptInterface
        fun speak(text: String, lang: String?, pitch: Float, rate: Float) {
            val engine = tts ?: return
            if (!ttsReady) return
            runOnUiThread {
                val locale = localeFor(lang)
                val support = engine.isLanguageAvailable(locale)
                if (support == TextToSpeech.LANG_MISSING_DATA || support == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // Fall back to the device's default spoken language rather
                    // than staying silent when a language pack isn't installed.
                    engine.language = Locale.getDefault()
                } else {
                    engine.language = locale
                }
                // Clamp to a gentle range so a bad value from JS can't produce
                // a jarring, too-fast or too-shrill line for a toddler.
                engine.setPitch(pitch.coerceIn(0.6f, 1.4f))
                engine.setSpeechRate(rate.coerceIn(0.6f, 1.3f))
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sb_${System.currentTimeMillis()}")
            }
        }

        @JavascriptInterface
        fun available(lang: String?): Boolean {
            if (!ttsReady) return false
            val engine = tts ?: return false
            if (lang.isNullOrBlank()) return true
            val support = engine.isLanguageAvailable(localeFor(lang))
            return support == TextToSpeech.LANG_AVAILABLE ||
                support == TextToSpeech.LANG_COUNTRY_AVAILABLE ||
                support == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE
        }

        @JavascriptInterface
        fun stop() {
            runOnUiThread { tts?.stop() }
        }
    }

    /** Exposed to JS as `window.AndroidOrientation`, used only by Music Studio. */
    inner class OrientationBridge {
        @JavascriptInterface
        fun unlock() {
            runOnUiThread { requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR }
        }

        @JavascriptInterface
        fun lockPortrait() {
            runOnUiThread { requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
        }
    }
}
