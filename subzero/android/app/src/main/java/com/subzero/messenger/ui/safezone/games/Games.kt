package com.subzero.messenger.ui.safezone.games

import androidx.compose.runtime.Composable
import com.subzero.messenger.ui.safezone.SafeZoneScreen

/**
 * Registry mapping each game [SafeZoneScreen] to a Composable. Two games
 * (Tic-Tac-Toe, 2048) are fully implemented as convincing, playable decoys; the
 * rest are registered with a shared [PlaceholderGame] and marked TODO so the
 * pool is complete and the SafeZone flow works end-to-end today.
 *
 * "Game packs" (Casual / Brain / Kids / Stealth) are simply named subsets of
 * these ids, resolved in settings.
 */
object GameRegistry {
    @Composable
    fun render(screen: SafeZoneScreen) {
        when (screen) {
            SafeZoneScreen.TIC_TAC_TOE -> TicTacToeGame()
            SafeZoneScreen.GAME_2048 -> Game2048()
            SafeZoneScreen.SNAKE -> SnakeGame()
            SafeZoneScreen.SUDOKU -> SudokuGame()
            SafeZoneScreen.MEMORY -> MemoryGame()
            SafeZoneScreen.SLIDING_TILES -> SlidingTilesGame()
            SafeZoneScreen.QUICK_MATH -> QuickMathGame()
            SafeZoneScreen.PATTERN_MATCH -> PatternMatchGame()
            SafeZoneScreen.WORD_SHUFFLE -> WordShuffleGame()
            SafeZoneScreen.BUBBLE_POP -> BubblePopGame()
            else -> PlaceholderGame(screen.display)
        }
    }

    val packs: Map<String, Set<SafeZoneScreen>> = mapOf(
        "Casual" to setOf(SafeZoneScreen.GAME_2048, SafeZoneScreen.SNAKE, SafeZoneScreen.BUBBLE_POP),
        "Brain" to setOf(SafeZoneScreen.MEMORY, SafeZoneScreen.QUICK_MATH, SafeZoneScreen.PATTERN_MATCH, SafeZoneScreen.SUDOKU),
        "Kids" to setOf(SafeZoneScreen.TIC_TAC_TOE, SafeZoneScreen.SLIDING_TILES),
        "Stealth" to setOf(SafeZoneScreen.WORD_SHUFFLE, SafeZoneScreen.MEMORY),
    )
}
