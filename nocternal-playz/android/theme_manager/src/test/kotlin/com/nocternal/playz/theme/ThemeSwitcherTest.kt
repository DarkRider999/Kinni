package com.nocternal.playz.theme

import com.nocternal.playz.model.AppSettings
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.BackgroundStyle
import com.nocternal.playz.model.EdgeLightingMode
import com.nocternal.playz.model.EqPreset
import com.nocternal.playz.model.LightingAnimation
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ThemeSwitcherTest {
    private class Recorder : LightingEngine, EQManager {
        var edge: EdgeLightingMode? = null
        var anim: LightingAnimation? = null
        var eq: EqPreset? = null
        var applyCount = 0
        override fun setEdgeMode(mode: EdgeLightingMode) { edge = mode; applyCount++ }
        override fun setEdgeStyle(thickness: Float, brightness: Float) {}
        override fun setLightBarAnimation(animation: LightingAnimation) { anim = animation }
        override fun applyPreset(preset: EqPreset) { eq = preset }
    }

    private var settings = AppSettings()
    private val store = ThemeStateStore()
    private val rec = Recorder()
    private val switcher = ThemeSwitcher(ThemeApplier(store, rec, rec, store), { settings })

    private fun track(title: String, genre: String? = null, folder: String = "", bpm: Float? = null, energy: Float? = null) =
        Track(id = title, uri = "file://$title", title = title, genreTag = genre, folder = folder, bpm = bpm, energy = energy)

    @Test fun devotionalSongAppliesSacredGoldAura() {
        val d = switcher.onEvent(ThemeEvent.SongStarted(track("Om Jai Jagdish", genre = "Bhajan")))
        assertNotNull(d)
        assertEquals("sacred_gold_aura", d!!.preset.id)
        assertEquals(LightingAnimation.AURORA_RIBBON, rec.anim)
        assertEquals("vocal_clarity", rec.eq!!.id)
        assertEquals(NeonColor.hex("#FFC940"), store.state.value.accent)
        assertEquals(BackgroundStyle.SACRED_MANDALA, store.state.value.background)
    }

    @Test fun allSpecMappingsHold() {
        val expected = mapOf(
            "devotional" to "Sacred Gold Aura", "meditation" to "Emerald Tranquility", "sleep" to "Moonlit Cyan Drift",
            "hindi_classics" to "Royal Purple Gold", "edm" to "Electric Blue Pulse", "trance" to "Violet Hyperspace",
            "techno" to "Cyber Red Pulse", "night_drive" to "Blue-Purple Galaxy", "lofi" to "Soft Pink Glow",
            "chillout" to "Aqua Drift",
        )
        expected.forEach { (genre, preset) ->
            assertEquals(preset, ThemePresets.byId(GenreCatalog.genreThemeMap.getValue(genre)).name)
        }
        assertEquals(LightingAnimation.INFINITY_LOOP, ThemePresets.EMERALD_TRANQUILITY.lightBarAnimation)
        assertEquals(LightingAnimation.PRISM_CYCLE, ThemePresets.ROYAL_PURPLE_GOLD.lightBarAnimation)
        // Every genre points at a real preset and a real EQ.
        GenreCatalog.all.forEach {
            assertEquals(it.themePresetId, ThemePresets.byId(it.themePresetId).id)
            assertEquals(it.eqPresetId, EqPresets.byId(it.eqPresetId).id)
        }
    }

    @Test fun sameGenreTwiceDoesNotReapply() {
        switcher.onEvent(ThemeEvent.SongStarted(track("a", genre = "Psytrance")))
        val count = rec.applyCount
        assertNull(switcher.onEvent(ThemeEvent.SongStarted(track("b", genre = "Uplifting Trance"))))
        assertEquals(count, rec.applyCount)
    }

    @Test fun genrePlaylistContextWinsOverSongDetection() {
        switcher.onEvent(ThemeEvent.GenrePlaylistOpened("meditation"))
        switcher.onEvent(ThemeEvent.SongStarted(track("Hard Techno Banger", genre = "Techno"), queueGenreId = "meditation"))
        assertEquals("emerald_tranquility", switcher.current.value.preset.id)
    }

    @Test fun manualLockBlocksAutoSwitching() {
        switcher.onEvent(ThemeEvent.ManualThemeSelected("aqua_drift"))
        assertNull(switcher.onEvent(ThemeEvent.SongStarted(track("x", genre = "Techno"))))
        assertEquals("aqua_drift", switcher.current.value.preset.id)
        switcher.onEvent(ThemeEvent.ManualLockReleased)
        assertEquals("cyber_red_pulse", switcher.onEvent(ThemeEvent.SongStarted(track("y", genre = "Techno")))!!.preset.id)
    }

    @Test fun moodOnlyAppliesWhenGenreUnknown() {
        switcher.onEvent(ThemeEvent.SongStarted(track("Tu Hi Re", genre = "Bollywood Classic")))
        assertNull(switcher.onEvent(ThemeEvent.MoodDetected(Mood.ENERGETIC, 0.9f)))
        switcher.onEvent(ThemeEvent.SongStarted(track("untitled_04")))
        val d = switcher.onEvent(ThemeEvent.MoodDetected(Mood.SLEEPY, 0.8f))
        assertEquals("moonlit_cyan_drift", d!!.preset.id)
    }

    @Test fun lowConfidenceMoodIgnored() {
        assertNull(switcher.onEvent(ThemeEvent.MoodDetected(Mood.PARTY, 0.3f)))
    }

    @Test fun sourceChangeUsesSourcePresetWithoutMetadata() {
        assertEquals("cyber_red_pulse", switcher.onEvent(ThemeEvent.SourceChanged(AudioSource.YOUTUBE))!!.preset.id)
        val radio = switcher.onEvent(ThemeEvent.SourceChanged(AudioSource.RADIO, track("Lofi Girl Radio", genre = "lofi")))
        assertEquals("soft_pink_glow", radio!!.preset.id)
    }

    @Test fun customAccentOverridesPreset() {
        settings = settings.copy(customAccent = NeonColor.hex("#123456"))
        switcher.onEvent(ThemeEvent.GenreTileSelected("sleep"))
        assertEquals(NeonColor.hex("#123456"), store.state.value.accent)
    }

    @Test fun eqNotTouchedWhenDisabled() {
        settings = settings.copy(eqFollowsTheme = false)
        switcher.onEvent(ThemeEvent.GenreTileSelected("workout"))
        assertNull(rec.eq)
    }

    @Test fun timeOfDayOnlyWhenEnabledAndIdle() {
        assertNull(switcher.onEvent(ThemeEvent.TimeTick(23)))
        settings = settings.copy(autoThemeByTime = true)
        assertEquals("blue_purple_galaxy", switcher.onEvent(ThemeEvent.TimeTick(23))!!.preset.id)
        switcher.onEvent(ThemeEvent.GenreTileSelected("devotional"))
        assertNull(switcher.onEvent(ThemeEvent.TimeTick(3)))
    }
}
