import 'package:flutter/material.dart';

import '../../core/utils/id.dart';
import '../../domain/entities/product.dart';

/// Factory defaults created at onboarding.
abstract final class Defaults {
  /// (name, Material icon code point, colour).
  static final productSpecs = <(String, int, int)>[
    ('Personal Loan', Icons.account_balance_wallet.codePoint, 0xFF6C63FF),
    ('Business Loan', Icons.business_center.codePoint, 0xFF14B8A6),
    ('Mortgage', Icons.home.codePoint, 0xFFF59E0B),
    ('Credit Card', Icons.credit_card.codePoint, 0xFFFF6B9D),
    ('Auto Loan', Icons.directions_car.codePoint, 0xFF0EA5E9),
    ('Insurance', Icons.shield.codePoint, 0xFF22C55E),
  ];

  static List<Product> products(Iterable<String> selectedNames) {
    final now = DateTime.now();
    final out = <Product>[];
    var order = 0;
    for (final name in selectedNames) {
      final spec = productSpecs.where((s) => s.$1 == name).firstOrNull;
      out.add(Product(
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name: name,
        iconCode: spec?.$2 ?? Icons.category.codePoint,
        colorValue: spec?.$3 ?? 0xFF8B5CF6,
        sortOrder: order++,
      ));
    }
    return out;
  }
}
