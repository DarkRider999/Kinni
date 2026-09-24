import 'package:flutter/material.dart';

/// NeonForge design tokens (spec §2.1).
class NF {
  static const bg = Color(0xFF07080D);
  static const surface = Color(0xFF0E1117);
  static const elevated = Color(0xFF161B24);
  static const border = Color(0x14FFFFFF);
  static const borderStrong = Color(0x29FFFFFF);
  static const text = Color(0xFFE8ECF3);
  static const text2 = Color(0xFF8A93A6);
  static const cyan = Color(0xFF00F0FF);
  static const magenta = Color(0xFFFF2BD6);
  static const lime = Color(0xFFB6FF3B);
  static const amber = Color(0xFFFFB020);
  static const red = Color(0xFFFF4D5E);

  static List<BoxShadow> glow([Color c = cyan]) =>
      [BoxShadow(color: c.withValues(alpha: 0.45), blurRadius: 12)];

  static Color statusColor(String status) => switch (status) {
        'running' || 'cancelling' => cyan,
        'succeeded' || 'completed' => lime,
        'partial' => amber,
        'failed' || 'cancelled' => red,
        _ => text2,
      };
}

ThemeData neonTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  final scheme = const ColorScheme.dark(
    primary: NF.cyan,
    onPrimary: Color(0xFF04121A),
    secondary: NF.magenta,
    surface: NF.surface,
    onSurface: NF.text,
    error: NF.red,
  );
  return base.copyWith(
    colorScheme: scheme,
    scaffoldBackgroundColor: NF.bg,
    appBarTheme: const AppBarTheme(backgroundColor: NF.bg, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: NF.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: NF.border)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NF.cyan,
        foregroundColor: const Color(0xFF04121A),
        shape: const StadiumBorder(),
        minimumSize: const Size(0, 44),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NF.text,
        side: const BorderSide(color: NF.borderStrong),
        shape: const StadiumBorder(),
        minimumSize: const Size(0, 44),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: NF.bg,
      selectedColor: NF.cyan.withValues(alpha: 0.12),
      side: const BorderSide(color: NF.borderStrong),
      shape: const StadiumBorder(),
    ),
    sliderTheme: base.sliderTheme.copyWith(activeTrackColor: NF.cyan, thumbColor: NF.cyan, inactiveTrackColor: NF.elevated),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: NF.bg,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: NF.borderStrong)),
      enabledBorder:
          OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: NF.borderStrong)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: NF.cyan)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: NF.surface,
      indicatorColor: NF.cyan.withValues(alpha: 0.12),
      iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(color: s.contains(WidgetState.selected) ? NF.cyan : NF.text2)),
      labelTextStyle: WidgetStateProperty.resolveWith((s) =>
          TextStyle(fontSize: 12, color: s.contains(WidgetState.selected) ? NF.cyan : NF.text2)),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: NF.cyan,
        selectedForegroundColor: const Color(0xFF04121A),
        side: const BorderSide(color: NF.borderStrong),
      ),
    ),
  );
}
