package com.nocternal.playz.model

import kotlinx.serialization.Serializable

/** A musical key: tonic pitch class (0 = C … 11 = B) and mode. Converts to/from Camelot wheel notation for DJ mixing. */
@Serializable
data class MusicalKey(val pitchClass: Int, val minor: Boolean) {
    init { require(pitchClass in 0..11) }

    /** Camelot number 1..12. */
    val camelotNumber: Int
        get() {
            val majorPc = if (minor) (pitchClass + 3) % 12 else pitchClass
            return ((majorPc * 7 % 12) + 7) % 12 + 1
        }

    val camelot: String get() = "$camelotNumber${if (minor) "A" else "B"}"

    val name: String get() = NAMES[pitchClass] + if (minor) "m" else ""

    val relative: MusicalKey get() = if (minor) MusicalKey((pitchClass + 3) % 12, false) else MusicalKey((pitchClass + 9) % 12, true)

    companion object {
        val NAMES = listOf("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
        private val ALT = mapOf("Db" to 1, "D#" to 3, "Gb" to 6, "G#" to 8, "A#" to 10, "Cb" to 11, "E#" to 5, "Fb" to 4, "B#" to 0)

        /** Parses Camelot ("8A", "12B"). */
        fun fromCamelot(code: String): MusicalKey? {
            val c = code.trim().uppercase()
            val minor = when (c.lastOrNull()) { 'A' -> true; 'B' -> false; else -> return null }
            val n = c.dropLast(1).toIntOrNull()?.takeIf { it in 1..12 } ?: return null
            val majorPc = ((n - 8 + 12) % 12) * 7 % 12
            return if (minor) MusicalKey((majorPc + 9) % 12, true) else MusicalKey(majorPc, false)
        }

        /** Parses "C", "F#m", "Bb minor", "A min", "Db major", or Camelot codes. */
        fun parse(text: String): MusicalKey? {
            val t = text.trim()
            if (t.isEmpty()) return null
            if (t.first().isDigit()) return fromCamelot(t)
            val root = if (t.length >= 2 && (t[1] == '#' || t[1] == 'b')) t.substring(0, 2) else t.substring(0, 1)
            val rootCap = root.replaceFirstChar { it.uppercase() }
            val pc = NAMES.indexOf(rootCap).takeIf { it >= 0 } ?: ALT[rootCap] ?: return null
            val rest = t.substring(root.length).trim().lowercase()
            val minor = rest.startsWith("m") && !rest.startsWith("maj")
            return MusicalKey(pc, minor)
        }
    }
}
