package com.example.data.repository

import com.example.data.db.KinniDao
import com.example.data.model.ChecklistItemEntity
import com.example.data.model.HydrationRecord
import com.example.data.model.KickSessionEntity
import com.example.data.model.PregnancyJournalEntity
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class KinniRepository(private val dao: KinniDao) {

    fun getTodayString(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    fun getTodayHydration(): Flow<HydrationRecord?> {
        return dao.getHydrationForDate(getTodayString())
    }

    suspend fun updateHydration(cups: Int, goal: Int = 8) {
        val record = HydrationRecord(
            date = getTodayString(),
            cups = cups.coerceIn(0, 20),
            goal = goal,
            lastUpdated = System.currentTimeMillis()
        )
        dao.insertOrUpdateHydration(record)
    }

    fun getChecklistForWeek(week: Int): Flow<List<ChecklistItemEntity>> {
        return dao.getChecklistForWeek(week)
    }

    suspend fun toggleChecklistItem(id: String, week: Int, category: String, text: String, currentStatus: Boolean) {
        val newStatus = !currentStatus
        val timestamp = if (newStatus) System.currentTimeMillis() else null
        val item = ChecklistItemEntity(
            id = id,
            week = week,
            category = category,
            text = text,
            isCompleted = newStatus,
            completedAt = timestamp
        )
        dao.insertOrUpdateChecklistItem(item)
    }

    fun getKickSessions(): Flow<List<KickSessionEntity>> {
        return dao.getAllKickSessions()
    }

    suspend fun saveKickSession(count: Int, durationSeconds: Long, notes: String = "") {
        val session = KickSessionEntity(
            date = getTodayString(),
            timestamp = System.currentTimeMillis(),
            kickCount = count,
            durationSeconds = durationSeconds,
            notes = notes
        )
        dao.insertKickSession(session)
    }

    suspend fun deleteKickSession(id: Long) {
        dao.deleteKickSession(id)
    }

    fun getJournalEntries(): Flow<List<PregnancyJournalEntity>> {
        return dao.getAllJournalEntries()
    }

    suspend fun addJournalEntry(week: Int, moodEmoji: String, title: String, note: String) {
        val entry = PregnancyJournalEntity(
            date = getTodayString(),
            week = week,
            moodEmoji = moodEmoji,
            title = title,
            note = note,
            timestamp = System.currentTimeMillis()
        )
        dao.insertJournalEntry(entry)
    }

    suspend fun deleteJournalEntry(id: Long) {
        dao.deleteJournalEntry(id)
    }
}
