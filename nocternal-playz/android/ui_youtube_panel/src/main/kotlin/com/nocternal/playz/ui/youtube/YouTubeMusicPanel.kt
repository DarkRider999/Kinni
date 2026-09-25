package com.nocternal.playz.ui.youtube

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton

const val YOUTUBE_MUSIC_URL = "https://music.youtube.com/"

/**
 * YouTube Music panel (spec §3, panel 2): the official YouTube Music web app in a WebView, framed in the neon
 * UI. Sign-in, library and playback are YouTube's own; the app never scrapes or downloads streams, which
 * keeps it within YouTube's terms. Audio from this panel plays through the WebView, so the FX chain and
 * spectrum don't apply to it (the theme switches to the YouTube preset instead).
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun YouTubeMusicPanel(
    online: Boolean,
    searchQuery: String?,
    modifier: Modifier = Modifier,
    active: Boolean = true,
) {
    val p = Neon.palette
    var progress by remember { mutableIntStateOf(0) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var canGoBack by remember { mutableStateOf(false) }

    if (!online) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("You're offline", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
                Text("Smart offline mode switched you to your local library.", color = p.muted, modifier = Modifier.padding(16.dp))
            }
        }
        return
    }

    LaunchedEffect(searchQuery, webView) {
        val q = searchQuery ?: return@LaunchedEffect
        webView?.loadUrl(YOUTUBE_MUSIC_URL + "search?q=" + Uri.encode(q))
    }
    BackHandler(enabled = active && canGoBack) { webView?.goBack() }
    DisposableEffect(Unit) { onDispose { webView?.onPause() } }

    Column(modifier.fillMaxSize()) {
        if (progress in 1..99) LinearProgressIndicator(progress = { progress / 100f }, modifier = Modifier.fillMaxWidth().height(2.dp), color = p.accent)
        AndroidView(
            modifier = Modifier.fillMaxSize().padding(8.dp).clip(RoundedCornerShape(20.dp)).background(p.surface),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    setBackgroundColor(android.graphics.Color.BLACK)
                    webChromeClient = object : WebChromeClient() {
                        override fun onProgressChanged(view: WebView?, newProgress: Int) { progress = newProgress }
                    }
                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) { canGoBack = view?.canGoBack() == true }
                        override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) { canGoBack = view?.canGoBack() == true }
                        // Keep YouTube/Google sign-in inside the panel; open anything else in the browser.
                        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                            val host = request.url.host.orEmpty()
                            val internal = host.endsWith("youtube.com") || host.endsWith("google.com") || host.endsWith("gstatic.com") || host.endsWith("googleusercontent.com")
                            if (!internal) runCatching { view.context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)) }
                            return !internal
                        }
                    }
                    loadUrl(YOUTUBE_MUSIC_URL)
                    webView = this
                }
            },
            update = { if (active) it.onResume() },
        )
    }
}

/** Shown before the panel is first opened, so the WebView isn't created until needed. */
@Composable
fun YouTubePanelPlaceholder(onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val p = Neon.palette
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("YouTube Music", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
            Text("Stream your YouTube Music library inside Nocternal", color = p.muted, modifier = Modifier.padding(12.dp))
            NeonButton("Open YouTube Music", onClick = onOpen)
        }
    }
}
