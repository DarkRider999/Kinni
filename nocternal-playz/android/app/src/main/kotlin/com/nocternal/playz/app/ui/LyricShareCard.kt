package com.nocternal.playz.app.ui

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.FileProvider
import com.nocternal.playz.ai.AlbumArtGenerator
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.model.Track
import com.nocternal.playz.ui.player.NeonArtView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/** The shareable lyric card: neon-art background, the lyric line and the track credit — Phase 4D #16
 *  "Lyric Share Cards". Pure visual composition; capture/share lives in [LyricShareDialog]. */
@Composable
private fun LyricShareCardContent(track: Track, lineText: String, modifier: Modifier = Modifier) {
    val p = Neon.palette
    val art = remember(track.id) { AlbumArtGenerator().generate(track) }
    Box(modifier.aspectRatio(1f)) {
        NeonArtView(art, Modifier.fillMaxWidth().aspectRatio(1f))
        Column(
            Modifier.fillMaxWidth().padding(28.dp),
            verticalArrangement = Arrangement.Bottom,
        ) {
            Text(
                "“$lineText”", color = p.onBackground, style = MaterialTheme.typography.headlineSmall,
                textAlign = TextAlign.Start, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            )
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
            Text("${track.title} — ${track.artist}", color = p.accent, style = MaterialTheme.typography.labelLarge)
            Text("Nocternal Play", color = p.muted, style = MaterialTheme.typography.labelSmall)
        }
    }
}

/** Renders the card off-screen, captures it as a bitmap on demand and launches the system share sheet with it. */
@Composable
fun LyricShareDialog(track: Track, lineText: String, onDismiss: () -> Unit) {
    val p = Neon.palette
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val graphicsLayer = rememberGraphicsLayer()
    var sharing by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(8.dp).drawWithContent {
                graphicsLayer.record { this@drawWithContent.drawContent() }
                drawLayer(graphicsLayer)
            },
        ) {
            LyricShareCardContent(track, lineText, Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End) {
                IconButton(onClick = onDismiss) { Icon(Icons.Filled.Close, "Close", tint = p.onBackground) }
                IconButton(enabled = !sharing, onClick = {
                    sharing = true
                    scope.launch {
                        val bitmap = graphicsLayer.toImageBitmap().asAndroidBitmap()
                        val uri = withContext(Dispatchers.IO) { saveShareCard(context, bitmap) }
                        sharing = false
                        if (uri != null) shareImage(context, uri)
                    }
                }) { Icon(Icons.Filled.Share, "Share", tint = if (sharing) p.muted else p.accent) }
            }
        }
    }
}

private fun saveShareCard(context: Context, bitmap: android.graphics.Bitmap): android.net.Uri? = runCatching {
    val dir = File(context.cacheDir, "lyric_share_cards").apply { mkdirs() }
    val file = File(dir, "card_${System.currentTimeMillis()}.png")
    FileOutputStream(file).use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    FileProvider.getUriForFile(context, "${context.packageName}.shareprovider", file)
}.getOrNull()

private fun shareImage(context: Context, uri: android.net.Uri) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(Intent.createChooser(intent, "Share lyric").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
