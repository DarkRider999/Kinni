package com.aistudio.uaelottery.lucky.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val Gold = androidx.compose.ui.graphics.Color(0xFFFFC947)
private val DeepIndigo = androidx.compose.ui.graphics.Color(0xFF1B1B3A)
private val Coral = androidx.compose.ui.graphics.Color(0xFFFF7043)

private val LightColors = lightColorScheme(
    primary = DeepIndigo,
    secondary = Gold,
    tertiary = Coral
)

private val DarkColors = darkColorScheme(
    primary = Gold,
    secondary = Coral,
    tertiary = DeepIndigo
)

@Composable
fun LuckyNumbersTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
