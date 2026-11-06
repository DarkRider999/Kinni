package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val genre: String,
    val bpm: Float,
    val camelotKey: String,
    val durationMs: Long,
    val filePath: String,
    val artworkUri: String?,
    val energy: Float,
    val danceability: Float,
    val mood: String,
    val loudnessDb: Float,
    val playCount: Int = 0,
    val isFavorite: Boolean = false,
    val rating: Int = 0,
    val addedAt: Long = System.currentTimeMillis(),
    val lastPlayedAt: Long? = null,
    val year: Int? = null,
    val trackNumber: Int? = null,
    val source: String = "local",
    val youtubeVideoId: String? = null,
)
