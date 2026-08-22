package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "hydration_records")
data class HydrationRecord(
    @PrimaryKey
    val date: String, // YYYY-MM-DD
    val cups: Int = 0,
    val goal: Int = 8,
    val lastUpdated: Long = System.currentTimeMillis()
)

@Entity(tableName = "checklist_items")
data class ChecklistItemEntity(
    @PrimaryKey
    val id: String, // e.g. "week_30_0", "food_week_30_salmon"
    val week: Int,
    val category: String, // "CHECKLIST", "FOOD", "HOSPITAL_BAG"
    val text: String,
    val isCompleted: Boolean = false,
    val completedAt: Long? = null
)

@Entity(tableName = "kick_sessions")
data class KickSessionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val date: String,
    val timestamp: Long = System.currentTimeMillis(),
    val kickCount: Int,
    val durationSeconds: Long,
    val notes: String = ""
)

@Entity(tableName = "pregnancy_journal")
data class PregnancyJournalEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val date: String,
    val week: Int,
    val moodEmoji: String = "😊",
    val title: String,
    val note: String,
    val timestamp: Long = System.currentTimeMillis()
)

data class UserProfile(
    val motherName: String = "Anjali",
    val babyNickname: String = "Kinni",
    val currentWeek: Int = 30,
    val currentDay: Int = 3,
    val dueDateYear: Int = 2026,
    val dueDateMonth: String = "October",
    val dueDateDay: Int = 29,
    val daysLeft: Int = 67,
    val waterGoal: Int = 8
)
