package com.aistudio.uaelottery.lucky.domain

data class GameFormat(val label: String, val count: Int, val min: Int, val max: Int)

object GameFormats {
    val EZ2 = GameFormat("EZ2 — pick 2 of 1-25", count = 2, min = 1, max = 25)
    val FAST5 = GameFormat("Fast5 — pick 5 of 1-38", count = 5, min = 1, max = 38)
    val MEGA7 = GameFormat("Mega7 — pick 7 of 1-49", count = 7, min = 1, max = 49)

    val PRESETS = listOf(EZ2, FAST5, MEGA7)
}
