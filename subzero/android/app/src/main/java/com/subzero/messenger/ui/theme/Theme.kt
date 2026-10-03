package com.subzero.messenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Ultra-dark stealth palette with a single neon accent. */
private val Neon = Color(0xFF35E0C4)
private val Ink = Color(0xFF0B0F14)
private val Panel = Color(0xFF16202B)

private val SubZeroColors = darkColorScheme(
    primary = Neon,
    onPrimary = Color.Black,
    background = Ink,
    onBackground = Color(0xFFE6F1EF),
    surface = Panel,
    onSurface = Color(0xFFE6F1EF),
    secondary = Color(0xFF1C7A6E),
)

@Composable
fun SubZeroTheme(content: @Composable () -> Unit) {
    // Always dark by design; system dark-mode flag is intentionally ignored.
    @Suppress("UNUSED_EXPRESSION") isSystemInDarkTheme()
    MaterialTheme(colorScheme = SubZeroColors, content = content)
}
