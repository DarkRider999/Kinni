import 'package:flutter/material.dart';

import '../../domain/entities/enums.dart';

/// Brand palette.
abstract final class AppColors {
  static const primary = Color(0xFF6C63FF);
  static const secondary = Color(0xFFFF6B9D);
  static const background = Color(0xFFF8FAFC);
  static const backgroundDark = Color(0xFF0F0E17);
  static const surfaceDark = Color(0xFF1A1826);
  static const gold = Color(0xFFE8B04B);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF0EA5E9);
  static const ink = Color(0xFF1E1B2E);

  static const brandGradient = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Categorical palette for charts (distinguishable in light and dark).
  static const chart = [
    Color(0xFF6C63FF),
    Color(0xFFFF6B9D),
    Color(0xFF14B8A6),
    Color(0xFFF59E0B),
    Color(0xFF0EA5E9),
    Color(0xFF8B5CF6),
    Color(0xFF22C55E),
    Color(0xFFEF4444),
    Color(0xFF64748B),
    Color(0xFFD946EF),
    Color(0xFF84CC16),
  ];

  static Color status(LeadStatus s) => switch (s) {
        LeadStatus.newLead => const Color(0xFF0EA5E9),
        LeadStatus.interested => const Color(0xFF6C63FF),
        LeadStatus.documentsRequested => const Color(0xFFF59E0B),
        LeadStatus.documentsReceived => const Color(0xFFEAB308),
        LeadStatus.applicationSubmitted => const Color(0xFF8B5CF6),
        LeadStatus.underReview => const Color(0xFFD946EF),
        LeadStatus.approved => const Color(0xFF22C55E),
        LeadStatus.disbursed => const Color(0xFF14B8A6),
        LeadStatus.rejected => const Color(0xFFEF4444),
        LeadStatus.notEligible => const Color(0xFF64748B),
        LeadStatus.notInterested => const Color(0xFF94A3B8),
      };

  static Color priority(Priority p) => switch (p) {
        Priority.low => const Color(0xFF64748B),
        Priority.medium => const Color(0xFF0EA5E9),
        Priority.high => const Color(0xFFF59E0B),
        Priority.urgent => const Color(0xFFEF4444),
      };

  static Color document(DocumentStatus s) => switch (s) {
        DocumentStatus.pending => const Color(0xFFF59E0B),
        DocumentStatus.received => const Color(0xFF0EA5E9),
        DocumentStatus.verified => const Color(0xFF22C55E),
        DocumentStatus.rejected => const Color(0xFFEF4444),
      };

  static Color score(int s) => s >= 75 ? success : s >= 50 ? primary : s >= 25 ? warning : const Color(0xFF94A3B8);
}
