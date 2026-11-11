package com.aistudio.uaelottery.lucky.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "past_draws")
data class PastDrawEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val drawDate: String,
    val numbersCsv: String,
    val gameLabel: String
)
