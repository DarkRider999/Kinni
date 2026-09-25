package com.nocternal.playz.ai

import com.nocternal.playz.fx.EnhancerMode
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.Mood
import com.nocternal.playz.theme.EqPresets
import com.nocternal.playz.theme.GenreCatalog

/**
 * On-device command understanding for text and voice ("Play trance playlist", "Boost bass",
 * "Activate meditation theme", "sleep in 30 minutes", "gaana bajao"). Works offline; free-form
 * questions fall through as [AssistantIntent.Unknown] for the optional LLM backend.
 */
object CommandParser {
    private val playVerbs = listOf("play", "put on", "start", "queue", "bajao", "chalao", "listen to", "i want")
    private val genreWords: List<Pair<String, String>> = GenreCatalog.all
        .flatMap { g -> (listOf(g.displayName.lowercase(), g.id.replace('_', ' ')) + g.aliases).map { it to g.id } }
        .distinct().sortedByDescending { it.first.length }

    private val moodWords = mapOf(
        "calm" to Mood.CALM, "relax" to Mood.CALM, "chill" to Mood.CALM, "peaceful" to Mood.CALM,
        "energetic" to Mood.ENERGETIC, "energy" to Mood.ENERGETIC, "pump" to Mood.ENERGETIC, "hype" to Mood.ENERGETIC,
        "happy" to Mood.HAPPY, "cheerful" to Mood.HAPPY, "upbeat" to Mood.HAPPY,
        "sad" to Mood.MELANCHOLIC, "melancholic" to Mood.MELANCHOLIC, "heartbreak" to Mood.MELANCHOLIC,
        "romantic" to Mood.ROMANTIC, "love" to Mood.ROMANTIC,
        "focus" to Mood.FOCUSED, "concentrate" to Mood.FOCUSED, "study" to Mood.FOCUSED,
        "spiritual" to Mood.SPIRITUAL, "prayer" to Mood.SPIRITUAL,
        "sleepy" to Mood.SLEEPY, "tired" to Mood.SLEEPY,
        "party" to Mood.PARTY, "dance" to Mood.PARTY,
    )

    fun parse(input: String): AssistantIntent {
        val t = input.lowercase().trim().removeSuffix(".").removeSuffix("!").removeSuffix("?")
        if (t.isEmpty()) return AssistantIntent.Unknown(input)

        // Transport first: short, unambiguous.
        transport(t)?.let { return AssistantIntent.Transport(it) }

        sleepMinutes(t)?.let { return AssistantIntent.SleepTimer(it) }

        if (has(t, "what song", "what's this song", "whats this song", "identify", "recognize", "recognise", "shazam", "which song is"))
            return AssistantIntent.IdentifySong
        if (has(t, "album art", "cover art", "artwork")) return AssistantIntent.GenerateAlbumArt
        if (has(t, "auto mix", "automix", "dj mode", "mix my", "beat match")) return AssistantIntent.AutoMix

        if (has(t, "vocal remover", "remove vocal", "karaoke", "instrumental version")) return AssistantIntent.VocalRemover(!has(t, "off", "disable", "stop"))
        enhancer(t)?.let { return AssistantIntent.Enhance(it) }

        if (has(t, "bass")) {
            if (has(t, "boost", "more", "increase", "up", "pump", "raise", "badhao")) return AssistantIntent.AdjustBass(true)
            if (has(t, "less", "reduce", "decrease", "down", "cut", "lower")) return AssistantIntent.AdjustBass(false)
        }
        if (has(t, "optimize eq", "optimise eq", "auto eq", "best eq", "optimize sound", "optimise sound")) return AssistantIntent.OptimizeEq
        if (has(t, "recommend eq", "which eq", "suggest eq", "eq preset", "equalizer")) {
            EqPresets.all.firstOrNull { t.contains(it.name.lowercase()) }?.let { return AssistantIntent.ApplyEqPreset(it.id) }
            return AssistantIntent.RecommendEq
        }

        if (has(t, "theme", "mode", "vibe", "lighting")) {
            genre(t)?.let { if (has(t, "activate", "switch", "set", "apply", "change", "use", "turn on", "enable", "theme")) return AssistantIntent.ActivateTheme(it) }
        }

        source(t)?.let { if (has(t, "switch", "go to", "open", "change to", "use", "move to")) return AssistantIntent.SwitchSource(it) }

        if (has(t, "explain", "what is", "what does", "how does", "how do", "tell me about", "meaning of")) {
            FeatureExplainer.topicFor(t)?.let { return AssistantIntent.ExplainFeature(it) }
        }

        val bpm = bpmRange(t)
        if (has(t, "suggest", "recommend", "make me", "create", "build", "generate") && has(t, "playlist", "mix", "songs", "music")) {
            return AssistantIntent.SuggestPlaylist(genre(t), mood(t), bpm?.first, bpm?.second)
        }

        if (playVerbs.any { t.startsWith(it) || t.contains(" $it ") } || t.endsWith("bajao") || t.endsWith("chalao")) {
            source(t)?.let { src -> if (src != AudioSource.LOCAL && has(t, "radio", "youtube")) {
                val q = stripVerbs(t).replace(Regex("\\b(on|from|in)?\\s*(youtube music|youtube|radio)\\b"), "").trim()
                return if (q.isBlank()) AssistantIntent.SwitchSource(src) else AssistantIntent.PlaySearch("$q@${src.name}")
            } }
            genre(t)?.let { return AssistantIntent.PlayGenre(it) }
            mood(t)?.let { return AssistantIntent.PlayMood(it) }
            if (bpm != null) return AssistantIntent.SuggestPlaylist(null, null, bpm.first, bpm.second)
            val q = stripVerbs(t)
            if (q.isNotBlank() && q !in setOf("music", "something", "songs", "a song")) return AssistantIntent.PlaySearch(q)
            return AssistantIntent.Transport(TransportCommand.PLAY)
        }
        return AssistantIntent.Unknown(input)
    }

    fun genre(t: String): String? = genreWords.firstOrNull { (w, _) -> Regex("(^|[^a-z])${Regex.escape(w)}([^a-z]|$)").containsMatchIn(t) }?.second
    fun mood(t: String): Mood? = moodWords.entries.firstOrNull { Regex("\\b${it.key}\\b").containsMatchIn(t) }?.value

    private fun transport(t: String): TransportCommand? = when (t) {
        "pause", "stop", "stop music", "pause music", "ruko", "band karo" -> TransportCommand.PAUSE
        "play", "resume", "continue", "play music" -> TransportCommand.PLAY
        "next", "skip", "next song", "skip song", "next track", "agla gaana" -> TransportCommand.NEXT
        "previous", "back", "previous song", "go back", "last song" -> TransportCommand.PREVIOUS
        "shuffle", "shuffle on", "shuffle all" -> TransportCommand.SHUFFLE
        "repeat", "repeat this", "loop this" -> TransportCommand.REPEAT
        "volume up", "louder", "turn it up" -> TransportCommand.VOLUME_UP
        "volume down", "quieter", "turn it down" -> TransportCommand.VOLUME_DOWN
        "like", "like this", "i like this song", "favorite this", "favourite this", "add to favorites" -> TransportCommand.LIKE
        else -> null
    }

    private fun sleepMinutes(t: String): Int? {
        if (!has(t, "sleep", "timer", "stop after", "stop in", "turn off")) return null
        Regex("(\\d+)\\s*(h|hr|hrs|hour|hours)\\b").find(t)?.let { return it.groupValues[1].toInt() * 60 }
        Regex("(\\d+)\\s*(m|min|mins|minute|minutes)\\b").find(t)?.let { return it.groupValues[1].toInt() }
        if (has(t, "half an hour", "half hour")) return 30
        if (has(t, "an hour", "one hour")) return 60
        return if (has(t, "sleep timer", "timer")) 30 else null
    }

    private fun enhancer(t: String): EnhancerMode? = when {
        !has(t, "enhance", "clarity", "noise", "clean", "restore", "clear", "vocal focus", "improve") -> null
        has(t, "noise", "hiss", "clean") -> EnhancerMode.NOISE_REMOVAL
        has(t, "bass") -> EnhancerMode.BASS_ENHANCEMENT
        has(t, "old", "restore", "vintage") -> EnhancerMode.OLD_RECORDING
        has(t, "vocal", "voice", "podcast") -> EnhancerMode.VOCAL_FOCUS
        else -> EnhancerMode.CLARITY
    }

    private fun source(t: String): AudioSource? = when {
        has(t, "youtube") -> AudioSource.YOUTUBE
        has(t, "radio", " fm", "station") -> AudioSource.RADIO
        has(t, "local", "my music", "offline", "device", "library") -> AudioSource.LOCAL
        else -> null
    }

    private fun bpmRange(t: String): Pair<Float, Float>? {
        Regex("(\\d{2,3})\\s*(?:-|to)\\s*(\\d{2,3})\\s*bpm").find(t)?.let { return it.groupValues[1].toFloat() to it.groupValues[2].toFloat() }
        Regex("(\\d{2,3})\\s*bpm").find(t)?.let { val b = it.groupValues[1].toFloat(); return (b - 5) to (b + 5) }
        return null
    }

    private fun stripVerbs(t: String): String {
        var q = t
        for (v in playVerbs.sortedByDescending { it.length }) q = q.replace(Regex("\\b${Regex.escape(v)}\\b"), " ")
        return q.replace(Regex("\\b(some|me|the|a|song|songs|by|please|playlist)\\b"), " ").replace(Regex("\\s+"), " ").trim()
    }

    private fun has(t: String, vararg words: String) = words.any { t.contains(it) }
}
