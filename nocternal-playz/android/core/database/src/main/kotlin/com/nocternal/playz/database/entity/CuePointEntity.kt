package com.nocternal.playz.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cue_points")
data class CuePointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val trackId: String,
    val positionMs: Long,
    val label: String = "",
    val color: String = "#FF008C",
    val isHotCue: Boolean = false,
    val hotCueIndex: Int? = null,
)
