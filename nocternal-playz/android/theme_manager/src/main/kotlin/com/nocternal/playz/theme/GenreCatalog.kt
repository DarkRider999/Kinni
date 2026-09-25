package com.nocternal.playz.theme

import com.nocternal.playz.model.GenreDefinition
import com.nocternal.playz.model.Mood

/** All built-in, auto-curated genres. Order is the order of the genre tiles on Home and Library. */
object GenreCatalog {
    val DEVOTIONAL = GenreDefinition(
        id = "devotional", displayName = "Devotional", emoji = "🪔",
        themePresetId = "sacred_gold_aura", eqPresetId = "vocal_clarity",
        aliases = listOf("devotional", "bhajan", "bhakti", "aarti", "kirtan", "mantra", "gospel", "spiritual", "sufi", "qawwali", "chalisa", "stotram", "shabad"),
        aiSuggestions = listOf("Morning bhajans", "Aarti essentials", "Mantra chants for the day", "Sufi & qawwali evening"),
        radioTags = listOf("devotional", "bhajan", "spiritual"),
        defaultMood = Mood.SPIRITUAL, bpmMin = 60f, bpmMax = 110f,
    )
    val MEDITATION = GenreDefinition(
        id = "meditation", displayName = "Meditation", emoji = "🧘",
        themePresetId = "emerald_tranquility", eqPresetId = "airy_highs",
        aliases = listOf("meditation", "healing", "solfeggio", "432hz", "528hz", "binaural", "reiki", "yoga", "zen", "mindful", "tibetan", "singing bowl"),
        aiSuggestions = listOf("Healing frequencies (432 / 528 Hz)", "Guided breathing ambience", "Tibetan singing bowls", "Yoga flow"),
        radioTags = listOf("meditation", "healing", "yoga"),
        defaultMood = Mood.CALM, bpmMin = 40f, bpmMax = 80f,
    )
    val SLEEP = GenreDefinition(
        id = "sleep", displayName = "Sleep", emoji = "🌙",
        themePresetId = "moonlit_cyan_drift", eqPresetId = "balanced_lows",
        aliases = listOf("sleep", "rain", "white noise", "brown noise", "pink noise", "lullaby", "thunder", "ocean waves", "night sounds", "asmr"),
        aiSuggestions = listOf("Rain sounds", "Deep sleep drones", "Ocean waves", "Brown noise"),
        radioTags = listOf("sleep", "ambient", "relaxation"),
        defaultMood = Mood.SLEEPY, bpmMin = 0f, bpmMax = 75f,
    )
    val HINDI_CLASSICS = GenreDefinition(
        id = "hindi_classics", displayName = "Hindi Classics", emoji = "🎞️",
        themePresetId = "royal_purple_gold", eqPresetId = "warm_mids",
        aliases = listOf("hindi classic", "old hindi", "retro bollywood", "bollywood classic", "evergreen", "ghazal", "filmi", "golden era", "rafi", "lata", "kishore", "mukesh", "asha bhosle"),
        aiSuggestions = listOf("Golden era mix", "Rafi & Lata duets", "Kishore Kumar evergreens", "Ghazal night"),
        radioTags = listOf("bollywood", "hindi", "retro"),
        defaultMood = Mood.ROMANTIC, bpmMin = 70f, bpmMax = 130f,
    )
    val EDM = GenreDefinition(
        id = "edm", displayName = "EDM", emoji = "⚡",
        themePresetId = "electric_blue_pulse", eqPresetId = "edm_punch",
        aliases = listOf("edm", "electro", "house", "big room", "dubstep", "electronic dance", "future bass", "drum and bass", "dnb"),
        aiSuggestions = listOf("Festival main stage", "Future bass drops", "Progressive house journey"),
        radioTags = listOf("edm", "house", "electronic"),
        defaultMood = Mood.ENERGETIC, bpmMin = 120f, bpmMax = 175f,
    )
    val TRANCE = GenreDefinition(
        id = "trance", displayName = "Trance", emoji = "🌀",
        themePresetId = "violet_hyperspace", eqPresetId = "trance_wide",
        aliases = listOf("trance", "psytrance", "uplifting", "goa", "progressive trance", "vocal trance"),
        aiSuggestions = listOf("Uplifting trance anthems", "Psytrance voyage", "Vocal trance classics"),
        radioTags = listOf("trance", "psytrance"),
        defaultMood = Mood.ENERGETIC, bpmMin = 128f, bpmMax = 150f,
    )
    val TECHNO = GenreDefinition(
        id = "techno", displayName = "Techno", emoji = "🔴",
        themePresetId = "cyber_red_pulse", eqPresetId = "techno_sub",
        aliases = listOf("techno", "industrial", "minimal", "hard techno", "acid", "tech house"),
        aiSuggestions = listOf("Warehouse techno", "Minimal after-hours", "Acid lines"),
        radioTags = listOf("techno", "minimal"),
        defaultMood = Mood.ENERGETIC, bpmMin = 125f, bpmMax = 150f,
    )
    val NIGHT_DRIVE = GenreDefinition(
        id = "night_drive", displayName = "Night Drive", emoji = "🌃",
        themePresetId = "blue_purple_galaxy", eqPresetId = "night_drive",
        aliases = listOf("synthwave", "retrowave", "outrun", "night drive", "darkwave", "phonk", "vaporwave"),
        aiSuggestions = listOf("Synthwave highway", "Midnight phonk", "Neon city cruise"),
        radioTags = listOf("synthwave", "retrowave"),
        defaultMood = Mood.FOCUSED, bpmMin = 80f, bpmMax = 125f,
    )
    val LOFI = GenreDefinition(
        id = "lofi", displayName = "Lo-Fi", emoji = "☕",
        themePresetId = "soft_pink_glow", eqPresetId = "lofi_warm",
        aliases = listOf("lofi", "lo-fi", "lo fi", "chillhop", "jazzhop", "study beats", "bedroom"),
        aiSuggestions = listOf("Lo-fi study session", "Rainy café beats", "Late-night chillhop"),
        radioTags = listOf("lofi", "chillhop"),
        defaultMood = Mood.CALM, bpmMin = 65f, bpmMax = 95f,
    )
    val CHILLOUT = GenreDefinition(
        id = "chillout", displayName = "Chillout", emoji = "🌊",
        themePresetId = "aqua_drift", eqPresetId = "chill_smooth",
        aliases = listOf("chillout", "chill out", "chill", "downtempo", "lounge", "trip hop", "balearic", "chillwave"),
        aiSuggestions = listOf("Sunset lounge", "Downtempo drift", "Café del mar vibes"),
        radioTags = listOf("chillout", "lounge", "downtempo"),
        defaultMood = Mood.CALM, bpmMin = 70f, bpmMax = 115f,
    )
    val AMBIENT = GenreDefinition(
        id = "ambient", displayName = "Ambient", emoji = "🌌",
        themePresetId = "deep_space_indigo", eqPresetId = "ambient_space",
        aliases = listOf("ambient", "drone", "soundscape", "space music", "dark ambient", "new age"),
        aiSuggestions = listOf("Deep space drones", "Cinematic soundscapes", "Generative ambient"),
        radioTags = listOf("ambient", "space"),
        defaultMood = Mood.CALM, bpmMin = 0f, bpmMax = 90f,
    )
    val WORKOUT = GenreDefinition(
        id = "workout", displayName = "Workout", emoji = "💪",
        themePresetId = "volt_lime_surge", eqPresetId = "workout_bass",
        aliases = listOf("workout", "gym", "fitness", "running", "cardio", "hiit", "motivation", "trap", "hip hop", "rap"),
        aiSuggestions = listOf("HIIT 140 BPM", "Running 170 BPM cadence", "Heavy lifting hype"),
        radioTags = listOf("workout", "hiphop", "dance"),
        defaultMood = Mood.ENERGETIC, bpmMin = 120f, bpmMax = 180f,
    )
    val FOCUS = GenreDefinition(
        id = "focus", displayName = "Focus", emoji = "🎯",
        themePresetId = "laser_focus_teal", eqPresetId = "focus_neutral",
        aliases = listOf("focus", "study", "concentration", "deep work", "productivity", "coding", "alpha waves"),
        aiSuggestions = listOf("Deep work (no vocals)", "Alpha-wave focus", "Coding flow state"),
        radioTags = listOf("study", "focus", "instrumental"),
        defaultMood = Mood.FOCUSED, bpmMin = 60f, bpmMax = 120f,
    )
    val ROMANTIC = GenreDefinition(
        id = "romantic", displayName = "Romantic", emoji = "💖",
        themePresetId = "rose_neon_heart", eqPresetId = "romantic_warm",
        aliases = listOf("romantic", "love", "romance", "r&b", "rnb", "soul", "ballad", "slow jam"),
        aiSuggestions = listOf("Love ballads", "Bollywood romance", "Late-night R&B"),
        radioTags = listOf("love songs", "rnb", "soul"),
        defaultMood = Mood.ROMANTIC, bpmMin = 60f, bpmMax = 110f,
    )
    val PARTY_MIX = GenreDefinition(
        id = "party_mix", displayName = "Party Mix", emoji = "🎉",
        themePresetId = "rainbow_rave", eqPresetId = "party_loud",
        aliases = listOf("party", "dance", "club", "bollywood dance", "punjabi", "bhangra", "reggaeton", "pop dance", "disco"),
        aiSuggestions = listOf("Bollywood party bangers", "Punjabi bhangra", "Club anthems"),
        radioTags = listOf("dance", "party", "club"),
        defaultMood = Mood.PARTY, bpmMin = 100f, bpmMax = 135f,
    )
    val MORNING_VIBES = GenreDefinition(
        id = "morning_vibes", displayName = "Morning Vibes", emoji = "🌅",
        themePresetId = "sunrise_amber", eqPresetId = "morning_bright",
        aliases = listOf("morning", "acoustic", "indie pop", "folk", "sunrise", "coffee", "feel good"),
        aiSuggestions = listOf("Acoustic sunrise", "Feel-good morning", "Coffee-shop indie"),
        radioTags = listOf("acoustic", "indie", "pop"),
        defaultMood = Mood.HAPPY, bpmMin = 80f, bpmMax = 125f,
    )
    val INSTRUMENTAL = GenreDefinition(
        id = "instrumental", displayName = "Instrumental", emoji = "🎻",
        themePresetId = "silver_strings", eqPresetId = "instrumental_natural",
        aliases = listOf("instrumental", "classical", "piano", "orchestral", "soundtrack", "score", "sitar", "flute", "guitar", "hindustani", "carnatic"),
        aiSuggestions = listOf("Solo piano", "Indian classical ragas", "Epic film scores"),
        radioTags = listOf("classical", "instrumental", "soundtrack"),
        defaultMood = Mood.FOCUSED,
    )
    val PODCAST_MODE = GenreDefinition(
        id = "podcast_mode", displayName = "Podcast Mode", emoji = "🎙️",
        themePresetId = "studio_mono_blue", eqPresetId = "podcast_voice",
        aliases = listOf("podcast", "talk", "spoken word", "audiobook", "speech", "news", "interview", "episode"),
        aiSuggestions = listOf("Resume last episode", "Speech-boosted listening", "News briefing"),
        radioTags = listOf("talk", "news", "podcast"),
        defaultMood = Mood.FOCUSED,
    )

    /** The four headline genres come first, then the other built-ins, then the extra theme genres. */
    val all: List<GenreDefinition> = listOf(
        DEVOTIONAL, MEDITATION, SLEEP, HINDI_CLASSICS,
        LOFI, CHILLOUT, AMBIENT, WORKOUT, FOCUS, ROMANTIC, PARTY_MIX, MORNING_VIBES, NIGHT_DRIVE, INSTRUMENTAL, PODCAST_MODE,
        EDM, TRANCE, TECHNO,
    )

    private val byId = all.associateBy { it.id }
    fun byId(id: String): GenreDefinition? = byId[id]

    /** Genre → theme preset map used by the switching logic ("genreThemeMap" in the spec). */
    val genreThemeMap: Map<String, String> = all.associate { it.id to it.themePresetId }
}
