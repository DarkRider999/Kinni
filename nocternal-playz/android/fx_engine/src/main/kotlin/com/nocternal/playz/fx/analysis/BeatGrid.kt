package com.nocternal.playz.fx.analysis

/** Beat-grid positions derived purely from the already-detected BPM — no extra decode pass. [firstBeatMs]
 *  is the estimated downbeat offset (defaults to 0, i.e. the track starts on a beat). */
object BeatGrid {
    fun beatsMs(durationMs: Long, bpm: Float, firstBeatMs: Float = 0f): List<Long> {
        if (bpm <= 0f || durationMs <= 0L) return emptyList()
        val periodMs = 60_000f / bpm
        val beats = ArrayList<Long>()
        var t = firstBeatMs
        while (t < durationMs) {
            if (t >= 0f) beats += t.toLong()
            t += periodMs
        }
        return beats
    }

    /** Bar (every 4th beat) positions, for a heavier marker every 4 beats. */
    fun barsMs(durationMs: Long, bpm: Float, firstBeatMs: Float = 0f): List<Long> =
        beatsMs(durationMs, bpm, firstBeatMs).filterIndexed { i, _ -> i % 4 == 0 }
}
