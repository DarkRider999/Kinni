package com.nocternal.playz.playlists

import com.nocternal.playz.model.Track

/** One "vinyl sleeve" in the Vinyl Collection Room: all tracks sharing an album (spec Phase 4D #17). */
data class VinylRecord(val key: String, val album: String, val artist: String, val artworkUri: String?, val trackIds: List<String>)

object VinylCollection {
    /** Groups the library into album sleeves, newest-tagged-year first then alphabetical. Tracks with no
     *  album tag are grouped under "Singles & B-Sides" per artist rather than dropped. */
    fun build(tracks: List<Track>): List<VinylRecord> {
        val groups = tracks.groupBy { t -> if (t.album.isBlank()) "singles:${t.artist}" else "album:${t.artist}|${t.album}" }
        return groups.map { (key, group) ->
            val first = group.first()
            val album = if (first.album.isBlank()) "Singles & B-Sides" else first.album
            val artwork = group.firstNotNullOfOrNull { it.artworkUri }
            VinylRecord(key, album, first.artist, artwork, group.sortedBy { it.title.lowercase() }.map { it.id })
        }.sortedWith(compareByDescending<VinylRecord> { it.trackIds.size }.thenBy { it.album.lowercase() })
    }
}
