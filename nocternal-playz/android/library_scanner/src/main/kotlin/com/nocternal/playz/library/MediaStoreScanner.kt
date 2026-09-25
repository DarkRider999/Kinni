package com.nocternal.playz.library

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.nocternal.playz.model.MusicalKey
import com.nocternal.playz.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Full device scan (spec §2C) via MediaStore: title, artist, album, genre, duration, folder, year and
 * date added. BPM and key come from tags when MediaStore has them, otherwise from [AudioAnalyzer].
 */
class MediaStoreScanner(private val context: Context) {

    suspend fun scan(minDurationMs: Long = 20_000): List<Track> = withContext(Dispatchers.IO) {
        val collection: Uri = if (Build.VERSION.SDK_INT >= 29) MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL) else MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val cols = buildList {
            add(MediaStore.Audio.Media._ID); add(MediaStore.Audio.Media.TITLE); add(MediaStore.Audio.Media.ARTIST)
            add(MediaStore.Audio.Media.ALBUM); add(MediaStore.Audio.Media.ALBUM_ID); add(MediaStore.Audio.Media.DURATION)
            add(MediaStore.Audio.Media.YEAR); add(MediaStore.Audio.Media.DATE_ADDED); add(MediaStore.Audio.Media.IS_PODCAST)
            if (Build.VERSION.SDK_INT >= 29) add(MediaStore.Audio.Media.RELATIVE_PATH) else add(MediaStore.Audio.Media.DATA)
            if (Build.VERSION.SDK_INT >= 30) add(MediaStore.Audio.Media.GENRE)
        }.toTypedArray()
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 OR ${MediaStore.Audio.Media.IS_PODCAST} != 0"
        val out = ArrayList<Track>()
        context.contentResolver.query(collection, cols, selection, null, "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC")?.use { c ->
            while (c.moveToNext()) {
                val duration = c.long(MediaStore.Audio.Media.DURATION)
                val podcast = c.long(MediaStore.Audio.Media.IS_PODCAST) != 0L
                if (duration < minDurationMs && !podcast) continue
                val id = c.long(MediaStore.Audio.Media._ID)
                val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                val folder = if (Build.VERSION.SDK_INT >= 29) c.str(MediaStore.Audio.Media.RELATIVE_PATH).trimEnd('/')
                else c.str(MediaStore.Audio.Media.DATA).substringBeforeLast('/').substringAfter("/0/", "")
                val albumId = c.long(MediaStore.Audio.Media.ALBUM_ID)
                out += Track(
                    id = "ms:$id",
                    uri = uri.toString(),
                    title = c.str(MediaStore.Audio.Media.TITLE).ifBlank { "Untitled" },
                    artist = c.str(MediaStore.Audio.Media.ARTIST).takeUnless { it.isBlank() || it == "<unknown>" } ?: "Unknown artist",
                    album = c.str(MediaStore.Audio.Media.ALBUM),
                    genreTag = if (Build.VERSION.SDK_INT >= 30) c.str(MediaStore.Audio.Media.GENRE).ifBlank { null } else null,
                    durationMs = duration,
                    folder = folder,
                    year = c.long(MediaStore.Audio.Media.YEAR).toInt().takeIf { it > 0 },
                    artworkUri = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId).toString(),
                    dateAddedEpochMs = c.long(MediaStore.Audio.Media.DATE_ADDED) * 1000,
                    isPodcast = podcast,
                )
            }
        }
        out
    }

    private fun Cursor.long(col: String): Long = getColumnIndex(col).let { if (it < 0 || isNull(it)) 0L else getLong(it) }
    private fun Cursor.str(col: String): String = getColumnIndex(col).let { if (it < 0 || isNull(it)) "" else getString(it) }

    companion object {
        /** Normalises a key tag ("Am", "8A", "C# minor") to Camelot, or null. */
        fun camelotFromTag(tag: String?): String? = tag?.let { MusicalKey.parse(it)?.camelot }
    }
}
