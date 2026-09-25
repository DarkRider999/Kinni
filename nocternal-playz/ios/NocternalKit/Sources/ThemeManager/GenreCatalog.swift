import Foundation
import NocternalModel

/// Built-in, auto-curated genres (generated from the Kotlin GenreCatalog).
public enum GenreCatalog {
    public static let devotional = GenreDefinition(id: "devotional", displayName: "Devotional", emoji: "🪔", themePresetId: "sacred_gold_aura", eqPresetId: "vocal_clarity",
        aliases: ["devotional", "bhajan", "bhakti", "aarti", "kirtan", "mantra", "gospel", "spiritual", "sufi", "qawwali", "chalisa", "stotram", "shabad"],
        aiSuggestions: ["Morning bhajans", "Aarti essentials", "Mantra chants for the day", "Sufi & qawwali evening"],
        radioTags: ["devotional", "bhajan", "spiritual"], defaultMood: .spiritual, bpmMin: 60, bpmMax: 110)
    public static let meditation = GenreDefinition(id: "meditation", displayName: "Meditation", emoji: "🧘", themePresetId: "emerald_tranquility", eqPresetId: "airy_highs",
        aliases: ["meditation", "healing", "solfeggio", "432hz", "528hz", "binaural", "reiki", "yoga", "zen", "mindful", "tibetan", "singing bowl"],
        aiSuggestions: ["Healing frequencies (432 / 528 Hz],
        radioTags: ["meditation", "healing", "yoga"], defaultMood: .calm, bpmMin: 40, bpmMax: 80)
    public static let sleep = GenreDefinition(id: "sleep", displayName: "Sleep", emoji: "🌙", themePresetId: "moonlit_cyan_drift", eqPresetId: "balanced_lows",
        aliases: ["sleep", "rain", "white noise", "brown noise", "pink noise", "lullaby", "thunder", "ocean waves", "night sounds", "asmr"],
        aiSuggestions: ["Rain sounds", "Deep sleep drones", "Ocean waves", "Brown noise"],
        radioTags: ["sleep", "ambient", "relaxation"], defaultMood: .sleepy, bpmMin: 0, bpmMax: 75)
    public static let hindiClassics = GenreDefinition(id: "hindi_classics", displayName: "Hindi Classics", emoji: "🎞️", themePresetId: "royal_purple_gold", eqPresetId: "warm_mids",
        aliases: ["hindi classic", "old hindi", "retro bollywood", "bollywood classic", "evergreen", "ghazal", "filmi", "golden era", "rafi", "lata", "kishore", "mukesh", "asha bhosle"],
        aiSuggestions: ["Golden era mix", "Rafi & Lata duets", "Kishore Kumar evergreens", "Ghazal night"],
        radioTags: ["bollywood", "hindi", "retro"], defaultMood: .romantic, bpmMin: 70, bpmMax: 130)
    public static let edm = GenreDefinition(id: "edm", displayName: "EDM", emoji: "⚡", themePresetId: "electric_blue_pulse", eqPresetId: "edm_punch",
        aliases: ["edm", "electro", "house", "big room", "dubstep", "electronic dance", "future bass", "drum and bass", "dnb"],
        aiSuggestions: ["Festival main stage", "Future bass drops", "Progressive house journey"],
        radioTags: ["edm", "house", "electronic"], defaultMood: .energetic, bpmMin: 120, bpmMax: 175)
    public static let trance = GenreDefinition(id: "trance", displayName: "Trance", emoji: "🌀", themePresetId: "violet_hyperspace", eqPresetId: "trance_wide",
        aliases: ["trance", "psytrance", "uplifting", "goa", "progressive trance", "vocal trance"],
        aiSuggestions: ["Uplifting trance anthems", "Psytrance voyage", "Vocal trance classics"],
        radioTags: ["trance", "psytrance"], defaultMood: .energetic, bpmMin: 128, bpmMax: 150)
    public static let techno = GenreDefinition(id: "techno", displayName: "Techno", emoji: "🔴", themePresetId: "cyber_red_pulse", eqPresetId: "techno_sub",
        aliases: ["techno", "industrial", "minimal", "hard techno", "acid", "tech house"],
        aiSuggestions: ["Warehouse techno", "Minimal after-hours", "Acid lines"],
        radioTags: ["techno", "minimal"], defaultMood: .energetic, bpmMin: 125, bpmMax: 150)
    public static let nightDrive = GenreDefinition(id: "night_drive", displayName: "Night Drive", emoji: "🌃", themePresetId: "blue_purple_galaxy", eqPresetId: "night_drive",
        aliases: ["synthwave", "retrowave", "outrun", "night drive", "darkwave", "phonk", "vaporwave"],
        aiSuggestions: ["Synthwave highway", "Midnight phonk", "Neon city cruise"],
        radioTags: ["synthwave", "retrowave"], defaultMood: .focused, bpmMin: 80, bpmMax: 125)
    public static let lofi = GenreDefinition(id: "lofi", displayName: "Lo-Fi", emoji: "☕", themePresetId: "soft_pink_glow", eqPresetId: "lofi_warm",
        aliases: ["lofi", "lo-fi", "lo fi", "chillhop", "jazzhop", "study beats", "bedroom"],
        aiSuggestions: ["Lo-fi study session", "Rainy café beats", "Late-night chillhop"],
        radioTags: ["lofi", "chillhop"], defaultMood: .calm, bpmMin: 65, bpmMax: 95)
    public static let chillout = GenreDefinition(id: "chillout", displayName: "Chillout", emoji: "🌊", themePresetId: "aqua_drift", eqPresetId: "chill_smooth",
        aliases: ["chillout", "chill out", "chill", "downtempo", "lounge", "trip hop", "balearic", "chillwave"],
        aiSuggestions: ["Sunset lounge", "Downtempo drift", "Café del mar vibes"],
        radioTags: ["chillout", "lounge", "downtempo"], defaultMood: .calm, bpmMin: 70, bpmMax: 115)
    public static let ambient = GenreDefinition(id: "ambient", displayName: "Ambient", emoji: "🌌", themePresetId: "deep_space_indigo", eqPresetId: "ambient_space",
        aliases: ["ambient", "drone", "soundscape", "space music", "dark ambient", "new age"],
        aiSuggestions: ["Deep space drones", "Cinematic soundscapes", "Generative ambient"],
        radioTags: ["ambient", "space"], defaultMood: .calm, bpmMin: 0, bpmMax: 90)
    public static let workout = GenreDefinition(id: "workout", displayName: "Workout", emoji: "💪", themePresetId: "volt_lime_surge", eqPresetId: "workout_bass",
        aliases: ["workout", "gym", "fitness", "running", "cardio", "hiit", "motivation", "trap", "hip hop", "rap"],
        aiSuggestions: ["HIIT 140 BPM", "Running 170 BPM cadence", "Heavy lifting hype"],
        radioTags: ["workout", "hiphop", "dance"], defaultMood: .energetic, bpmMin: 120, bpmMax: 180)
    public static let focus = GenreDefinition(id: "focus", displayName: "Focus", emoji: "🎯", themePresetId: "laser_focus_teal", eqPresetId: "focus_neutral",
        aliases: ["focus", "study", "concentration", "deep work", "productivity", "coding", "alpha waves"],
        aiSuggestions: ["Deep work (no vocals],
        radioTags: ["study", "focus", "instrumental"], defaultMood: .focused, bpmMin: 60, bpmMax: 120)
    public static let romantic = GenreDefinition(id: "romantic", displayName: "Romantic", emoji: "💖", themePresetId: "rose_neon_heart", eqPresetId: "romantic_warm",
        aliases: ["romantic", "love", "romance", "r&b", "rnb", "soul", "ballad", "slow jam"],
        aiSuggestions: ["Love ballads", "Bollywood romance", "Late-night R&B"],
        radioTags: ["love songs", "rnb", "soul"], defaultMood: .romantic, bpmMin: 60, bpmMax: 110)
    public static let partyMix = GenreDefinition(id: "party_mix", displayName: "Party Mix", emoji: "🎉", themePresetId: "rainbow_rave", eqPresetId: "party_loud",
        aliases: ["party", "dance", "club", "bollywood dance", "punjabi", "bhangra", "reggaeton", "pop dance", "disco"],
        aiSuggestions: ["Bollywood party bangers", "Punjabi bhangra", "Club anthems"],
        radioTags: ["dance", "party", "club"], defaultMood: .party, bpmMin: 100, bpmMax: 135)
    public static let morningVibes = GenreDefinition(id: "morning_vibes", displayName: "Morning Vibes", emoji: "🌅", themePresetId: "sunrise_amber", eqPresetId: "morning_bright",
        aliases: ["morning", "acoustic", "indie pop", "folk", "sunrise", "coffee", "feel good"],
        aiSuggestions: ["Acoustic sunrise", "Feel-good morning", "Coffee-shop indie"],
        radioTags: ["acoustic", "indie", "pop"], defaultMood: .happy, bpmMin: 80, bpmMax: 125)
    public static let instrumental = GenreDefinition(id: "instrumental", displayName: "Instrumental", emoji: "🎻", themePresetId: "silver_strings", eqPresetId: "instrumental_natural",
        aliases: ["instrumental", "classical", "piano", "orchestral", "soundtrack", "score", "sitar", "flute", "guitar", "hindustani", "carnatic"],
        aiSuggestions: ["Solo piano", "Indian classical ragas", "Epic film scores"],
        radioTags: ["classical", "instrumental", "soundtrack"], defaultMood: .focused, bpmMin: 0, bpmMax: 999)
    public static let podcastMode = GenreDefinition(id: "podcast_mode", displayName: "Podcast Mode", emoji: "🎙️", themePresetId: "studio_mono_blue", eqPresetId: "podcast_voice",
        aliases: ["podcast", "talk", "spoken word", "audiobook", "speech", "news", "interview", "episode"],
        aiSuggestions: ["Resume last episode", "Speech-boosted listening", "News briefing"],
        radioTags: ["talk", "news", "podcast"], defaultMood: .focused, bpmMin: 0, bpmMax: 999)
    public static let all: [GenreDefinition] = [devotional, meditation, sleep, hindiClassics, lofi, chillout, ambient, workout, focus, romantic, partyMix, morningVibes, nightDrive, instrumental, podcastMode, edm, trance, techno]
    public static func byId(_ id: String) -> GenreDefinition? { all.first { $0.id == id } }
    /// Genre → theme preset map used by the switching logic.
    public static let genreThemeMap: [String: String] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0.themePresetId) })
}
