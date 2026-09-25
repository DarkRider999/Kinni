package com.nocternal.playz.theme

import com.nocternal.playz.model.EqPreset

/** Built-in EQ presets. Band order: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz. */
object EqPresets {
    val FLAT = EqPreset("flat", "Flat", List(10) { 0f })
    val VOCAL_CLARITY = EqPreset("vocal_clarity", "Vocal clarity", listOf(-2f, -1f, 0f, -1f, 1f, 3f, 4f, 3f, 1f, 0f))
    val AIRY_HIGHS = EqPreset("airy_highs", "Airy highs", listOf(-1f, -1f, 0f, 0f, 0f, 0f, 1f, 2f, 4f, 5f), surround = 0.3f)
    val BALANCED_LOWS = EqPreset("balanced_lows", "Balanced lows", listOf(2f, 2f, 1f, 0f, 0f, -1f, -2f, -3f, -4f, -5f), preampDb = -1f)
    val WARM_MIDS = EqPreset("warm_mids", "Warm mids", listOf(1f, 1f, 2f, 3f, 3f, 2f, 0f, -1f, -1f, -2f), preampDb = -2f)
    val EDM_PUNCH = EqPreset("edm_punch", "EDM punch", listOf(6f, 5f, 3f, 0f, -1f, 0f, 1f, 3f, 4f, 4f), preampDb = -4f, bassBoost = 0.4f)
    val TRANCE_WIDE = EqPreset("trance_wide", "Trance wide", listOf(4f, 4f, 2f, 0f, -1f, 0f, 2f, 3f, 4f, 3f), preampDb = -3f, surround = 0.5f)
    val TECHNO_SUB = EqPreset("techno_sub", "Techno sub", listOf(7f, 6f, 3f, 0f, -2f, -1f, 0f, 2f, 2f, 1f), preampDb = -5f, bassBoost = 0.5f)
    val NIGHT_DRIVE = EqPreset("night_drive", "Night drive", listOf(5f, 4f, 2f, 0f, -1f, 0f, 1f, 2f, 3f, 2f), preampDb = -3f, surround = 0.4f)
    val LOFI_WARM = EqPreset("lofi_warm", "Lo-fi warm", listOf(3f, 3f, 2f, 1f, 0f, 0f, -1f, -2f, -4f, -6f), preampDb = -2f)
    val CHILL_SMOOTH = EqPreset("chill_smooth", "Chill smooth", listOf(2f, 2f, 1f, 0f, 0f, 0f, 0f, 1f, 2f, 2f), preampDb = -1f, surround = 0.3f)
    val AMBIENT_SPACE = EqPreset("ambient_space", "Ambient space", listOf(1f, 1f, 0f, 0f, -1f, -1f, 0f, 1f, 3f, 4f), surround = 0.6f)
    val WORKOUT_BASS = EqPreset("workout_bass", "Workout bass", listOf(7f, 6f, 4f, 1f, 0f, 0f, 1f, 2f, 3f, 3f), preampDb = -5f, bassBoost = 0.6f, loudnessDb = 2f)
    val FOCUS_NEUTRAL = EqPreset("focus_neutral", "Focus neutral", listOf(0f, 0f, 0f, 0f, 0f, 0f, 0f, -1f, -1f, -2f))
    val ROMANTIC_WARM = EqPreset("romantic_warm", "Romantic warm", listOf(2f, 2f, 1f, 1f, 1f, 2f, 2f, 1f, 0f, 0f), preampDb = -2f)
    val PARTY_LOUD = EqPreset("party_loud", "Party loud", listOf(6f, 5f, 3f, 1f, 0f, 0f, 1f, 3f, 4f, 4f), preampDb = -4f, bassBoost = 0.5f, loudnessDb = 3f)
    val MORNING_BRIGHT = EqPreset("morning_bright", "Morning bright", listOf(0f, 0f, 0f, 0f, 1f, 1f, 2f, 3f, 3f, 2f))
    val INSTRUMENTAL_NATURAL = EqPreset("instrumental_natural", "Instrumental natural", listOf(1f, 1f, 0f, 0f, 0f, 0f, 0f, 1f, 1f, 1f), surround = 0.2f)
    val PODCAST_VOICE = EqPreset("podcast_voice", "Podcast voice", listOf(-6f, -4f, -1f, 0f, 2f, 3f, 4f, 2f, 0f, -2f), loudnessDb = 3f)
    val SPEAKER_BOOST = EqPreset("speaker_boost", "Speaker boost", listOf(-4f, -2f, 2f, 2f, 1f, 1f, 2f, 3f, 2f, 0f), preampDb = -2f, loudnessDb = 4f)

    val all: List<EqPreset> = listOf(
        FLAT, VOCAL_CLARITY, AIRY_HIGHS, BALANCED_LOWS, WARM_MIDS, EDM_PUNCH, TRANCE_WIDE, TECHNO_SUB,
        NIGHT_DRIVE, LOFI_WARM, CHILL_SMOOTH, AMBIENT_SPACE, WORKOUT_BASS, FOCUS_NEUTRAL, ROMANTIC_WARM,
        PARTY_LOUD, MORNING_BRIGHT, INSTRUMENTAL_NATURAL, PODCAST_VOICE, SPEAKER_BOOST,
    )

    private val byId = all.associateBy { it.id }
    fun byId(id: String): EqPreset = byId[id] ?: FLAT
}
