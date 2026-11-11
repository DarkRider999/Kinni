package com.aistudio.uaelottery.lucky.data.repository

import com.aistudio.uaelottery.lucky.data.db.LotteryDao
import com.aistudio.uaelottery.lucky.data.db.PastDrawEntity
import kotlinx.coroutines.flow.Flow

class LotteryRepository(private val dao: LotteryDao) {

    val pastDraws: Flow<List<PastDrawEntity>> = dao.getAll()

    suspend fun addDraw(drawDate: String, numbers: List<Int>, gameLabel: String) {
        dao.insert(PastDrawEntity(drawDate = drawDate, numbersCsv = numbers.joinToString(","), gameLabel = gameLabel))
    }

    suspend fun deleteDraw(draw: PastDrawEntity) {
        dao.delete(draw)
    }
}
