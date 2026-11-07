package com.nocternal.playz.designsystem

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp

/** Width buckets matching Android's own large-screen breakpoints (compact phone, large phone/unfolded
 *  foldable, tablet), used instead of hardcoding one phone-sized layout everywhere. */
enum class ScreenSize { COMPACT, MEDIUM, EXPANDED }

object Responsive {
    fun classify(widthDp: Int): ScreenSize = when {
        widthDp < 600 -> ScreenSize.COMPACT
        widthDp < 840 -> ScreenSize.MEDIUM
        else -> ScreenSize.EXPANDED
    }

    /** Grid columns for tile-style content (genre tiles, vinyl sleeves, …): more columns as width grows,
     *  rather than one fixed count that leaves a tablet mostly empty or a small phone cramped. */
    fun gridColumns(screenSize: ScreenSize): Int = when (screenSize) {
        ScreenSize.COMPACT -> 2
        ScreenSize.MEDIUM -> 3
        ScreenSize.EXPANDED -> 4
    }
}

@Composable
fun rememberScreenSize(): ScreenSize {
    val widthDp = LocalConfiguration.current.screenWidthDp
    return remember(widthDp) { Responsive.classify(widthDp) }
}

/** The minimum touch target every tappable control must meet (master-prompt spec: 48dp). */
val MinTouchTarget = 48.dp
