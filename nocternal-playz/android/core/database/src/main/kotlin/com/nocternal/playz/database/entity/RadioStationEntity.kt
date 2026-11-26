package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "radio_stations")
data class RadioStationEntity(
    @PrimaryKey val id: String,
    val name: String,
    val streamUrl: String,
    val genre: String = "",
    val country: String = "",
    val logoUrl: String? = null,
    val bitrate: Int = 128,
    val isFavorite: Boolean = false,
    val lastPlayedAt: Long? = null,
    val playCount: Int = 0,
)
