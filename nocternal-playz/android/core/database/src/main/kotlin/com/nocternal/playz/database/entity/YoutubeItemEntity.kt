package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "youtube_items")
data class YoutubeItemEntity(
    @PrimaryKey val videoId: String,
    val title: String,
    val channelName: String,
    val durationMs: Long,
    val thumbnailUrl: String? = null,
    val addedAt: Long = System.currentTimeMillis(),
    val playlistId: String? = null,
    val isDownloaded: Boolean = false,
    val localFilePath: String? = null,
    val bpm: Float? = null,
    val camelotKey: String? = null,
)
