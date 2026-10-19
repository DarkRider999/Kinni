package com.nocternal.playz.intelligence

import com.nocternal.playz.automix.AutoSetBuilder
import com.nocternal.playz.automix.SetStep
import com.nocternal.playz.automix.TransitionPlan
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Track
import com.nocternal.playz.theme.GenreDetector

/** One planned stop on the journey: the track, why it follows the last one, and its DNA energy. */
data class JourneyStep(val track: Track, val transitionIn: TransitionPlan?, val energy: Float, val mood: Mood)

data class JourneyPlan(
    val label: String,
    val steps: List<JourneyStep>,
    /** The energy value targeted at each step — what the "energy curve" chart plots. */
    val energyCurve: List<Float>,
    val moodTransitions: List<Mood>,
    val estimatedDurationMs: Long,
) {
    val trackCount: Int get() = steps.size
}

/**
 * AI Journey Mode (Phase 4A, spec #1): "90 minute Progressive House Journey", "Late Night Techno
 * Drive", "Sunset Deep House", "Festival Warmup Set" — a single free-text prompt (the same
 * [PromptPlaylistParser] Discover already uses) turned into a complete, orderable set.
 *
 * Pure composition of engines that already shipped and are already tested: [PromptPlaylistBuilder]
 * narrows the library to the prompt's genre/mood/energy, [FutureCast] supplies a seed that leans on
 * the listener's own habits when the prompt is vague, and [AutoSetBuilder] (DJ Deck, Phase 3) does
 * the harmonic/tempo/energy-aware ordering. No new scoring math, no audio engine changes.
 */
class JourneyPlanner(
    private val genres: GenreDetector = GenreDetector(),
    private val dna: SongDnaAnalyzer = SongDnaAnalyzer(genres),
    private val moods: MoodClassifier = MoodClassifier(genres, dna),
    private val promptBuilder: PromptPlaylistBuilder = PromptPlaylistBuilder(genres, moods),
    private val futureCast: FutureCast = FutureCast(RecommendationEngine2(dna), dna),
    private val autoSetBuilder: AutoSetBuilder = AutoSetBuilder(),
) {
    /** Energy arcs implied by the words DJs actually use for a "warmup" vs a "peak" set. */
    private val coolingWords = listOf("warmup", "warm up", "warm-up", "sunset", "chill", "cool down", "cooldown", "wind down", "after hours", "late night", "deep house")
    private val risingWords = listOf("peak", "build", "drive", "festival", "workout", "energy", "hype")

    private val defaultTrackMs = 210_000L

    fun plan(promptText: String, library: List<Track>, history: List<PlayEvent>, hourOfDay: Int, nowPlaying: Track?): JourneyPlan? {
        if (library.isEmpty()) return null
        val prompt = PromptPlaylistParser.parse(promptText)
        val matched = promptBuilder.build(prompt, library, limit = 300)
        val pool = matched.ifEmpty { library }

        val avgTrackMs = pool.map { it.durationMs }.filter { it > 0 }.average().takeIf { !it.isNaN() }?.toLong() ?: defaultTrackMs
        val requestedMs = prompt.durationMinutes?.let { it * 60_000L }
        val slotCount = (requestedMs?.div(avgTrackMs) ?: 10L).toInt().coerceIn(3, 40).coerceAtMost(pool.size)
        if (slotCount < 1) return null

        val trackById = library.associateBy { it.id }
        val seed = futureCast.predict(nowPlaying, hourOfDay, history, trackById, pool, size = 1).firstOrNull()?.track
            ?: pool.maxByOrNull { dna.analyze(it).energy }
            ?: pool.first()

        val lower = promptText.lowercase()
        val wantRise = when {
            risingWords.any { it in lower } -> true
            coolingWords.any { it in lower } -> false
            prompt.mood == Mood.CALM || prompt.mood == Mood.SLEEPY -> false
            prompt.mood == Mood.PARTY || prompt.mood == Mood.ENERGETIC || prompt.mood == Mood.AGGRESSIVE -> true
            else -> true
        }

        val built: List<SetStep> = autoSetBuilder.build(seed, pool, length = slotCount, wantEnergyRise = wantRise)
        if (built.isEmpty()) return null

        val steps = built.map { JourneyStep(it.track, it.transitionIn, dna.analyze(it.track).energy, moods.classify(it.track).mood) }
        val totalMs = built.sumOf { if (it.track.durationMs > 0) it.track.durationMs else avgTrackMs }

        return JourneyPlan(
            label = prompt.label, steps = steps, energyCurve = steps.map { it.energy },
            moodTransitions = steps.map { it.mood }, estimatedDurationMs = totalMs,
        )
    }
}
