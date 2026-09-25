import Foundation
import NocternalModel

/// Built-in EQ presets (generated from the Kotlin EqPresets so both platforms match).
public enum EqPresets {
    public static let flat = EqPreset("flat", "Flat", Array(repeating: 0, count: 10))
    public static let vocalClarity = EqPreset("vocal_clarity", "Vocal clarity", [-2, -1, 0, -1, 1, 3, 4, 3, 1, 0])
    public static let airyHighs = EqPreset("airy_highs", "Airy highs", [-1, -1, 0, 0, 0, 0, 1, 2, 4, 5], surround: 0.3)
    public static let balancedLows = EqPreset("balanced_lows", "Balanced lows", [2, 2, 1, 0, 0, -1, -2, -3, -4, -5], preampDb: -1)
    public static let warmMids = EqPreset("warm_mids", "Warm mids", [1, 1, 2, 3, 3, 2, 0, -1, -1, -2], preampDb: -2)
    public static let edmPunch = EqPreset("edm_punch", "EDM punch", [6, 5, 3, 0, -1, 0, 1, 3, 4, 4], preampDb: -4, bassBoost: 0.4)
    public static let tranceWide = EqPreset("trance_wide", "Trance wide", [4, 4, 2, 0, -1, 0, 2, 3, 4, 3], preampDb: -3, surround: 0.5)
    public static let technoSub = EqPreset("techno_sub", "Techno sub", [7, 6, 3, 0, -2, -1, 0, 2, 2, 1], preampDb: -5, bassBoost: 0.5)
    public static let nightDrive = EqPreset("night_drive", "Night drive", [5, 4, 2, 0, -1, 0, 1, 2, 3, 2], preampDb: -3, surround: 0.4)
    public static let lofiWarm = EqPreset("lofi_warm", "Lo-fi warm", [3, 3, 2, 1, 0, 0, -1, -2, -4, -6], preampDb: -2)
    public static let chillSmooth = EqPreset("chill_smooth", "Chill smooth", [2, 2, 1, 0, 0, 0, 0, 1, 2, 2], preampDb: -1, surround: 0.3)
    public static let ambientSpace = EqPreset("ambient_space", "Ambient space", [1, 1, 0, 0, -1, -1, 0, 1, 3, 4], surround: 0.6)
    public static let workoutBass = EqPreset("workout_bass", "Workout bass", [7, 6, 4, 1, 0, 0, 1, 2, 3, 3], preampDb: -5, bassBoost: 0.6, loudnessDb: 2)
    public static let focusNeutral = EqPreset("focus_neutral", "Focus neutral", [0, 0, 0, 0, 0, 0, 0, -1, -1, -2])
    public static let romanticWarm = EqPreset("romantic_warm", "Romantic warm", [2, 2, 1, 1, 1, 2, 2, 1, 0, 0], preampDb: -2)
    public static let partyLoud = EqPreset("party_loud", "Party loud", [6, 5, 3, 1, 0, 0, 1, 3, 4, 4], preampDb: -4, bassBoost: 0.5, loudnessDb: 3)
    public static let morningBright = EqPreset("morning_bright", "Morning bright", [0, 0, 0, 0, 1, 1, 2, 3, 3, 2])
    public static let instrumentalNatural = EqPreset("instrumental_natural", "Instrumental natural", [1, 1, 0, 0, 0, 0, 0, 1, 1, 1], surround: 0.2)
    public static let podcastVoice = EqPreset("podcast_voice", "Podcast voice", [-6, -4, -1, 0, 2, 3, 4, 2, 0, -2], loudnessDb: 3)
    public static let speakerBoost = EqPreset("speaker_boost", "Speaker boost", [-4, -2, 2, 2, 1, 1, 2, 3, 2, 0], preampDb: -2, loudnessDb: 4)
    public static let all: [EqPreset] = [flat, vocalClarity, airyHighs, balancedLows, warmMids, edmPunch, tranceWide, technoSub, nightDrive, lofiWarm, chillSmooth, ambientSpace, workoutBass, focusNeutral, romanticWarm, partyLoud, morningBright, instrumentalNatural, podcastVoice, speakerBoost]
    public static func byId(_ id: String) -> EqPreset { all.first { $0.id == id } ?? flat }
}
