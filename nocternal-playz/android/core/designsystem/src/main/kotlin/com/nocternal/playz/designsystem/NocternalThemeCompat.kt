package com.nocternal.playz.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val NeonPink = Color(0xFFFF008C)
val NeonPurple = Color(0xFF9D00FF)
val NeonCyan = Color(0xFF00E5FF)
val DarkSurface = Color(0xFF0B0B0B)
val DarkBackground = Color(0xFF000000)
val NeonGold = Color(0xFFFFD700)
val NeonGreen = Color(0xFF00FF88)

@Composable
fun NocternalAppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = androidx.compose.material3.darkColorScheme(
            primary = NeonPink,
            secondary = NeonPurple,
            tertiary = NeonCyan,
            background = DarkBackground,
            surface = DarkSurface,
            onPrimary = Color.White,
            onSecondary = Color.White,
            onBackground = Color.White,
            onSurface = Color.White,
        ),
        content = content
    )
}
