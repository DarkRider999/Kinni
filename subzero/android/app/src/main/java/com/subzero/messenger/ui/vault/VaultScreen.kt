package com.subzero.messenger.ui.vault

import android.graphics.BitmapFactory
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.subzero.messenger.data.VaultItem
import com.subzero.messenger.data.VaultStore

/**
 * The encrypted media vault UI. Import photos/videos/documents (they are copied
 * into the app's private encrypted storage and removed from view of the system
 * gallery — see [VaultStore]). Tap an image to view it decrypted in-app.
 */
@Composable
fun VaultScreen(vault: VaultStore, onBack: () -> Unit) {
    val context = LocalContext.current
    var items by remember { mutableStateOf(vault.list()) }
    var viewing by remember { mutableStateOf<VaultItem?>(null) }

    fun refresh() { items = vault.list() }

    val pickMedia = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@rememberLauncherForActivityResult
        val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
        vault.add(bytes, queryName(context, uri) ?: "item", mime)
        refresh()
    }
    val pickDoc = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@rememberLauncherForActivityResult
        val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
        vault.add(bytes, queryName(context, uri) ?: "document", mime)
        refresh()
    }

    if (viewing != null) {
        VaultViewer(vault, viewing!!, onClose = { viewing = null }, onDelete = {
            vault.delete(viewing!!.id); viewing = null; refresh()
        })
        return
    }

    Column(Modifier.fillMaxSize().background(Color(0xFF0B0F14))) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("‹", color = Color(0xFF35E0C4), fontSize = 28.sp,
                modifier = Modifier.clickable { onBack() })
            Spacer(Modifier.width(12.dp))
            Column {
                Text("Vault", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("${items.size} items · encrypted, hidden from Gallery",
                    color = Color(0xFF667079), fontSize = 12.sp)
            }
        }

        if (items.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Nothing here yet.\nImport photos, videos, or files.",
                    color = Color(0xFF667079), fontSize = 15.sp)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                items(items, key = { it.id }) { item -> VaultCell(vault, item) { viewing = item } }
            }
        }

        Row(Modifier.fillMaxWidth().padding(16.dp)) {
            Button(
                onClick = { pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) },
                modifier = Modifier.weight(1f),
            ) { Text("Add photo/video") }
            Spacer(Modifier.width(12.dp))
            OutlinedButton(onClick = { pickDoc.launch("*/*") }, modifier = Modifier.weight(1f)) {
                Text("Add file")
            }
        }
    }
}

@Composable
private fun VaultCell(vault: VaultStore, item: VaultItem, onOpen: () -> Unit) {
    Box(
        Modifier.padding(4.dp).aspectRatio(1f).clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF16202B)).clickable { onOpen() },
        contentAlignment = Alignment.Center,
    ) {
        if (item.isImage) {
            val bmp = remember(item.id) {
                vault.open(item.id)?.let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() }
            }
            if (bmp != null) {
                Image(bmp, contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize())
            } else {
                Text("🔒", fontSize = 26.sp)
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(if (item.isVideo) "🎬" else "📄", fontSize = 30.sp)
                Text(item.name, color = Color(0xFF9AA0A6), fontSize = 10.sp, maxLines = 1)
            }
        }
    }
}

@Composable
private fun VaultViewer(vault: VaultStore, item: VaultItem, onClose: () -> Unit, onDelete: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Color(0xFF000000))) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("‹ Vault", color = Color(0xFF35E0C4), fontSize = 18.sp,
                modifier = Modifier.clickable { onClose() })
            Spacer(Modifier.weight(1f))
            Text("Delete", color = Color(0xFFE05A5A), fontSize = 16.sp,
                modifier = Modifier.clickable { onDelete() })
        }
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            if (item.isImage) {
                val bmp = remember(item.id) {
                    vault.open(item.id)?.let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() }
                }
                if (bmp != null) Image(bmp, contentDescription = null, modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit)
                else Text("Could not decrypt", color = Color.Gray)
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (item.isVideo) "🎬" else "📄", fontSize = 64.sp)
                    Spacer(Modifier.height(12.dp))
                    Text(item.name, color = Color.White, fontSize = 16.sp)
                    Text("${item.sizeBytes / 1024} KB · ${item.mime}", color = Color(0xFF667079), fontSize = 12.sp)
                    // TODO(subzero): stream-decrypt video to an in-app ExoPlayer surface.
                }
            }
        }
    }
}

private fun queryName(context: android.content.Context, uri: android.net.Uri): String? =
    context.contentResolver.query(uri, null, null, null, null)?.use { c ->
        val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (idx >= 0 && c.moveToFirst()) c.getString(idx) else null
    }
