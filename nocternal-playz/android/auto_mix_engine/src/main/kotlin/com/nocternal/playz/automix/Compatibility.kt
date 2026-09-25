package com.nocternal.playz.automix

import com.nocternal.playz.model.MusicalKey
import kotlin.math.abs
import kotlin.math.min

/** Harmonic relationship between two keys on the Camelot wheel. */
enum class KeyRelation(val score: Float, val label: String) {
    SAME(1.0f, "same key"),
    RELATIVE(0.9f, "relative major/minor"),
    ADJACENT(0.85f, "±1 on the wheel"),
    ENERGY_BOOST(0.6f, "+2 energy boost"),
    DIAGONAL(0.5f, "diagonal mix"),
    CLASH(0.0f, "key clash"),
    UNKNOWN(0.4f, "key unknown"),
}

object Harmonic {
    fun relation(a: MusicalKey?, b: MusicalKey?): KeyRelation {
        if (a == null || b == null) return KeyRelation.UNKNOWN
        val na = a.camelotNumber; val nb = b.camelotNumber
        val step = wheelDistance(na, nb)
        val sameMode = a.minor == b.minor
        return when {
            step == 0 && sameMode -> KeyRelation.SAME
            step == 0 -> KeyRelation.RELATIVE
            step == 1 && sameMode -> KeyRelation.ADJACENT
            step == 2 && sameMode && (nb - na + 12) % 12 == 2 -> KeyRelation.ENERGY_BOOST
            step == 1 -> KeyRelation.DIAGONAL
            else -> KeyRelation.CLASH
        }
    }

    fun wheelDistance(a: Int, b: Int): Int { val d = abs(a - b) % 12; return min(d, 12 - d) }
}

/** Tempo relationship, allowing half/double time (e.g. 70 ↔ 140 BPM). */
data class TempoMatch(val targetBpm: Float, val ratio: Float, val score: Float)

object Tempo {
    /** How to play [next] so its beat lines up with [current]; ratio is the playback-rate change for [next]. */
    fun match(current: Float?, next: Float?, maxStretch: Float = 0.08f): TempoMatch {
        if (current == null || next == null || current <= 0 || next <= 0) return TempoMatch(next ?: 0f, 1f, 0.4f)
        val candidates = listOf(next, next * 2, next / 2)
        val best = candidates.minBy { abs(current / it - 1f) }
        val ratio = current / best
        val stretch = abs(ratio - 1f)
        val score = if (stretch > maxStretch) 0f else 1f - stretch / maxStretch * 0.7f
        return TempoMatch(current, if (stretch > maxStretch) 1f else ratio, score)
    }
}
