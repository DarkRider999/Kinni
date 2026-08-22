package com.example.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.data.model.ChecklistItemEntity
import com.example.data.model.HydrationRecord
import com.example.data.model.KickSessionEntity
import com.example.data.model.PregnancyJournalEntity

@Database(
    entities = [
        HydrationRecord::class,
        ChecklistItemEntity::class,
        KickSessionEntity::class,
        PregnancyJournalEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class KinniDatabase : RoomDatabase() {
    abstract fun kinniDao(): KinniDao

    companion object {
        @Volatile
        private var INSTANCE: KinniDatabase? = null

        fun getDatabase(context: Context): KinniDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    KinniDatabase::class.java,
                    "kinni_pregnancy_db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
