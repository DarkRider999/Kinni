package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "lighting_profiles")
data class LightingProfileEntity(
    @PrimaryKey val id: String,
    val name: String,
    val deviceType: String,
    val sceneJson: String,
    val isActive: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)
