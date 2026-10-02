package com.nocternal.playz.lyrics

/**
 * Transliterates Devanagari (Hindi) and Gurmukhi (Punjabi) script into Romanized Hinglish/Punglish,
 * so lyrics found in native script (from LRCLIB, embedded tags, sidecars, or cache) always display in
 * English letters, matching what the singer actually sings rather than a translation.
 */
object Romanizer {
    private val devanagariOrGurmukhi = Regex("[ऀ-ॿ਀-੿]")

    fun containsIndicScript(text: String) = devanagariOrGurmukhi.containsMatchIn(text)

    fun romanize(lyrics: Lyrics): Lyrics {
        if (lyrics.lines.none { containsIndicScript(it.text) }) return lyrics
        return lyrics.copy(lines = lyrics.lines.map { line ->
            if (!containsIndicScript(line.text)) line
            else line.copy(text = toRoman(line.text), words = line.words.map { w -> if (containsIndicScript(w.text)) w.copy(text = toRoman(w.text)) else w })
        })
    }

    fun toRoman(text: String): String {
        val sb = StringBuilder()
        var i = 0
        while (i < text.length) {
            val c = text[i]
            val cons = devanagariConsonants[c] ?: gurmukhiConsonants[c]
            if (cons != null) {
                var j = i + 1
                var roman = cons
                if (j < text.length && (text[j] == DEVANAGARI_NUKTA || text[j] == GURMUKHI_NUKTA)) {
                    roman = nuktaVariants["$c${text[j]}"] ?: roman; j++
                }
                when {
                    j < text.length && (text[j] == '्' || text[j] == '੍') -> { sb.append(roman); i = j + 1 }
                    j < text.length && matras.containsKey(text[j]) -> { sb.append(roman).append(matras.getValue(text[j])); i = j + 1 }
                    else -> { sb.append(roman).append("a"); i = j }
                }
                continue
            }
            val vowel = independentVowels[c]
            if (vowel != null) { sb.append(vowel); i++; continue }
            when (c) {
                'ं', 'ਂ' -> sb.append("n")
                'ः' -> sb.append("h")
                'ँ' -> sb.append("n")
                'ੰ' -> sb.append("n")
                '।', '॥' -> sb.append(".")
                in '०'..'९' -> sb.append(('0' + (c - '०')))
                in '੦'..'੯' -> sb.append(('0' + (c - '੦')))
                else -> sb.append(c)
            }
            i++
        }
        return sb.toString().split(" ").joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }
    }

    private val independentVowels = mapOf(
        'अ' to "a", 'आ' to "aa", 'इ' to "i", 'ई' to "ee", 'उ' to "u", 'ऊ' to "oo",
        'ऋ' to "ri", 'ए' to "e", 'ऐ' to "ai", 'ओ' to "o", 'औ' to "au", 'ॲ' to "a", 'ऍ' to "ae", 'ऑ' to "aw",
        'ਅ' to "a", 'ਆ' to "aa", 'ਇ' to "i", 'ਈ' to "ee", 'ਉ' to "u", 'ਊ' to "oo", 'ਏ' to "e", 'ਐ' to "ai", 'ਓ' to "o", 'ਔ' to "au",
    )

    private val matras = mapOf(
        'ा' to "aa", 'ि' to "i", 'ी' to "ee", 'ु' to "u", 'ू' to "oo", 'ृ' to "ri",
        'े' to "e", 'ै' to "ai", 'ो' to "o", 'ौ' to "au", 'ॅ' to "ae", 'ॉ' to "aw",
        'ਾ' to "aa", 'ਿ' to "i", 'ੀ' to "ee", 'ੁ' to "u", 'ੂ' to "oo", 'ੇ' to "e", 'ੈ' to "ai", 'ੋ' to "o", 'ੌ' to "au",
    )

    private val devanagariConsonants = mapOf(
        'क' to "k", 'ख' to "kh", 'ग' to "g", 'घ' to "gh", 'ङ' to "ng",
        'च' to "ch", 'छ' to "chh", 'ज' to "j", 'झ' to "jh", 'ञ' to "ny",
        'ट' to "t", 'ठ' to "th", 'ड' to "d", 'ढ' to "dh", 'ण' to "n",
        'त' to "t", 'थ' to "th", 'द' to "d", 'ध' to "dh", 'न' to "n",
        'प' to "p", 'फ' to "ph", 'ब' to "b", 'भ' to "bh", 'म' to "m",
        'य' to "y", 'र' to "r", 'ल' to "l", 'व' to "v", 'ळ' to "l",
        'श' to "sh", 'ष' to "sh", 'स' to "s", 'ह' to "h",
    )

    private val gurmukhiConsonants = mapOf(
        'ਕ' to "k", 'ਖ' to "kh", 'ਗ' to "g", 'ਘ' to "gh", 'ਙ' to "ng",
        'ਚ' to "ch", 'ਛ' to "chh", 'ਜ' to "j", 'ਝ' to "jh", 'ਞ' to "ny",
        'ਟ' to "t", 'ਠ' to "th", 'ਡ' to "d", 'ਢ' to "dh", 'ਣ' to "n",
        'ਤ' to "t", 'ਥ' to "th", 'ਦ' to "d", 'ਧ' to "dh", 'ਨ' to "n",
        'ਪ' to "p", 'ਫ' to "ph", 'ਬ' to "b", 'ਭ' to "bh", 'ਮ' to "m",
        'ਯ' to "y", 'ਰ' to "r", 'ਲ' to "l", 'ਵ' to "v",
        'ਸ' to "s", 'ਹ' to "h",
    )

    // A base consonant followed by a combining nukta mark changes its sound (e.g. ज + ़ = ज़ "z").
    // Both the base consonant and the nukta mark are separate Unicode codepoints, so these are string keys.
    private const val DEVANAGARI_NUKTA = '़'
    private const val GURMUKHI_NUKTA = '਼'
    private val nuktaVariants = mapOf(
        "क़" to "q", "ख़" to "kh", "ग़" to "g", "ज़" to "z",
        "ड़" to "r", "ढ़" to "rh", "फ़" to "f", "य़" to "y",
        "ਲ਼" to "l", "ਸ਼" to "sh", "ਜ਼" to "z", "ਫ਼" to "f",
    )
}
