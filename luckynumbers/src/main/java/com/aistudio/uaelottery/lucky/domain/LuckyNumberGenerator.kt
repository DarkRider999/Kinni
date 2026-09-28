package com.aistudio.uaelottery.lucky.domain

import kotlin.random.Random

/**
 * Turns a birth date + draw date into a deterministic pick of numbers, and a
 * numerology "life path" digit, purely for entertainment. Lottery draws are
 * random; nothing here predicts or improves the odds of an actual draw.
 */
object LuckyNumberGenerator {

    fun generate(birthDate: String, drawDate: String, format: GameFormat): List<Int> {
        val seed = seedFrom(birthDate, drawDate)
        val random = Random(seed)
        val pool = (format.min..format.max).toMutableList()
        pool.shuffle(random)
        return pool.take(format.count).sorted()
    }

    fun lifePathNumber(birthDate: String): Int {
        var sum = birthDate.filter { it.isDigit() }.sumOf { it - '0' }
        while (sum > 9) {
            sum = sum.toString().sumOf { it - '0' }
        }
        return if (sum == 0) 9 else sum
    }

    private fun seedFrom(birthDate: String, drawDate: String): Long {
        var seed = 17L
        for (c in birthDate) seed = seed * 31 + c.code
        for (c in drawDate) seed = seed * 31 + c.code
        return seed
    }
}
