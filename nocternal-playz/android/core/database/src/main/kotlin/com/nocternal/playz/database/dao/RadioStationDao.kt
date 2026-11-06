package com.nocternal.playz.database.dao

import androidx.room.*
import com.nocternal.playz.database.entity.RadioStationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RadioStationDao {
    @Query("SELECT * FROM radio_stations ORDER BY name ASC")
    fun getAllStations(): Flow<List<RadioStationEntity>>

    @Query("SELECT * FROM radio_stations WHERE isFavorite = 1 ORDER BY name ASC")
    fun getFavoriteStations(): Flow<List<RadioStationEntity>>

    @Query("SELECT * FROM radio_stations WHERE genre = :genre ORDER BY name ASC")
    fun getStationsByGenre(genre: String): Flow<List<RadioStationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStation(station: RadioStationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStations(stations: List<RadioStationEntity>)

    @Update
    suspend fun updateStation(station: RadioStationEntity)

    @Delete
    suspend fun deleteStation(station: RadioStationEntity)

    @Query("UPDATE radio_stations SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun setFavorite(id: String, isFavorite: Boolean)
}
