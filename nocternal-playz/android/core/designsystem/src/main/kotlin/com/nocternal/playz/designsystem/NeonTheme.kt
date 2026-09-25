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
    NeonPalette(Color(0xFF00F0FF), Color(0xFFFF00E5), 0.8f, Color(0xFF0A0A0F), Color(0xFF14141C), Color.White, Color(0xFF8A8AA0), ThemeMode.NEON, BackgroundStyle.DEEP_SPACE)
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
    val glow by animateFloatAsState(if (mode == ThemeMode.NEON || mode == ThemeMode.AMOLED) state.glowIntensity else state.glowIntensity * 0.4f, tween(600), label = "glow")
    val background = when (mode) {
        ThemeMode.AMOLED -> Color.Black
        ThemeMode.NEON -> Color(0xFF0A0A0F)
        ThemeMode.DARK -> Color(0xFF121218)
        ThemeMode.LIGHT -> Color(0xFFF4F4FA)
    }
    val surface = when (mode) {
        ThemeMode.AMOLED -> Color(0xFF0B0B10)
        ThemeMode.NEON -> Color(0xFF14141C)
        ThemeMode.DARK -> Color(0xFF1E1E26)
        ThemeMode.LIGHT -> Color.White
    }
    val onBg = if (dark) Color(0xFFF2F2FF) else Color(0xFF101018)
    val palette = NeonPalette(accent, secondary, glow, background, surface, onBg, if (dark) Color(0xFF8A8AA0) else Color(0xFF5A5A70), mode, state.background)
    val scheme: ColorScheme = if (dark) darkColorScheme(
        primary = accent, secondary = secondary, background = background, surface = surface,
        onBackground = onBg, onSurface = onBg, surfaceVariant = surface.copy(alpha = 0.9f), onPrimary = Color.Black,
    ) else lightColorScheme(primary = accent, secondary = secondary, background = background, surface = surface, onBackground = onBg, onSurface = onBg)
    CompositionLocalProvider(LocalNeon provides palette) {
        MaterialTheme(colorScheme = scheme, typography = NeonTypography, content = content)
    }
}
