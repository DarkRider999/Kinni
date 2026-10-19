package com.nocternal.playz.model

import kotlinx.serialization.Serializable

/**
 * A saved favourite lyric line (spec #15: Lyric Bookmarking). [text] is a snapshot taken when the
 * bookmark was made, so it still reads correctly even if lyrics are later re-fetched or re-Romanized.
 */
@Serializable
data class LyricBookmark(
    val trackId: String,
    val lineStartMs: Long,
    val text: String,
    val trackTitle: String,
    val trackArtist: String,
    val createdAtEpochMs: Long,
)
