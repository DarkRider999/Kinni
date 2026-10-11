import 'package:anjali_crm_ai/core/utils/phone_utils.dart';
import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:anjali_crm_ai/domain/services/duplicate_detector.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  group('PhoneUtils', () {
    test('same UAE mobile in every common notation has one key', () {
      const forms = ['0501234567', '+971 50 123 4567', '00971501234567', '971-50-1234567', '50 123 4567'];
      expect(forms.map(PhoneUtils.key).toSet(), {'501234567'});
    });

    test('international() adds the UAE code to local numbers only', () {
      expect(PhoneUtils.international('050 123 4567'), '971501234567');
      expect(PhoneUtils.international('+44 7700 900123'), '447700900123');
      expect(PhoneUtils.international('0044 7700 900123'), '447700900123');
      expect(PhoneUtils.dialable('0501234567'), '+971501234567');
    });

    test('validates length', () {
      expect(PhoneUtils.isValid('12345'), isFalse);
      expect(PhoneUtils.isValid('+971501234567'), isTrue);
    });
  });

  group('DuplicateDetector', () {
    final existing = [client(id: 'a', name: 'Ahmed', phone: '+971 55 765 4321', email: 'Ahmed@Example.com')];

    test('matches by phone across formats', () {
      final m = DuplicateDetector.find(client(id: 'n', name: 'New', phone: '0557654321'), existing);
      expect(m?.existing.id, 'a');
      expect(m?.reason, DuplicateReason.phone);
    });

    test('matches by email case-insensitively', () {
      final m = DuplicateDetector.find(client(id: 'n', phone: '0500000000', email: ' ahmed@example.com '), existing);
      expect(m?.reason, DuplicateReason.email);
    });

    test('ignores itself and deleted records', () {
      expect(DuplicateDetector.find(existing.first, existing), isNull);
      final deleted = [client(id: 'a', phone: '0557654321', deleted: true)];
      expect(DuplicateDetector.find(client(id: 'n', phone: '0557654321'), deleted), isNull);
    });

    test('merge keeps primary values, fills gaps, keeps the most advanced status', () {
      final primary = client(id: 'p', name: 'Primary', email: null, status: LeadStatus.interested, rating: 2);
      final other = client(id: 'o', name: 'Other', email: 'x@y.com', status: LeadStatus.applicationSubmitted, rating: 4, salary: 9000);
      final m = DuplicateDetector.merge(primary, other);
      expect(m.id, 'p');
      expect(m.name, 'Primary');
      expect(m.email, 'x@y.com');
      expect(m.monthlySalary, 9000);
      expect(m.status, LeadStatus.applicationSubmitted);
      expect(m.rating, 4);
    });
  });
}
