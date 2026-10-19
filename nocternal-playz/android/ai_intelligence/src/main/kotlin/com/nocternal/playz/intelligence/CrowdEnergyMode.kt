package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Track

/** A named target energy arc (spec: Crowd Energy Mode) — a shape to build a set/queue around, not a live DSP effect. */
data class EnergyCurve(val id: String, val label: String, val shape: List<Float>)

object CrowdEnergyPresets {
    val WARM_UP = EnergyCurve("warm_up", "Warm Up", listOf(0.25f, 0.3f, 0.35f, 0.4f, 0.45f, 0.5f))
    val BUILD = EnergyCurve("build", "Build", listOf(0.3f, 0.45f, 0.55f, 0.65f, 0.75f, 0.85f))
    val PEAK_TIME = EnergyCurve("peak_time", "Peak Time", listOf(0.8f, 0.85f, 0.9f, 0.95f, 0.9f, 0.85f))
    val COOL_DOWN = EnergyCurve("cool_down", "Cool Down", listOf(0.75f, 0.65f, 0.55f, 0.45f, 0.35f, 0.3f))
    val SUNSET_CHILL = EnergyCurve("sunset_chill", "Sunset Chill", listOf(0.4f, 0.35f, 0.3f, 0.3f, 0.25f, 0.2f))
    val AFTER_HOURS = EnergyCurve("after_hours", "After Hours", listOf(0.5f, 0.45f, 0.4f, 0.35f, 0.3f, 0.25f))

    val all: List<EnergyCurve> = listOf(WARM_UP, BUILD, PEAK_TIME, COOL_DOWN, SUNSET_CHILL, AFTER_HOURS)
    fun byId(id: String): EnergyCurve? = all.firstOrNull { it.id == id }
}

/** Builds a queue whose energy follows an [EnergyCurve]'s shape, one pick per slot, each track used once. */
class CrowdEnergyBuilder(private val dna: SongDnaAnalyzer = SongDnaAnalyzer()) {
    fun build(curve: EnergyCurve, pool: List<Track>): List<Track> {
        if (pool.isEmpty()) return emptyList()
        val remaining = pool.toMutableList()
        val result = mutableListOf<Track>()
        for (target in curve.shape) {
            if (remaining.isEmpty()) break
            val pick = remaining.minByOrNull { kotlin.math.abs(dna.analyze(it).energy - target) } ?: break
            result += pick
            remaining -= pick
        }
        return result
    }
}
