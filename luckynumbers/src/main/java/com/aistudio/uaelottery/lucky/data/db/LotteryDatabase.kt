package com.aistudio.uaelottery.lucky.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [PastDrawEntity::class], version = 1, exportSchema = false)
abstract class LotteryDatabase : RoomDatabase() {
    abstract fun lotteryDao(): LotteryDao

    companion object {
        @Volatile
        private var INSTANCE: LotteryDatabase? = null

        fun getDatabase(context: Context): LotteryDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    LotteryDatabase::class.java,
                    "lucky_numbers_db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
