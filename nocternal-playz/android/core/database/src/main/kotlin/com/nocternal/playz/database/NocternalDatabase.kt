package com.nocternal.playz.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.nocternal.playz.database.dao.*
import com.nocternal.playz.database.entity.*

@Database(
    entities = [
        TrackEntity::class,
        PlaylistEntity::class,
        PlaylistTrackEntity::class,
        HistoryEntity::class,
        CuePointEntity::class,
        RadioStationEntity::class,
        YoutubeItemEntity::class,
        LightingProfileEntity::class,
        AnalyticsEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class NocternalDatabase : RoomDatabase() {
    abstract fun trackDao(): TrackDao
    abstract fun playlistDao(): PlaylistDao
    abstract fun historyDao(): HistoryDao
    abstract fun cuePointDao(): CuePointDao
    abstract fun radioStationDao(): RadioStationDao
    abstract fun youtubeItemDao(): YoutubeItemDao
    abstract fun analyticsDao(): AnalyticsDao

    companion object {
        @Volatile private var INSTANCE: NocternalDatabase? = null

        fun getInstance(context: Context): NocternalDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    NocternalDatabase::class.java,
                    "nocternal_database"
                ).build().also { INSTANCE = it }
            }
    }
}
