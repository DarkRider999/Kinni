package com.aistudio.uaelottery.lucky.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LotteryDao {
    @Insert
    suspend fun insert(draw: PastDrawEntity)

    @Delete
    suspend fun delete(draw: PastDrawEntity)

    @Query("SELECT * FROM past_draws ORDER BY drawDate DESC, id DESC")
    fun getAll(): Flow<List<PastDrawEntity>>
}
