import 'package:anjali_crm_ai/data/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('required rejects blank and whitespace', () {
    expect(Validators.required(null, 'Name'), 'Name is required');
    expect(Validators.required('   ', 'Name'), 'Name is required');
    expect(Validators.required('Anjali', 'Name'), isNull);
  });

  test('email is optional but must be well formed when given', () {
    expect(Validators.email(''), isNull);
    expect(Validators.email(' anjali@example.com '), isNull);
    for (final bad in ['anjali', 'anjali@', '@example.com', 'a b@example.com', 'anjali@example']) {
      expect(Validators.email(bad), isNotNull, reason: bad);
    }
  });

  test('phone is optional and allows common formats with 7-15 digits', () {
    expect(Validators.phone(''), isNull);
    for (final ok in ['+971 50 123 4567', '(04) 123-4567', '0501234567']) {
      expect(Validators.phone(ok), isNull, reason: ok);
    }
    expect(Validators.phone('12345'), isNotNull);
    expect(Validators.phone('+1234567890123456'), isNotNull);
    expect(Validators.phone('050-ABC-1234'), isNotNull);
    expect(Validators.phone('971+50'), isNotNull);
  });
}
