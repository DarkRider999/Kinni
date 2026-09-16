package com.aistudio.uaelottery.lucky.domain

data class GameFormat(val label: String, val count: Int, val min: Int, val max: Int)

object GameFormats {
    // All pools are capped below 31 (1-30) so every generated number stays under 31.
    val EZ2 = GameFormat("EZ2 — pick 2 of 1-25", count = 2, min = 1, max = 25)
    val FAST5 = GameFormat("Fast5 — pick 5 of 1-30", count = 5, min = 1, max = 30)
    val MEGA7 = GameFormat("Mega7 — pick 7 of 1-30", count = 7, min = 1, max = 30)

    val PRESETS = listOf(EZ2, FAST5, MEGA7)
}
