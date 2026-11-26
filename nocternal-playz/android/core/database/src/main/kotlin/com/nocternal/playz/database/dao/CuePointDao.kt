package com.nocternal.playz.database.dao

import androidx.room.*
import com.nocternal.playz.database.entity.CuePointEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CuePointDao {
    @Query("SELECT * FROM cue_points WHERE trackId = :trackId ORDER BY positionMs ASC")
    fun getCuePointsForTrack(trackId: String): Flow<List<CuePointEntity>>

    @Query("SELECT * FROM cue_points WHERE trackId = :trackId AND isHotCue = 1 ORDER BY hotCueIndex ASC")
    suspend fun getHotCuesForTrack(trackId: String): List<CuePointEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCuePoint(cuePoint: CuePointEntity): Long

    @Update
    suspend fun updateCuePoint(cuePoint: CuePointEntity)

    @Delete
    suspend fun deleteCuePoint(cuePoint: CuePointEntity)

    @Query("DELETE FROM cue_points WHERE trackId = :trackId")
    suspend fun deleteAllCuePointsForTrack(trackId: String)
}
