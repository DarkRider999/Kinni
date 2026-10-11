import 'package:flutter/material.dart';

import '../../core/utils/id.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/whatsapp_template.dart';

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

  static List<WhatsAppTemplate> templates() {
    final now = DateTime.now();
    WhatsAppTemplate t(String name, TemplateCategory c, String body) =>
        WhatsAppTemplate(id: newId(), createdAt: now, updatedAt: now, name: name, category: c, body: body, isDefault: true);
    return [
      t('Document request', TemplateCategory.documentRequest,
          'Hello {name}, hope you are doing well! 😊\n\nTo process your {product} application, kindly share the following documents:\n{documents}\n\nYou can send clear photos or PDFs here on WhatsApp.\n\nThank you,\n{agent}'),
      t('Followup', TemplateCategory.followup,
          'Hi {name}, this is {agent}. Just following up on your {product} enquiry. Is now a good time to talk? I am happy to answer any questions. 🙏'),
      t('Approval', TemplateCategory.approval,
          'Congratulations {name}! 🎉 Your {product} application has been APPROVED. I will share the next steps shortly.\n\nWarm regards,\n{agent}'),
      t('Rejection', TemplateCategory.rejection,
          'Dear {name}, thank you for your patience. Unfortunately your {product} application could not be approved at this time. I will let you know as soon as a suitable option becomes available.\n\nRegards,\n{agent}'),
      t('Custom message', TemplateCategory.custom, 'Hello {name}, '),
    ];
  }
}
