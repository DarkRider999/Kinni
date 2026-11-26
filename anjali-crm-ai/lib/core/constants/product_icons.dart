import 'package:flutter/material.dart';

/// Curated, const icon catalogue for products. Products store the icon's
/// code point; looking it up here (instead of `IconData(code)`) keeps
/// release builds tree-shakable.
abstract final class ProductIcons {
  static const all = <IconData>[
    Icons.account_balance_wallet,
    Icons.business_center,
    Icons.home,
    Icons.credit_card,
    Icons.directions_car,
    Icons.shield,
    Icons.category,
    Icons.savings,
    Icons.account_balance,
    Icons.school,
    Icons.health_and_safety,
    Icons.flight,
    Icons.diamond,
    Icons.storefront,
    Icons.real_estate_agent,
    Icons.payments,
    Icons.request_quote,
    Icons.two_wheeler,
    Icons.local_hospital,
    Icons.workspace_premium,
  ];

  static IconData of(int codePoint) {
    for (final i in all) {
      if (i.codePoint == codePoint) return i;
    }
    return Icons.category;
  }
}
