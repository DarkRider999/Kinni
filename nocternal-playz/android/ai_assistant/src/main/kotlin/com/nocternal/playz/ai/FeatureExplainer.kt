package com.nocternal.playz.ai

/** Plain-language explanations of audio features, used offline by the assistant. */
object FeatureExplainer {
    private val topics = linkedMapOf(
        "equalizer" to (listOf("eq", "equalizer", "equaliser", "bands") to
            "The 10-band equalizer boosts or cuts ten frequency ranges from 31 Hz (deep sub-bass) to 16 kHz (air). Raise 60–125 Hz for punch, 2–4 kHz for vocal clarity, 8–16 kHz for sparkle. Each genre has its own preset, and I can optimize it for your headphones or speaker."),
        "bass boost" to (listOf("bass boost") to "Bass boost is a low-shelf filter at 80 Hz (up to +12 dB) with gentle saturation, so kicks feel bigger without distorting. The limiter keeps it from clipping."),
        "3d surround" to (listOf("surround", "3d", "virtualizer") to "3D surround widens the stereo image and adds a tiny delayed crosstalk-cancellation signal, so music feels like it comes from around you instead of inside your head."),
        "loudness" to (listOf("loudness enhancer", "loudness") to "The loudness enhancer adds clean gain before a brick-wall limiter. In safe mode it never adds more than 6 dB in total."),
        "normalization" to (listOf("normalization", "normalisation", "normalize", "volume jumps") to "Smart normalization plays every song at about the same loudness (−14 LUFS, like streaming services), using ReplayGain tags or my own loudness measurement, so you never reach for the volume between tracks."),
        "gapless" to (listOf("gapless") to "Gapless playback removes the silence between tracks using the encoder delay/padding info in the file, so live albums and DJ mixes flow without a click."),
        "crossfade" to (listOf("crossfade", "auto fader", "autofader", "fade", "gap") to "Crossfade starts the next song a few seconds before the current one ends and blends them with equal-power curves, so the music never stops. 4–6 s suits playlists; 0 s gives true gapless playback for live albums and DJ sets."),
        "auto mix" to (listOf("auto mix", "automix", "dj", "camelot", "harmonic") to "DJ auto-mix picks the next song whose tempo and key fit (Camelot wheel: same number, ±1, or relative major/minor), matches the tempo within 8 %, and blends over 8–16 bars with a bass swap so two kick drums never clash."),
        "reverb" to (listOf("reverb") to "Reverb simulates a room: room size sets how long the tail rings, damping darkens it, and wet sets how much you hear."),
        "flanger" to (listOf("flanger") to "The flanger mixes in a copy delayed by 1–10 ms that sweeps slowly, giving the classic jet-plane whoosh."),
        "phaser" to (listOf("phaser") to "The phaser sweeps notches through the spectrum with a chain of all-pass filters, for a swirling, spacey sound."),
        "compressor" to (listOf("compressor", "compression") to "The compressor turns loud parts down (threshold + ratio) and brings everything back up with makeup gain, so quiet details are easier to hear."),
        "stereo widening" to (listOf("stereo width", "widening", "widener") to "Stereo widening raises the side (L−R) signal. 0 is mono, 1 is original, 2 is extra wide."),
        "pitch shift" to (listOf("pitch") to "Pitch shift moves the key up or down by up to 12 semitones without changing the tempo — handy for singing along in your range."),
        "vocal remover" to (listOf("vocal remover", "karaoke", "remove vocal") to "The vocal remover cancels sound panned to the centre (usually the lead voice) above 150 Hz, keeping bass and kick. It works best on studio mixes."),
        "song enhancer" to (listOf("enhancer", "enhance", "noise removal", "clarity") to "The AI Song Enhancer has modes for clarity, noise removal, bass enhancement, vocal focus and restoring old recordings. Each tunes EQ, compression, noise reduction and width together."),
        "safe mode" to (listOf("safe mode", "speaker boost", "hearing") to "Speaker boost adds up to 4 dB and filters out lows the phone speaker can't play. Safe mode caps total boost at 6 dB and lowers the limiter ceiling to protect your ears and speakers."),
        "lighting" to (listOf("light bar", "edge lighting", "lighting", "animation") to "The light bar and edge lighting react to the music in real time: bass drives flashes, mids drive ribbons and treble spawns stars. Each genre picks its own animation and colour."),
        "private mode" to (listOf("private mode", "incognito") to "Private mode stops recording history, play counts and scrobbles, and keeps backups free of your listening history."),
    )

    fun topicFor(text: String): String? = topics.entries.firstOrNull { (_, v) -> v.first.any { text.contains(it) } }?.key

    fun explain(topic: String): String = topics[topic]?.second ?: "I can explain the EQ, bass boost, surround, normalization, gapless, crossfade, auto-mix, FX, vocal remover, enhancer, safe mode, lighting and private mode."
}
