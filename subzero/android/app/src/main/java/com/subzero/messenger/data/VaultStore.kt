package com.subzero.messenger.data

import android.content.Context
import com.subzero.messenger.crypto.KeyStoreManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/** One item in the vault. [id] names the on-disk encrypted blob. */
data class VaultItem(
    val id: String,
    val name: String,
    val mime: String,
    val sizeBytes: Long,
    val addedAt: Long,
) {
    val isImage get() = mime.startsWith("image/")
    val isVideo get() = mime.startsWith("video/")
}

/**
 * Encrypted media vault. Everything the app receives or the user imports is
 * stored here — and nowhere else.
 *
 * Why it's invisible to the phone's Gallery and file managers: files live in the
 * app's **private internal storage** (`context.filesDir`), which Android's
 * scoped-storage model keeps unreadable to other apps and never registers with
 * `MediaStore` (the system media index the Gallery reads). This is standard
 * app-sandbox behaviour — the same reason Signal's media doesn't land in your
 * camera roll. On top of that, every blob is encrypted at rest with a
 * hardware-backed Keystore key ([KeyStoreManager]), so even the raw files on
 * disk are ciphertext.
 *
 * This is at-rest privacy, not anti-forensics: it does not wipe on inspection
 * and does not hide the app itself.
 */
class VaultStore(context: Context) {

    private val keyStore = KeyStoreManager(alias = "subzero.vault")
    private val dir = File(context.filesDir, "vault").apply { mkdirs() }
    private val indexFile = File(dir, "index.bin")
    private val items = LinkedHashMap<String, VaultItem>()

    init { loadIndex() }

    fun list(): List<VaultItem> = items.values.sortedByDescending { it.addedAt }

    /** Encrypt [bytes] and store as a new vault item. Returns the item's id. */
    fun add(bytes: ByteArray, name: String, mime: String): String {
        val id = UUID.randomUUID().toString()
        File(dir, "$id.bin").writeBytes(keyStore.encrypt(bytes))
        items[id] = VaultItem(id, name, mime, bytes.size.toLong(), System.currentTimeMillis())
        persistIndex()
        return id
    }

    /** Decrypt and return an item's bytes for in-app viewing only. */
    fun open(id: String): ByteArray? {
        val f = File(dir, "$id.bin")
        if (!f.exists()) return null
        return keyStore.decrypt(f.readBytes())
    }

    fun delete(id: String) {
        File(dir, "$id.bin").delete()
        items.remove(id)
        persistIndex()
    }

    /** Securely drop the whole vault (user-initiated wipe). */
    fun wipeAll() {
        dir.listFiles()?.forEach { it.delete() }
        items.clear()
        persistIndex()
    }

    private fun persistIndex() {
        val arr = JSONArray()
        items.values.forEach { item ->
            arr.put(
                JSONObject()
                    .put("id", item.id).put("name", item.name).put("mime", item.mime)
                    .put("size", item.sizeBytes).put("at", item.addedAt)
            )
        }
        indexFile.writeBytes(keyStore.encrypt(arr.toString().toByteArray()))
    }

    private fun loadIndex() {
        if (!indexFile.exists()) return
        runCatching {
            val json = String(keyStore.decrypt(indexFile.readBytes()))
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val item = VaultItem(
                    o.getString("id"), o.getString("name"), o.getString("mime"),
                    o.getLong("size"), o.getLong("at"),
                )
                items[item.id] = item
            }
        }
    }
}
