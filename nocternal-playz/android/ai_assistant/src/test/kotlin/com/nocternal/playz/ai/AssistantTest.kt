package com.nocternal.playz.ai

import com.nocternal.playz.fx.EnhancerMode
import com.nocternal.playz.fx.OutputRoute
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Track
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AssistantTest {
    private val lib = listOf(
        Track("t1", "", "Trance Anthem", genreTag = "Uplifting Trance", bpm = 138f, energy = 0.85f, camelotKey = "8A"),
        Track("t2", "", "Morning Bhajan", genreTag = "Bhajan", bpm = 80f, energy = 0.3f),
        Track("t3", "", "Psy Voyage", genreTag = "Psytrance", bpm = 142f, energy = 0.9f, camelotKey = "9A"),
        Track("t4", "", "Rain on Leaves", folder = "Music/Sleep", energy = 0.1f),
    )
    private val ctx = AssistantContext(tracks = lib, hourOfDay = 7)

    @Test fun specVoiceCommands() {
        assertEquals(AssistantIntent.PlayGenre("trance"), CommandParser.parse("Play trance playlist"))
        assertEquals(AssistantIntent.AdjustBass(true), CommandParser.parse("Boost bass"))
        assertEquals(AssistantIntent.ActivateTheme("meditation"), CommandParser.parse("Activate meditation theme"))
    }

    @Test fun moreCommands() {
        assertEquals(AssistantIntent.SleepTimer(45), CommandParser.parse("sleep in 45 minutes"))
        assertEquals(AssistantIntent.SleepTimer(60), CommandParser.parse("stop after 1 hour"))
        assertEquals(AssistantIntent.PlayGenre("sleep"), CommandParser.parse("play sleep music"))
        assertEquals(AssistantIntent.SwitchSource(AudioSource.RADIO), CommandParser.parse("switch to radio"))
        assertEquals(AssistantIntent.IdentifySong, CommandParser.parse("What song is this?"))
        assertEquals(AssistantIntent.Enhance(EnhancerMode.NOISE_REMOVAL), CommandParser.parse("remove the noise from this track"))
        assertEquals(AssistantIntent.Transport(TransportCommand.NEXT), CommandParser.parse("skip"))
        assertEquals(AssistantIntent.PlayMood(Mood.HAPPY), CommandParser.parse("play something happy"))
        assertEquals(AssistantIntent.PlayGenre("lofi"), CommandParser.parse("lofi bajao"))
        val s = CommandParser.parse("suggest a workout playlist 170 bpm") as AssistantIntent.SuggestPlaylist
        assertEquals("workout", s.genreId); assertEquals(165f, s.bpmMin)
        assertTrue(CommandParser.parse("explain what is gapless playback") is AssistantIntent.ExplainFeature)
        assertTrue(CommandParser.parse("who wrote the lyrics of this song") is AssistantIntent.Unknown)
    }

    @Test fun playGenreQueuesMatchingTracksAndTheme() = runTest {
        val r = AssistantEngine().handle("Play trance playlist", ctx)
        val queue = r.actions.filterIsInstance<AssistantAction.PlayQueue>().single()
        assertEquals(setOf("t1", "t3"), queue.playlist.trackIds.toSet())
        assertEquals("trance", r.actions.filterIsInstance<AssistantAction.ApplyGenreTheme>().single().genreId)
    }

    @Test fun emptyGenreFallsBackToRadio() = runTest {
        val r = AssistantEngine().handle("play techno", ctx)
        assertTrue(r.actions.contains(AssistantAction.SwitchSource(AudioSource.RADIO)))
    }

    @Test fun unknownGoesToLlmAndCanTriggerActions() = runTest {
        val llm = AssistantLlm { system, turns ->
            assertTrue(system.contains("NOCTERNAL PLAYZ")); assertEquals("why is trance so uplifting", turns.last().text)
            "Rising chord progressions and long breakdowns.\nACTION: boost bass"
        }
        val r = AssistantEngine(llm).handle("why is trance so uplifting", ctx)
        assertTrue(r.fromLlm)
        assertEquals("Rising chord progressions and long breakdowns.", r.reply)
        assertEquals(listOf(AssistantAction.ChangeBass(0.2f)), r.actions)
    }

    @Test fun llmErrorsAreFriendly() = runTest {
        val r = AssistantEngine(AssistantLlm { _, _ -> error("offline") }).handle("tell me a story", ctx)
        assertTrue(r.reply.contains("offline"))
    }

    @Test fun moodAndEqAdvice() {
        assertEquals(Mood.SPIRITUAL, MoodDetector().detect(lib[1])!!.mood)
        assertEquals(Mood.ENERGETIC, MoodDetector().detect(lib[0])!!.mood)
        val advice = EqAdvisor.recommend(lib[0], OutputRoute.SPEAKER)
        assertTrue(advice.preset.id.startsWith("trance_wide"))
        assertTrue(advice.preset.bandGainsDb[0] <= -2f)
    }

    @Test fun albumArtIsDeterministic() {
        val g = AlbumArtGenerator()
        assertEquals(g.generate(lib[1]), g.generate(lib[1]))
        assertTrue(g.generate(lib[1]).prompt.contains("Sacred Gold Aura"))
    }
}
