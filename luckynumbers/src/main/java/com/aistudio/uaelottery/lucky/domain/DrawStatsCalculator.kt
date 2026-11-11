package com.aistudio.uaelottery.lucky.domain

import com.aistudio.uaelottery.lucky.data.db.PastDrawEntity

object DrawStatsCalculator {

    data class NumberFrequency(val number: Int, val count: Int)

    /** Frequency of each number across the draws entered so far, most-seen first. */
    fun frequencies(draws: List<PastDrawEntity>): List<NumberFrequency> {
        val counts = mutableMapOf<Int, Int>()
        draws.forEach { draw ->
            draw.numbersCsv.split(",")
                .mapNotNull { it.trim().toIntOrNull() }
                .forEach { number -> counts[number] = (counts[number] ?: 0) + 1 }
        }
        return counts.entries
            .map { NumberFrequency(it.key, it.value) }
            .sortedWith(compareByDescending<NumberFrequency> { it.count }.thenBy { it.number })
    }
}
