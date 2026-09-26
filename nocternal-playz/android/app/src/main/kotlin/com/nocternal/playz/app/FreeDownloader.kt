package com.nocternal.playz.app

import android.content.Context
import android.net.Uri
import android.os.Environment
import com.nocternal.playz.freemusic.FreeTrack
import com.nocternal.playz.library.LibraryRepository
import com.nocternal.playz.model.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Progress of one download: 0..1 while running (-1 when size is unknown), [error] when it failed. */
data class DownloadProgress(val fraction: Float = 0f, val error: String? = null)

/**
 * Downloads Creative Commons / public-domain music and podcast episodes into app storage and adds them to
 * the library, with licence and source kept on the track and in a CREDITS.txt next to the files.
 */
class FreeDownloader(
    private val context: Context,
    private val scope: CoroutineScope,
    private val library: LibraryRepository,
    private val canUseNetwork: () -> Boolean,
    private val notify: (String) -> Unit,
) {
    private val _active = MutableStateFlow<Map<String, DownloadProgress>>(emptyMap())
    /** Running or failed downloads by library id. */
    val active: StateFlow<Map<String, DownloadProgress>> = _active.asStateFlow()
    private val jobs = HashMap<String, Job>()

    val root: File get() = File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: File(context.filesDir, "music"), "Free downloads")

    fun isDownloaded(t: FreeTrack) = library.track(t.libraryId) != null

    fun download(t: FreeTrack) {
        val id = t.libraryId
        if (jobs[id]?.isActive == true || isDownloaded(t)) return
        if (!canUseNetwork()) { notify("You're offline — check Wi-Fi / mobile data in Settings"); return }
        _active.update { it + (id to DownloadProgress()) }
        jobs[id] = scope.launch {
            val result = runCatching { withContext(Dispatchers.IO) { fetchTo(t) } }
            result.onSuccess { file ->
                library.addDownload(t.toTrack(file))
                _active.update { it - id }
                notify("Downloaded: ${t.title}")
            }.onFailure { e ->
                if (e is kotlinx.coroutines.CancellationException) _active.update { it - id }
                else { _active.update { it + (id to DownloadProgress(error = e.message ?: "Download failed")) }; notify("Couldn't download ${t.title}") }
            }
            jobs.remove(id)
        }
    }

    fun cancel(t: FreeTrack) { jobs.remove(t.libraryId)?.cancel(); _active.update { it - t.libraryId } }

    private suspend fun fetchTo(t: FreeTrack): File {
        val dir = File(root, t.provider.label).apply { mkdirs() }
        val target = uniqueFile(dir, t.fileName)
        val part = File(dir, target.name + ".part")
        val conn = open(URL(t.audioUrl))
        try {
            val total = conn.contentLengthLong
            conn.inputStream.use { input ->
                part.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    var done = 0L; var lastReport = 0L
                    while (true) {
                        coroutineContextEnsureActive()
                        val n = input.read(buf); if (n < 0) break
                        out.write(buf, 0, n); done += n
                        if (done - lastReport > 256 * 1024) {
                            lastReport = done
                            val f = if (total > 0) done.toFloat() / total else -1f
                            _active.update { it + (t.libraryId to DownloadProgress(f)) }
                        }
                    }
                }
            }
            if (!part.renameTo(target)) error("Couldn't save file")
        } catch (e: Throwable) {
            part.delete(); throw e
        } finally { conn.disconnect() }
        runCatching { File(root, "CREDITS.txt").appendText(t.attribution + (t.licenseUrl?.let { " · $it" } ?: "") + "\n") }
        return target
    }

    /** Opens [start], following redirects manually: podcast hosts often bounce between http and https, which HttpURLConnection won't. */
    private fun open(start: URL): HttpURLConnection {
        var url = start
        repeat(8) {
            val conn = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000; readTimeout = 30000; instanceFollowRedirects = false
                setRequestProperty("User-Agent", "NocternalPlayz/1.0 (https://github.com/DarkRider999/Kinni)")
            }
            val code = conn.responseCode
            if (code in 300..399) {
                val loc = conn.getHeaderField("Location"); conn.disconnect()
                url = URL(url, loc ?: error("Bad redirect")); return@repeat
            }
            if (code != 200) { conn.disconnect(); error("Server returned $code") }
            return conn
        }
        error("Too many redirects")
    }

    private suspend fun coroutineContextEnsureActive() = kotlin.coroutines.coroutineContext.ensureActive()

    private fun uniqueFile(dir: File, name: String): File {
        var f = File(dir, name); var i = 2
        while (f.exists()) { f = File(dir, name.substringBeforeLast('.') + " ($i)." + name.substringAfterLast('.')); i++ }
        return f
    }

    private fun FreeTrack.toTrack(file: File) = Track(
        id = libraryId, uri = Uri.fromFile(file).toString(), title = title, artist = artist, album = album,
        genreTag = genre ?: if (isPodcast) "Podcast" else null, durationMs = durationMs,
        folder = "Free downloads/${provider.label}", artworkUri = artworkUrl, dateAddedEpochMs = System.currentTimeMillis(),
        isPodcast = isPodcast, license = license, attributionUrl = pageUrl,
    )
}
