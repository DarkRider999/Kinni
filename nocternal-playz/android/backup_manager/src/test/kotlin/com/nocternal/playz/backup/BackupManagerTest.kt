package com.nocternal.playz.backup

import com.nocternal.playz.model.AppSettings
import com.nocternal.playz.model.PlayEvent
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.PlaylistKind
import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupManagerTest {
    private val phoneA = listOf(Track("a1", "", "Kun Faya Kun", "A.R. Rahman", durationMs = 473_000), Track("a2", "", "Strobe (Radio Edit)", "deadmau5", durationMs = 200_000))
    // Same songs on the new phone have different media IDs and slightly different durations/titles.
    private val phoneB = listOf(Track("b9", "", "Kun Faya Kun", "A.R. Rahman", durationMs = 473_400), Track("b7", "", "Strobe", "Deadmau5", durationMs = 200_900))
    private val state = LibraryState(
        settings = AppSettings(crossfadeSeconds = 6f, assistantApiKey = "secret"),
        playlists = listOf(Playlist("p", "Sufi nights", listOf("a1", "a2")), Playlist("s", "Most Played", listOf("a1"), PlaylistKind.SMART)),
        favorites = setOf("a1"),
        history = listOf(PlayEvent("a1", 1000, 60_000)),
    )
    private val mgr = BackupManager("1.0.0", clock = { 42 })

    @Test fun roundTripAcrossDevices() {
        val text = mgr.export(state, phoneA)
        assertFalse("API key must never be exported", text.contains("secret"))
        val r = mgr.restore(text, LibraryState(AppSettings(assistantApiKey = "local"), emptyList(), emptySet(), emptyList()), phoneB, RestoreStrategy.REPLACE)
        assertEquals(1, r.restoredPlaylists)
        assertEquals(listOf("b9", "b7"), r.state.playlists.single().trackIds)
        assertEquals(setOf("b9"), r.state.favorites)
        assertEquals("b9", r.state.history.single().trackId)
        assertEquals(6f, r.state.settings.crossfadeSeconds)
        assertEquals("local", r.state.settings.assistantApiKey)
        assertTrue(r.unmatchedTrackKeys.isEmpty())
    }

    @Test fun privateModeSkipsHistory() {
        val text = mgr.export(state.copy(settings = state.settings.copy(privateMode = true)), phoneA)
        assertTrue(mgr.parse(text).history.isEmpty())
    }

    @Test fun mergeKeepsLocalData() {
        val text = mgr.export(state, phoneA)
        val local = LibraryState(AppSettings(), listOf(Playlist("x", "Sufi Nights", listOf("b9"))), setOf("b7"), emptyList())
        val r = mgr.restore(text, local, phoneB, RestoreStrategy.MERGE)
        assertEquals(1, r.state.playlists.size)
        assertEquals(setOf("b7", "b9"), r.state.favorites)
    }

    @Test fun migratesV1AndRejectsGarbage() {
        val v1 = """{"format":"nocternal-playz-backup","schemaVersion":1,"createdAtEpochMs":1,"settings":{},"playlists":[],"favourites":["x"],"history":[]}"""
        assertEquals(listOf("x"), mgr.parse(v1).favorites)
        assertTrue(runCatching { mgr.parse("{}") }.exceptionOrNull() is BackupException)
        assertTrue(runCatching { mgr.parse(v1.replace("\"schemaVersion\":1", "\"schemaVersion\":99")) }.exceptionOrNull() is BackupException)
    }
}
