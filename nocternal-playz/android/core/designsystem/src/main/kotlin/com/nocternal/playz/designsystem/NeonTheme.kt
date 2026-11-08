package com.nocternal.playz.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.nocternal.playz.model.BackgroundStyle
import com.nocternal.playz.model.NeonColor
import com.nocternal.playz.model.ThemeMode
import com.nocternal.playz.theme.NeonThemeState

fun NeonColor.toColor(): Color = Color(argb.toInt())

/** Colours the neon UI needs beyond Material's scheme. Animated when the theme switches. */
@Immutable
data class NeonPalette(
    val accent: Color,
    val secondary: Color,
    val glow: Float,
    val background: Color,
    val surface: Color,
    val onBackground: Color,
    val muted: Color,
    val mode: ThemeMode,
    val backgroundStyle: BackgroundStyle,
)

val LocalNeon = staticCompositionLocalOf {
    NeonPalette(Color(0xFF00E5FF), Color(0xFFFF6B00), 0.8f, Color(0xFF080808), Color(0xFF101010), Color(0xFFFFFFFF), Color(0xFFB0B0B0), ThemeMode.NEON, BackgroundStyle.DEEP_SPACE)
}

object Neon {
    val palette: NeonPalette @Composable get() = LocalNeon.current
}

private val NeonTypography = Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black, fontSize = 34.sp, letterSpacing = 4.sp),
    headlineSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = 1.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 1.5.sp),
)

/**
 * App theme driven by [NeonThemeState] (set by the genre theme switcher). Accent, glow and background
 * cross-fade over 600 ms so switching genres feels like stage lighting changing, not a flicker.
 */
@Composable
fun NocternalTheme(state: NeonThemeState, userMode: ThemeMode = state.mode, content: @Composable () -> Unit) {
    val mode = userMode
    val dark = mode != ThemeMode.LIGHT
    val accent by animateColorAsState(state.accent.toColor(), tween(600), label = "accent")
    val secondary by animateColorAsState(state.secondaryAccent.toColor(), tween(600), label = "secondary")
    val glow by animateFloatAsState(if (mode == ThemeMode.NEON || mode == ThemeMode.AMOLED) state.glowIntensity.coerceIn(0f, 1f) else state.glowIntensity.coerceIn(0f, 1f) * 0.55f, tween(600), label = "glow")
    val background = when (mode) {
        ThemeMode.AMOLED -> Color.Black
        ThemeMode.NEON -> Color(0xFF080808)
        ThemeMode.DARK -> Color(0xFF0F0F0F)
        ThemeMode.LIGHT -> Color(0xFFF4F4FA)
    }
    val surface = when (mode) {
        ThemeMode.AMOLED -> Color(0xFF0C0C0C)
        ThemeMode.NEON -> Color(0xFF101010)
        ThemeMode.DARK -> Color(0xFF151515)
        ThemeMode.LIGHT -> Color.White
    }
    val onBg = if (dark) Color(0xFFFFFFFF) else Color(0xFF101018)
    val palette = NeonPalette(accent, secondary, glow, background, surface, onBg, if (dark) Color(0xFFB0B0B0) else Color(0xFF5A5A70), mode, state.background)
    val scheme: ColorScheme = if (dark) darkColorScheme(
        primary = accent, secondary = secondary, background = background, surface = surface,
        onBackground = onBg, onSurface = onBg, surfaceVariant = surface.copy(alpha = 0.9f), onPrimary = Color.Black,
    ) else lightColorScheme(primary = accent, secondary = secondary, background = background, surface = surface, onBackground = onBg, onSurface = onBg)
    CompositionLocalProvider(LocalNeon provides palette) {
        MaterialTheme(colorScheme = scheme, typography = NeonTypography, content = content)
    }
}
