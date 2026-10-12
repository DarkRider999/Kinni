import 'package:flutter/material.dart';

import '../../core/utils/id.dart';
import '../../domain/entities/document_category.dart';
import '../../domain/entities/message_template.dart';
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
        requiredCategoryIds: requiredFor(name),
      ));
    }
    return out;
  }

  static const _idDocs = [DocumentCategory.passport, DocumentCategory.emiratesIdFront, DocumentCategory.emiratesIdBack, DocumentCategory.visa];

  /// Default required-document checklist per product name.
  static List<String> requiredFor(String productName) {
    final n = productName.toLowerCase();
    if (n.contains('credit card')) {
      return [..._idDocs, DocumentCategory.salaryCertificate, DocumentCategory.bankStatement, DocumentCategory.creditCardForm];
    }
    if (n.contains('business')) {
      return [DocumentCategory.passport, DocumentCategory.emiratesIdFront, DocumentCategory.emiratesIdBack, DocumentCategory.bankStatement, DocumentCategory.tradeLicense, DocumentCategory.loanApplicationForm];
    }
    if (n.contains('insurance')) return [DocumentCategory.passport, DocumentCategory.emiratesIdFront, DocumentCategory.emiratesIdBack];
    if (n.contains('loan') || n.contains('mortgage')) {
      return [..._idDocs, DocumentCategory.salaryCertificate, DocumentCategory.bankStatement, DocumentCategory.loanApplicationForm];
    }
    return [..._idDocs, DocumentCategory.salaryCertificate, DocumentCategory.bankStatement];
  }

  /// (id, name, supportsExpiry) for the default vault folders.
  static const categorySpecs = <(String, String, bool)>[
    (DocumentCategory.passport, 'Passport', true),
    (DocumentCategory.emiratesIdFront, 'Emirates ID Front', true),
    (DocumentCategory.emiratesIdBack, 'Emirates ID Back', true),
    (DocumentCategory.visa, 'Visa', true),
    (DocumentCategory.salaryCertificate, 'Salary Certificate', false),
    (DocumentCategory.bankStatement, 'Bank Statement', false),
    (DocumentCategory.creditCardForm, 'Credit Card Form', false),
    (DocumentCategory.loanApplicationForm, 'Loan Application Form', false),
    (DocumentCategory.tradeLicense, 'Company Trade License', true),
    (DocumentCategory.other, 'Other Documents', true),
  ];

  static List<DocumentCategory> categories() {
    final now = DateTime.now();
    var i = 0;
    return [
      for (final (id, name, expiry) in categorySpecs)
        DocumentCategory(id: id, createdAt: now, updatedAt: now, name: name, sortOrder: i++, supportsExpiry: expiry),
    ];
  }

  static List<MessageTemplate> templates({String agent = 'Anjali'}) {
    final now = DateTime.now();
    var i = 0;
    MessageTemplate t(String name, String body, {bool isDefault = false}) =>
        MessageTemplate(id: newId(), createdAt: now, updatedAt: now, name: name, body: body, isDefault: isDefault, sortOrder: i++);
    return [
      t('Follow Up', 'Hello {CustomerName},\n\nJust following up regarding your {ProductName} application.\n\nThank you,\n$agent', isDefault: true),
      t('Documents Required', 'Hello {CustomerName},\n\nKindly share the required documents for your {ProductName} application.\n\nRegards,\n$agent'),
      t('Approved', 'Congratulations {CustomerName}.\n\nYour {ProductName} application has been approved.\n\nRegards,\n$agent'),
      t('Rejected', 'Hello {CustomerName},\n\nUnfortunately your application was not approved at this time.\n\nPlease contact me for alternative options.\n\nRegards,\n$agent'),
      t('General Greeting', 'Hello {CustomerName},\n\nHope you are doing well! This is $agent. Please let me know if I can help you with anything.\n\nRegards,\n$agent'),
    ];
  }
}
