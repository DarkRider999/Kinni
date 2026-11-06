package com.nocternal.playz.database.dao

import androidx.room.*
import com.nocternal.playz.database.entity.HistoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface HistoryDao {
    @Query("SELECT * FROM history ORDER BY playedAt DESC LIMIT :limit")
    fun getRecentHistory(limit: Int = 50): Flow<List<HistoryEntity>>

    @Query("SELECT trackId, COUNT(*) as count FROM history GROUP BY trackId ORDER BY count DESC LIMIT :limit")
    suspend fun getMostPlayedTrackIds(limit: Int = 20): List<String>

    @Insert
    suspend fun insertHistory(history: HistoryEntity)

    @Query("DELETE FROM history WHERE playedAt < :beforeTimestamp")
    suspend fun clearOldHistory(beforeTimestamp: Long)

    @Query("SELECT COUNT(*) FROM history")
    suspend fun getTotalPlayCount(): Int
}
