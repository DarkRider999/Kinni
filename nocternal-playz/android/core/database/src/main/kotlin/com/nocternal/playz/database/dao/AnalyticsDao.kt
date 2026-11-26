package com.nocternal.playz.database.dao

import androidx.room.*
import com.nocternal.playz.database.entity.AnalyticsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AnalyticsDao {
    @Query("SELECT * FROM analytics WHERE trackId = :trackId ORDER BY recordedAt DESC")
    fun getAnalyticsForTrack(trackId: String): Flow<List<AnalyticsEntity>>

    @Query("SELECT * FROM analytics WHERE eventType = :eventType ORDER BY recordedAt DESC LIMIT :limit")
    suspend fun getAnalyticsByEventType(eventType: String, limit: Int = 100): List<AnalyticsEntity>

    @Insert
    suspend fun insertAnalytics(analytics: AnalyticsEntity)

    @Query("DELETE FROM analytics WHERE recordedAt < :beforeTimestamp")
    suspend fun clearOldAnalytics(beforeTimestamp: Long)

    @Query("SELECT COUNT(*) FROM analytics WHERE eventType = 'play'")
    suspend fun getTotalPlays(): Int
}
