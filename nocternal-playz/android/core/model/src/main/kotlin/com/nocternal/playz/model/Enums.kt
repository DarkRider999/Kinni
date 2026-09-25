package com.nocternal.playz.model

import kotlinx.serialization.Serializable

@Serializable
enum class ThemeMode { LIGHT, DARK, NEON, AMOLED }

@Serializable
enum class AudioSource(val label: String) { LOCAL("Local"), YOUTUBE("YouTube Music"), RADIO("Radio Hub") }

@Serializable
enum class EdgeLightingMode(val label: String) {
    OFF("Off"), STATIC("Static"), GRADIENT("Gradient"), MUSIC_REACTIVE("Music reactive")
}

/** The ten advanced lighting animations. Each is drawn by lighting_effects (Android) and Lighting/ (iOS). */
@Serializable
enum class LightingAnimation(val label: String, val description: String) {
    PULSE_WAVE_SPECTRUM("PulseWave Spectrum", "Concentric waves whose radius and brightness follow the spectrum"),
    HYPERBEAM_EDGE_FLOW("HyperBeam Edge Flow", "Light beams race around the screen edge, speed follows the beat"),
    AURORA_RIBBON("Aurora Ribbon", "Slow flowing ribbons of light, amplitude follows mids"),
    BASS_SHOCK_FLASH("BassShock Flash", "Full-frame flash and shockwave ring on every bass hit"),
    PRISM_CYCLE("Prism Cycle", "Hue rotates through the spectrum, rate follows energy"),
    VORTEX_SPIRAL("Vortex Spiral", "Rotating spiral arms, twist and speed follow tempo"),
    EQ_BAR_MIRAGE("EQ Bar Mirage", "Mirrored glowing EQ bars with a heat-haze reflection"),
    STARFALL_REACTIVE("Starfall Reactive", "Falling stars; new stars spawn on treble transients"),
    CRYSTAL_GRID("Crystal Grid", "Perspective neon grid whose nodes light up with the bands"),
    INFINITY_LOOP("Infinity Loop", "A lemniscate trail that breathes with the music"),
}

@Serializable
enum class BackgroundStyle(val label: String) {
    AMOLED_BLACK("AMOLED black"),
    DEEP_SPACE("Deep space"),
    NEBULA("Nebula"),
    STARFIELD("Starfield"),
    AURORA_HAZE("Aurora haze"),
    GRID_HORIZON("Grid horizon"),
    SOFT_GLOW("Soft glow"),
    SACRED_MANDALA("Sacred mandala"),
    RAIN_GLASS("Rain on glass"),
}

@Serializable
enum class Mood(val label: String) {
    CALM("Calm"), ENERGETIC("Energetic"), HAPPY("Happy"), MELANCHOLIC("Melancholic"),
    ROMANTIC("Romantic"), FOCUSED("Focused"), SPIRITUAL("Spiritual"), SLEEPY("Sleepy"), PARTY("Party"),
}

@Serializable
enum class RepeatMode { OFF, ONE, ALL }
