package com.nocternal.playz.model

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class LyricBookmarkTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun roundTripsThroughJson() {
        val b = LyricBookmark("t1", 12_000L, "Line of lyrics", "Trance Anthem", "DJ Nova", 1_700_000_000_000L)
        val encoded = json.encodeToString(LyricBookmark.serializer(), b)
        assertEquals(b, json.decodeFromString(LyricBookmark.serializer(), encoded))
    }

    @Test fun oldJsonWithoutBookmarksListStillDecodesLibraryStyleDefaults() {
        // Additive-field pattern: a field added later must decode fine even when absent from old JSON.
        val decoded = json.decodeFromString(TestBookmarks.serializer(), "{\"bookmarks\":[]}")
        assertEquals(emptyList<LyricBookmark>(), decoded.bookmarks)
    }
}

@kotlinx.serialization.Serializable
private data class TestBookmarks(val bookmarks: List<LyricBookmark> = emptyList())
