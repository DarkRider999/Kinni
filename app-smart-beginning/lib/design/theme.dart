import 'package:flutter/material.dart';

import 'tokens.dart';

/// Builds light and dark [ThemeData] from the design tokens (SPEC §2).
class SbTheme {
  const SbTheme._();

  static ThemeData light() => _base(Brightness.light);
  static ThemeData dark() => _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final bool isDark = brightness == Brightness.dark;

    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: SbColors.primary,
      brightness: brightness,
    ).copyWith(
      primary: SbColors.primary,
      secondary: SbColors.secondary,
      error: SbColors.danger,
      surface: isDark ? SbColors.surfaceDark : SbColors.surface,
    );

    final Color ink = isDark ? SbColors.inkDark : SbColors.ink;

    final TextTheme text = TextTheme(
      displayLarge: TextStyle(
        fontFamily: SbFonts.display,
        fontSize: 34,
        fontWeight: FontWeight.w700,
        color: ink,
        height: 1.3,
      ),
      headlineMedium: TextStyle(
        fontFamily: SbFonts.display,
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: ink,
        height: 1.3,
      ),
      titleLarge: TextStyle(
        fontFamily: SbFonts.heading,
        fontSize: 22,
        fontWeight: FontWeight.w600,
        color: ink,
        height: 1.3,
      ),
      bodyLarge: TextStyle(
        fontFamily: SbFonts.body,
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: ink,
        height: 1.4,
      ),
      labelLarge: TextStyle(
        fontFamily: SbFonts.heading,
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: ink,
        height: 1.3,
      ),
      bodySmall: const TextStyle(
        fontFamily: SbFonts.body,
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: SbColors.inkMuted,
        height: 1.3,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor:
          isDark ? SbColors.backgroundDark : SbColors.background,
      textTheme: text,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(SbTapTarget.min, SbTapTarget.min),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SbRadius.pill),
          ),
          textStyle: text.labelLarge,
        ),
      ),
    );
  }
}
