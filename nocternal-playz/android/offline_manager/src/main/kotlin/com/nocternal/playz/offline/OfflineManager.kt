package com.nocternal.playz.offline

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.nocternal.playz.lyrics.LrcLibProvider
import com.nocternal.playz.lyrics.LrcParser
import com.nocternal.playz.lyrics.LyricsCache
import com.nocternal.playz.model.AppSettings
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.Track
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.util.concurrent.TimeUnit

/** File-backed lyrics cache in app storage (offline lyrics). */
class FileLyricsCache(context: Context) : LyricsCache {
    private val dir = File(context.filesDir, "lyrics").apply { mkdirs() }
    private fun f(id: String) = File(dir, id.replace(Regex("[^A-Za-z0-9_.-]"), "_") + ".lrc")
    override fun get(trackId: String): String? = f(trackId).takeIf { it.exists() }?.readText()
    override fun put(trackId: String, lrc: String) = f(trackId).writeText(lrc)
    fun has(trackId: String) = f(trackId).exists()
}

/**
 * Smart offline mode + smart auto-download (spec §11.6/§11.17).
 * - When the network drops, online sources are hidden and playback falls back to the local library.
 * - A periodic worker pre-downloads lyrics for your most-played and recent songs, on Wi-Fi only by default.
 */
class OfflineManager(private val context: Context, val connectivity: ConnectivityMonitor = ConnectivityMonitor(context)) {
    val network: StateFlow<NetworkState> get() = connectivity.state

    fun start() = connectivity.start()

    /** True when online features may use the current connection, given the Wi-Fi / mobile-data choices. */
    fun canUseNetwork(settings: AppSettings): Boolean = allowed(network.value, settings)

    /** True when a source can be used right now. */
    fun isAvailable(source: AudioSource, settings: AppSettings): Boolean =
        source == AudioSource.LOCAL || !settings.smartOfflineMode || canUseNetwork(settings)

    fun canDownloadNow(settings: AppSettings): Boolean =
        canUseNetwork(settings) && (!settings.autoDownloadOnWifiOnly || network.value.unmetered)

    fun scheduleAutoDownload(settings: AppSettings) {
        val wm = WorkManager.getInstance(context)
        if (!settings.autoDownloadLyrics) { wm.cancelUniqueWork(WORK); return }
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(if (settings.autoDownloadOnWifiOnly || !settings.useMobileData) NetworkType.UNMETERED else NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
        val req = PeriodicWorkRequestBuilder<AutoDownloadWorker>(12, TimeUnit.HOURS).setConstraints(constraints).build()
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
    }

    companion object {
        const val WORK = "nocternal-auto-download"

        fun allowed(n: NetworkState, s: AppSettings): Boolean = n.online && when {
            n.wifi -> s.useWifi
            n.cellular -> s.useMobileData
            else -> s.useWifi || s.useMobileData // ethernet/VPN/unknown
        }
        /** Set by the app so the worker can read the current candidates without a DI framework. */
        @Volatile var candidates: () -> List<Track> = { emptyList() }
    }
}

class AutoDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val cache = FileLyricsCache(applicationContext)
        val lrclib = LrcLibProvider()
        val todo = OfflineManager.candidates().filter { it.source == AudioSource.LOCAL && !cache.has(it.id) }.take(40)
        for (t in todo) {
            if (isStopped) break
            runCatching { lrclib.find(t) }.getOrNull()?.let { cache.put(t.id, LrcParser.toLrc(it)) }
        }
        return Result.success()
    }
}
