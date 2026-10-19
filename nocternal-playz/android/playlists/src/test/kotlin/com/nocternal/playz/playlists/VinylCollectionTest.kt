package com.nocternal.playz.playlists

import com.nocternal.playz.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class VinylCollectionTest {
    @Test fun groupsTracksIntoAlbumSleeves() {
        val tracks = listOf(
            Track("1", "", "Strobe", artist = "Deadmau5", album = "For Lack of a Better Name"),
            Track("2", "", "Ghosts n Stuff", artist = "Deadmau5", album = "For Lack of a Better Name"),
            Track("3", "", "Clarity", artist = "Zedd", album = "Clarity"),
            Track("4", "", "Loner", artist = "Deadmau5", album = ""),
        )
        val records = VinylCollection.build(tracks)

        val forLack = records.first { it.album == "For Lack of a Better Name" }
        assertEquals(listOf("2", "1"), forLack.trackIds) // alphabetical: "Ghosts..." before "Strobe"
        assertEquals("Deadmau5", forLack.artist)

        val singles = records.first { it.artist == "Deadmau5" && it.album == "Singles & B-Sides" }
        assertEquals(listOf("4"), singles.trackIds)

        assertTrue(records.any { it.album == "Clarity" && it.artist == "Zedd" })
    }
}
