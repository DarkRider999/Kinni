package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "analytics")
data class AnalyticsEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val eventType: String,
    val trackId: String? = null,
    val value: Float? = null,
    val metadata: String? = null,
    val recordedAt: Long = System.currentTimeMillis(),
)
