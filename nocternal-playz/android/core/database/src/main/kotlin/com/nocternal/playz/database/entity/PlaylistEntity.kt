package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String = "",
    val artworkUri: String? = null,
    val kind: String = "USER",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val trackCount: Int = 0,
    val totalDurationMs: Long = 0,
    val isSmartPlaylist: Boolean = false,
    val smartRules: String? = null,
)
