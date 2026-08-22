package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.model.ChecklistItemEntity
import com.example.data.model.HydrationRecord
import com.example.data.model.KickSessionEntity
import com.example.data.model.PregnancyJournalEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface KinniDao {
    // Hydration
    @Query("SELECT * FROM hydration_records WHERE date = :date")
    fun getHydrationForDate(date: String): Flow<HydrationRecord?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateHydration(record: HydrationRecord)

    @Query("SELECT * FROM hydration_records ORDER BY date DESC LIMIT 7")
    fun getRecentHydration(): Flow<List<HydrationRecord>>

    // Checklists & Food checks
    @Query("SELECT * FROM checklist_items WHERE week = :week")
    fun getChecklistForWeek(week: Int): Flow<List<ChecklistItemEntity>>

    @Query("SELECT * FROM checklist_items WHERE category = :category")
    fun getItemsByCategory(category: String): Flow<List<ChecklistItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChecklistItems(items: List<ChecklistItemEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateChecklistItem(item: ChecklistItemEntity)

    @Query("UPDATE checklist_items SET isCompleted = :isCompleted, completedAt = :timestamp WHERE id = :id")
    suspend fun updateChecklistItemStatus(id: String, isCompleted: Boolean, timestamp: Long?)

    // Kick Sessions
    @Query("SELECT * FROM kick_sessions ORDER BY timestamp DESC")
    fun getAllKickSessions(): Flow<List<KickSessionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertKickSession(session: KickSessionEntity)

    @Query("DELETE FROM kick_sessions WHERE id = :id")
    suspend fun deleteKickSession(id: Long)

    // Journal
    @Query("SELECT * FROM pregnancy_journal ORDER BY timestamp DESC")
    fun getAllJournalEntries(): Flow<List<PregnancyJournalEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJournalEntry(entry: PregnancyJournalEntity)

    @Query("DELETE FROM pregnancy_journal WHERE id = :id")
    suspend fun deleteJournalEntry(id: Long)
}
