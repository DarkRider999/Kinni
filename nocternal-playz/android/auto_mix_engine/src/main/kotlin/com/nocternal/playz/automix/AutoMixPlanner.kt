package com.nocternal.playz.automix

import com.nocternal.playz.model.MusicalKey
import com.nocternal.playz.model.Track
import kotlin.math.abs

/** How two tracks are blended. */
data class TransitionPlan(
    val from: Track,
    val to: Track,
    /** Position in [from] (ms) where the blend starts. */
    val startAtMs: Long,
    val durationMs: Long,
    /** Playback-rate multiplier for [to] during the blend (1 = unchanged); eased back to 1 afterwards. */
    val tempoRatio: Float,
    val curve: CrossfadeCurve,
    /** Swap basses halfway so two kick drums never stack. */
    val bassSwap: Boolean,
    val keyRelation: KeyRelation,
    val score: Float,
    val explanation: String,
)

/**
 * DJ auto-mix (spec §11.8): picks the next track by BPM + key compatibility, energy flow and variety, then
 * plans a beat-aligned transition.
 */
class AutoMixPlanner(
    private val keyWeight: Float = 0.45f,
    private val tempoWeight: Float = 0.4f,
    private val energyWeight: Float = 0.15f,
) {
    data class Candidate(val track: Track, val score: Float, val relation: KeyRelation, val tempo: TempoMatch)

    fun rank(current: Track, pool: List<Track>, recentlyPlayed: Set<String> = emptySet(), wantEnergyRise: Boolean = false): List<Candidate> {
        val ck = current.camelotKey?.let(MusicalKey::fromCamelot)
        return pool.asSequence()
            .filter { it.id != current.id && it.id !in recentlyPlayed }
            .map { t ->
                val rel = Harmonic.relation(ck, t.camelotKey?.let(MusicalKey::fromCamelot))
                val tempo = Tempo.match(current.bpm, t.bpm)
                val energyDelta = (t.energy ?: 0.5f) - (current.energy ?: 0.5f)
                val energyScore = if (wantEnergyRise) (0.5f + energyDelta).coerceIn(0f, 1f) else 1f - abs(energyDelta)
                val score = rel.score * keyWeight + tempo.score * tempoWeight + energyScore * energyWeight
                Candidate(t, score, rel, tempo)
            }
            .sortedByDescending { it.score }
            .toList()
    }

    fun next(current: Track, pool: List<Track>, recentlyPlayed: Set<String> = emptySet()): Candidate? = rank(current, pool, recentlyPlayed).firstOrNull()

    /**
     * Plans the blend. Transition length is a whole number of bars (8 or 16 at the current tempo), clamped to
     * [minFadeMs]..[maxFadeMs]; without tempo info it falls back to [defaultFadeMs].
     */
    fun plan(from: Track, to: Track, defaultFadeMs: Long = 3000, minFadeMs: Long = 2000, maxFadeMs: Long = 16000): TransitionPlan {
        val rel = Harmonic.relation(from.camelotKey?.let(MusicalKey::fromCamelot), to.camelotKey?.let(MusicalKey::fromCamelot))
        val tempo = Tempo.match(from.bpm, to.bpm)
        val beatMs = from.bpm?.let { 60000f / it }
        val duration = if (beatMs != null && tempo.score > 0f) {
            val bars = if (rel.score >= 0.85f) 16 else 8
            (bars * 4 * beatMs).toLong().coerceIn(minFadeMs, maxFadeMs)
        } else defaultFadeMs
        val startAt = (from.durationMs - duration).coerceAtLeast(0)
        // Snap the start to a bar line when the tempo is known.
        val snapped = if (beatMs != null) ((startAt / (beatMs * 4)).toLong() * (beatMs * 4)).toLong() else startAt
        val curve = when {
            tempo.score > 0f && rel.score >= 0.85f -> CrossfadeCurve.EQUAL_POWER
            tempo.score == 0f -> CrossfadeCurve.S_CURVE
            else -> CrossfadeCurve.EQUAL_POWER
        }
        val explanation = buildString {
            append(rel.label)
            from.bpm?.let { fb -> to.bpm?.let { tb -> append(", ${fb.toInt()}→${tb.toInt()} BPM") } }
            if (tempo.ratio != 1f) append(" (tempo ${"%+.1f".format((tempo.ratio - 1) * 100)}%)")
            append(", ${duration / 1000}s blend")
        }
        return TransitionPlan(from, to, snapped, duration, tempo.ratio, curve, bassSwap = tempo.score > 0f, rel, tempo.score * 0.5f + rel.score * 0.5f, explanation)
    }
}
