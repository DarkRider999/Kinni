package com.subzero.messenger.ui.safezone

import com.subzero.messenger.data.RamMessageBuffer

/**
 * The pool of screens SafeZone can show. Utility screens double as decoys; the
 * games come from [com.subzero.messenger.ui.safezone.games].
 */
enum class SafeZoneScreen(val id: String, val display: String, val isGame: Boolean) {
    CALCULATOR("calc", "Calculator", false),
    NOTES("notes", "Notes", false),
    WEATHER("weather", "Weather", false),
    GAME_2048("2048", "2048", true),
    SNAKE("snake", "Snake", true),
    TIC_TAC_TOE("ttt", "Tic-Tac-Toe", true),
    MEMORY("memory", "Memory Puzzle", true),
    SLIDING_TILES("slide", "Sliding Tiles", true),
    QUICK_MATH("qmath", "Quick Math", true),
    PATTERN_MATCH("pattern", "Pattern Match", true),
    WORD_SHUFFLE("word", "Word Shuffle", true),
    BUBBLE_POP("bubble", "Bubble Pop", true);
}

/**
 * Chooses the next SafeZone screen from the user-enabled set with two rules
 * from the spec: never repeat the immediately previous screen, and reshuffle
 * the pool after each activation so the order is unpredictable.
 */
class SafeZonePicker(enabled: Set<SafeZoneScreen>) {
    private var pool: MutableList<SafeZoneScreen> = enabled.shuffled().toMutableList()
    private var last: SafeZoneScreen? = null

    fun setEnabled(enabled: Set<SafeZoneScreen>) {
        pool = enabled.shuffled().toMutableList()
    }

    fun next(): SafeZoneScreen {
        if (pool.isEmpty()) return SafeZoneScreen.CALCULATOR
        var choice = pool.removeAt(0)
        if (choice == last && pool.isNotEmpty()) {
            val alt = pool.removeAt(0)
            pool.add(choice)
            choice = alt
        }
        if (pool.isEmpty()) pool = pool.plus(lastKnownEnabled()).shuffled().toMutableList()
        last = choice
        return choice
    }

    private fun lastKnownEnabled(): List<SafeZoneScreen> = (pool + listOfNotNull(last)).distinct()
}

/**
 * Drives SafeZone activation and exit. Activation is instant: it clears the
 * visible chat from the RAM buffer's view, and signals the UI (via [onScreen])
 * to swap in a decoy/game full-bleed. Exit re-locks per [autoLockTimeoutMillis].
 */
class SafeZoneController(
    private val buffer: RamMessageBuffer,
    private val picker: SafeZonePicker,
    private val onScreen: (SafeZoneScreen?) -> Unit,
    private val onAutoLock: () -> Unit,
    private val autoLockTimeoutMillis: Long = 60_000L,
) {
    @Volatile private var activatedAt: Long = 0L
    @Volatile var active: Boolean = false
        private set

    /** Called by the SafeZone button next to the input row. */
    fun activate(currentConversationId: String?) {
        currentConversationId?.let { buffer.clearConversationView(it) }
        active = true
        activatedAt = System.currentTimeMillis()
        onScreen(picker.next())
    }

    /** Called by a recognized return gesture. */
    fun exit() {
        if (!active) return
        if (System.currentTimeMillis() - activatedAt > autoLockTimeoutMillis) {
            active = false
            onScreen(null)
            onAutoLock()   // force biometric re-unlock; caller rotates identity if configured
            return
        }
        active = false
        onScreen(null)
    }

    fun tick() {
        if (active && System.currentTimeMillis() - activatedAt > autoLockTimeoutMillis) {
            active = false
            onScreen(null)
            onAutoLock()
        }
    }
}
