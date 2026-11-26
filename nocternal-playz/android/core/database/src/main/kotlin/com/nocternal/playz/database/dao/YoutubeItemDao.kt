package com.nocternal.playz.database.dao

import androidx.room.*
import com.nocternal.playz.database.entity.YoutubeItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface YoutubeItemDao {
    @Query("SELECT * FROM youtube_items ORDER BY addedAt DESC")
    fun getAllYoutubeItems(): Flow<List<YoutubeItemEntity>>

    @Query("SELECT * FROM youtube_items WHERE playlistId = :playlistId ORDER BY addedAt DESC")
    fun getYoutubeItemsByPlaylist(playlistId: String): Flow<List<YoutubeItemEntity>>

    @Query("SELECT * FROM youtube_items WHERE videoId = :videoId")
    suspend fun getYoutubeItemById(videoId: String): YoutubeItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertYoutubeItem(item: YoutubeItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertYoutubeItems(items: List<YoutubeItemEntity>)

    @Update
    suspend fun updateYoutubeItem(item: YoutubeItemEntity)

    @Delete
    suspend fun deleteYoutubeItem(item: YoutubeItemEntity)
}
