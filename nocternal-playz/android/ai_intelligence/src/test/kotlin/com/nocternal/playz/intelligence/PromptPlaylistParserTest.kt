package com.nocternal.playz.intelligence

import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PromptPlaylistParserTest {
    @Test fun detectsMoodFromKeyword() {
        val p = PromptPlaylistParser.parse("music to help me focus and study for an exam")
        assertEquals(Mood.FOCUSED, p.mood)
    }

    @Test fun detectsEnergyRangeFromActivityWord() {
        val p = PromptPlaylistParser.parse("high energy workout playlist")
        assertTrue(p.energyMin != null && p.energyMin!! >= 0.6f)
    }

    @Test fun unrecognizedPromptHasNoSignals() {
        val p = PromptPlaylistParser.parse("xyz123 nonsense")
        assertEquals(null, p.mood)
        assertEquals(null, p.genreId)
    }

    @Test fun builderFiltersPoolByParsedMood() {
        val pool = listOf(
            Track("f1", "", "Deep Focus", genreTag = "Focus", energy = 0.5f),
            Track("p1", "", "Party Banger", genreTag = "EDM", bpm = 128f, energy = 0.9f),
        )
        val prompt = PromptPlaylistParser.parse("I need focus music for studying")
        val built = PromptPlaylistBuilder().build(prompt, pool)
        assertEquals(listOf("f1"), built.map { it.id })
    }

    @Test fun builderReturnsEmptyWhenPromptHasNoSignal() {
        val pool = listOf(Track("f1", "", "Deep Focus", energy = 0.5f))
        val prompt = PromptPlaylistParser.parse("asdkjhasd")
        assertTrue(PromptPlaylistBuilder().build(prompt, pool).isEmpty())
    }
}
