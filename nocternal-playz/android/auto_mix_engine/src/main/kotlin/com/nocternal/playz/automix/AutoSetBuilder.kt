package com.nocternal.playz.automix

import com.nocternal.playz.model.Track

/** One step of a built DJ set: the track and the [TransitionPlan] used to blend into it (null for the first track). */
data class SetStep(val track: Track, val transitionIn: TransitionPlan?)

/**
 * Auto Set Builder (DJ Deck, spec §6-14): greedily chains [AutoMixPlanner.next] picks into a full set —
 * the same key/tempo/energy scoring auto-mix already uses live, run ahead of time so the DJ Deck can show
 * the whole set (and its Camelot-wheel transitions) before a single track plays.
 */
class AutoSetBuilder(private val planner: AutoMixPlanner = AutoMixPlanner()) {
    fun build(start: Track, pool: List<Track>, length: Int = 10, wantEnergyRise: Boolean = false): List<SetStep> {
        val steps = mutableListOf(SetStep(start, null))
        val used = mutableSetOf(start.id)
        var current = start
        while (steps.size < length) {
            val next = planner.next(current, pool, used, wantEnergyRise)?.track ?: break
            steps += SetStep(next, planner.plan(current, next))
            used += next.id
            current = next
        }
        return steps
    }
}
