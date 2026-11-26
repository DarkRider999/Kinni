import 'package:anjali_crm_ai/core/security/file_vault.dart';
import 'package:anjali_crm_ai/data/repositories/repositories.dart';
import 'package:anjali_crm_ai/domain/entities/client_document.dart';
import 'package:anjali_crm_ai/domain/entities/document_category.dart';
import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:anjali_crm_ai/domain/entities/product.dart';
import 'package:anjali_crm_ai/domain/services/document_checklist.dart';
import 'package:anjali_crm_ai/domain/services/document_text_parser.dart';
import 'package:anjali_crm_ai/domain/services/duplicate_detector.dart';
import 'package:anjali_crm_ai/domain/services/template_renderer.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

ClientDocument doc(String cat, DocumentStatus status, {DateTime? expiry}) =>
    ClientDocument(id: '$cat-$status', createdAt: t0, updatedAt: t0, clientId: 'c1', categoryId: cat, status: status, expiryDate: expiry);

void main() {
  group('TemplateRenderer', () {
    test('fills every supported tag from the client', () {
      final c = client(name: 'Fatima Khan', phone: '0501234567', location: 'Dubai Marina', salary: 15000, status: LeadStatus.interested);
      final out = TemplateRenderer.render(
        'Hi {CustomerName}, your {ProductName} ({Status}) · {Phone} · {Location} · {Salary}',
        TemplateRenderer.valuesFor(c, productName: 'Personal Loan'),
      );
      expect(out, contains('Hi Fatima Khan'));
      expect(out, contains('Personal Loan (Interested)'));
      expect(out, contains('0501234567'));
      expect(out, contains('Dubai Marina'));
      expect(out, contains('15,000'));
    });

    test('leaves unknown tags visible and tidies empty ones', () {
      final out = TemplateRenderer.render('Hello {CustomerName} {Typo} on {FollowupDate} .', {'CustomerName': 'Ali', 'FollowupDate': ''});
      expect(out, 'Hello Ali {Typo} on.');
    });
  });

  group('Salary range search', () {
    test('parses k ranges, plain ranges and open ranges', () {
      final r = SalaryRange.tryParse('10k-20k')!;
      expect([r.min, r.max], [10000, 20000]);
      expect(SalaryRange.tryParse('20000 to 8000')!.min, 8000);
      expect(SalaryRange.tryParse('>15k')!.contains(1e9), isTrue);
      expect(SalaryRange.tryParse('15k+')!.contains(14999), isFalse);
      expect(SalaryRange.tryParse('<8000')!.contains(8000), isTrue);
    });

    test('ignores ordinary text and phone numbers', () {
      expect(SalaryRange.tryParse('fatima'), isNull);
      expect(SalaryRange.tryParse('0501234567'), isNull);
    });
  });

  group('DocumentChecklist', () {
    test('uses the product checklist and reports completion', () {
      final p = Product(id: 'p1', createdAt: t0, updatedAt: t0, name: 'Credit Card', requiredCategoryIds: const [DocumentCategory.passport, DocumentCategory.visa]);
      final list = DocumentChecklist.build(p, [doc(DocumentCategory.passport, DocumentStatus.verified), doc(DocumentCategory.visa, DocumentStatus.requested)]);
      expect(list.items, hasLength(2));
      expect(list.completion, .5);
      expect(list.isComplete, isFalse);
      expect(list.missing, 1);
      expect(list.items.where((i) => !i.done).map((i) => i.categoryId), [DocumentCategory.visa]);
    });

    test('falls back to the default list without a product', () {
      final list = DocumentChecklist.build(null, const []);
      expect(list.items.map((i) => i.categoryId), DocumentChecklist.fallbackRequired);
      expect(list.completion, 0);
    });

    test('expiry helpers flag expired and soon-expiring documents', () {
      final now = DateTime(2026, 10, 12);
      final soon = doc(DocumentCategory.visa, DocumentStatus.verified, expiry: now.add(const Duration(days: 10)));
      final gone = doc(DocumentCategory.passport, DocumentStatus.verified, expiry: now.subtract(const Duration(days: 1)));
      expect(DocumentExpiry.isExpired(gone, now), isTrue);
      expect(DocumentExpiry.isExpired(soon, now), isFalse);
      expect(DocumentExpiry.expiringSoon([soon], now), [soon]);
      expect(DocumentExpiry.reminderDays, [30, 15, 7, 1]);
    });
  });

  group('DocumentTextParser', () {
    test('reads Emirates ID number and name', () {
      final d = DocumentTextParser.parse('UNITED ARAB EMIRATES\nName: Fatima Khan\nID Number 784-1990-1234567-1');
      expect(d.idNumber, '784-1990-1234567-1');
      expect(d.name, 'Fatima Khan');
    });

    test('reads passport number from the MRZ', () {
      const mrz = 'P<INDKHAN<<FATIMA<<<<<<<<<<<<<<<<<<<<<<<<<<<\nZ1234567<8IND9001015F3001012<<<<<<<<<<<<<<02';
      final d = DocumentTextParser.parse(mrz);
      expect(d.passportNumber, 'Z1234567');
      expect(d.name, isNotNull);
    });

    test('reads salary and keeps the full text', () {
      final d = DocumentTextParser.parse('Salary Certificate\nMonthly salary: AED 15,500');
      expect(d.salary, contains('15,500'));
      expect(d.fullText, contains('Salary Certificate'));
    });
  });

  group('DuplicateDetector', () {
    test('matches on WhatsApp number', () {
      final existing = client(id: 'a', phone: '0509999999', whatsapp: '0551112222');
      final m = DuplicateDetector.find(client(id: 'b', name: 'Other', phone: '0401234567', whatsapp: '055 111 2222'), [existing]);
      expect(m?.reason, DuplicateReason.whatsapp);
    });

    test('matches same name with a near-identical phone', () {
      final existing = client(id: 'a', name: 'Fatima Khan', phone: '0501234567');
      final m = DuplicateDetector.find(client(id: 'b', name: '  fatima   khan ', phone: '0501234999'), [existing]);
      expect(m?.reason, DuplicateReason.nameAndPhone);
    });

    test('different name and phone is not a duplicate', () {
      expect(DuplicateDetector.find(client(id: 'b', name: 'Ali', phone: '0561230000'), [client(id: 'a')]), isNull);
    });
  });

  group('FileVault', () {
    test('AES-GCM round trip, and refuses to work while locked', () async {
      final v = FileVault.instance..unlock(List<int>.generate(32, (i) => i));
      final clear = 'passport scan bytes'.codeUnits;
      final cipher = await v.encryptBytes(clear);
      expect(cipher.length, clear.length + 28);
      expect(await v.decryptBytes(cipher), clear);
      v.unlock(List<int>.generate(32, (i) => 255 - i));
      await expectLater(v.decryptBytes(cipher), throwsA(anything));
      v.lock();
      expect(() => v.encryptBytes(clear), throwsStateError);
    });
  });
}
