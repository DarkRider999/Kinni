package com.nocternal.playz.playlists

import com.nocternal.playz.model.Track

/** Folder player: the library as a folder tree built from each track's folder path. */
data class FolderNode(
    val name: String,
    val path: String,
    val children: List<FolderNode>,
    /** Tracks directly in this folder. */
    val trackIds: List<String>,
) {
    /** All tracks in this folder and below, in folder order — what "play folder" queues. */
    fun allTrackIds(): List<String> = trackIds + children.flatMap { it.allTrackIds() }
    val totalCount: Int get() = trackIds.size + children.sumOf { it.totalCount }

    fun find(path: String): FolderNode? =
        if (this.path == path) this else children.firstNotNullOfOrNull { it.find(path) }
}

object FolderTree {
    fun build(tracks: List<Track>): FolderNode {
        class Mutable(val name: String, val path: String) {
            val children = sortedMapOf<String, Mutable>(String.CASE_INSENSITIVE_ORDER)
            val items = mutableListOf<Track>()
            fun freeze(): FolderNode = FolderNode(name, path, children.values.map { it.freeze() }, items.sortedBy { it.title.lowercase() }.map { it.id })
        }
        val root = Mutable("Storage", "")
        for (t in tracks) {
            var node = root
            val parts = t.folder.replace('\\', '/').split('/').filter { it.isNotBlank() }
            for (p in parts) node = node.children.getOrPut(p) { Mutable(p, if (node.path.isEmpty()) p else "${node.path}/$p") }
            node.items += t
        }
        return root.freeze()
    }
}
