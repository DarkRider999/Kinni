import 'package:flutter/material.dart';

/// Design tokens — the single source of truth for colour, spacing, radius,
/// typography and motion. Mirrors `docs/smart-beginning/SPEC.md` §2.
///
/// Nothing elsewhere in the app uses a raw hex or magic number — only tokens.
@immutable
class SbColors {
  const SbColors._();

  static const Color primary = Color(0xFF4F8CFF);
  static const Color primaryDark = Color(0xFF2E6BE0);
  static const Color secondary = Color(0xFFFFB347);
  static const Color success = Color(0xFF5BD75B);
  static const Color danger = Color(0xFFFF6464);
  static const Color background = Color(0xFFF8FCFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF1E2A3A);
  static const Color inkMuted = Color(0xFF6B7A90);
  static const Color backgroundDark = Color(0xFF0E1726);
  static const Color surfaceDark = Color(0xFF17233A);
  static const Color inkDark = Color(0xFFEAF1FB);

  // Per-world accents (SPEC §2.1 / §6.4).
  static const Color forest = Color(0xFF5BD75B);
  static const Color numbers = Color(0xFFFFB347);
  static const Color animals = Color(0xFFFF8A65);
  static const Color music = Color(0xFFB388FF);
  static const Color science = Color(0xFF4FD1C5);
  static const Color story = Color(0xFFF6A6C1);
  static const Color emotion = Color(0xFF7FB3FF);
}

/// Spacing scale in logical pixels (SPEC §2.3).
@immutable
class SbSpacing {
  const SbSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double huge = 40;
  static const double giant = 48;
}

/// Corner radii (SPEC §2.3).
@immutable
class SbRadius {
  const SbRadius._();

  static const double sm = 12;
  static const double md = 20;
  static const double lg = 28;
  static const double pill = 999;
}

/// Child-safe tap-target sizes (SPEC §2.4).
@immutable
class SbTapTarget {
  const SbTapTarget._();

  static const double min = 56;
  static const double big = 88;
}

/// Motion durations (SPEC §9.1 / §11).
@immutable
class SbDurations {
  const SbDurations._();

  static const Duration fast = Duration(milliseconds: 120);
  static const Duration normal = Duration(milliseconds: 240);
  static const Duration slow = Duration(milliseconds: 300);
  static const Duration splashMin = Duration(seconds: 2);
  static const Duration splashMax = Duration(seconds: 4);
}

/// Intended font families (SPEC §2.2). Font files are bundled in Phase 1;
/// until then these names fall back to the platform default, which keeps the
/// scaffold buildable and tests hermetic (no network font fetch).
@immutable
class SbFonts {
  const SbFonts._();

  static const String display = 'Baloo 2';
  static const String heading = 'Poppins';
  static const String body = 'Nunito';
}
