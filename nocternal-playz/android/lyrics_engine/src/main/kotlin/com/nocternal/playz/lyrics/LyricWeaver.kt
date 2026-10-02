package com.nocternal.playz.lyrics

import com.nocternal.playz.model.Track
import kotlin.random.Random

/**
 * On-device lyric writer used when no real lyrics exist and no AI key is set. It writes original,
 * clearly-labelled lines (verse / chorus / verse / chorus) from the song's title and energy, synced across the
 * track so the karaoke view always has something to follow. Deterministic per song.
 */
class LyricWeaver : LyricsGenerator {
    override val cacheable = false

    private val night = listOf("neon rain on the city glass", "headlights drawing lines of gold", "the midnight hums a quiet song",
        "stars are falling one by one", "shadows dancing on the wall", "the moon is keeping time with me")
    private val fire = listOf("hands up high, the lights explode", "feel the bass inside your chest", "we don't stop until the sunrise",
        "every heartbeat hits the drum", "turn it up and let it go", "the floor is shaking, we're alive")
    private val calm = listOf("slow waves washing over me", "breathe in, let the silence stay", "soft light falling through the trees",
        "the river carries all my worries", "close your eyes and drift away", "a gentle wind is calling home")
    private val heart = listOf("your name is written in the sky", "every word I never said", "hold me closer than before",
        "the colours bloom when you are near", "a promise whispered in the dark", "two hearts beating out of time")

    // Hinglish (Romanized Hindi/Punjabi) pools, used instead of the English ones above for Hindi/Punjabi tracks.
    private val nightHi = listOf("chandni bikhri hai gali mein", "sadkon pe khamoshi chalti hai", "raat yeh gungunati hai",
        "taare ginte beet gayi raat", "parchhaiyan deewar pe naachti", "chaand bhi ab saath chalta hai")
    private val fireHi = listOf("josh hai seene mein aaj", "har dhadkan gaaye tera naam", "nachne do is raat ko",
        "aa ja rangon mein dubo de", "shor machaa de yeh mehfil", "dil ye deewana ho gaya")
    private val calmHi = listOf("chup chup si yeh raatein hain", "saans mein ghuli hai teri yaad", "dheere dheere dil behelta hai",
        "khamoshi mein baat karte hain", "thodi der thehar ja yahin", "neend bhi na aaye is pal")
    private val heartHi = listOf("tera naam likha hai dil pe", "har lafz adhoora sa hai", "paas aa, door mat ja",
        "rang bikhre hain tujhse mile", "ek vaada tha andhere mein", "do dil ab ek dhadkan mein")

    override suspend fun find(track: Track): Lyrics {
        val (title, _) = LyricsQuery.of(track)
        val rnd = Random((title + track.artist).hashCode())
        val tag = (track.genreTag ?: "").lowercase()
        val energy = track.energy ?: if (track.bpm != null && track.bpm!! > 120) 0.75f else 0.45f
        val hindi = LyricsQuery.looksHindiOrPunjabi(track)
        val (nightP, fireP, calmP, heartP) = if (hindi) listOf(nightHi, fireHi, calmHi, heartHi) else listOf(night, fire, calm, heart)
        val pool = when {
            listOf("love", "romantic", "ballad", "r&b").any { it in tag } -> heartP
            energy > 0.65f -> fireP
            energy < 0.35f -> calmP
            else -> nightP
        } + (if (energy > 0.5f) nightP else calmP)
        fun verse() = pool.shuffled(rnd).take(4).map { it.replaceFirstChar(Char::uppercase) }
        val hook = title.ifBlank { if (hindi) "yeh raat" else "tonight" }
        val chorus = if (hindi) listOf("♪ $hook ♪", "gaate hain hum $hook", "oh $hook, mit na jaana yunhi", "♪ $hook ♪")
            else listOf("♪ $hook ♪", "we're singing $hook", "oh, $hook, don't fade away", "♪ $hook ♪")
        val lines = verse() + chorus + verse() + chorus
        return LyricsTiming.spread(lines, track.durationMs, LyricsOrigin.AI_GENERATED)
    }
}
