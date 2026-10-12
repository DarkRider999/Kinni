import 'dart:convert';

import 'package:anjali_crm_ai/core/security/auth_service.dart';
import 'package:anjali_crm_ai/core/security/crypto_utils.dart';
import 'package:anjali_crm_ai/core/utils/validators.dart';
import 'package:flutter_test/flutter_test.dart';

String hex(List<int> b) => b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();

void main() {
  test('PBKDF2-HMAC-SHA256 matches the RFC 7914 test vector', () {
    final out = CryptoUtils.pbkdf2(utf8.encode('passwd'), utf8.encode('salt'), iterations: 1, length: 64);
    expect(hex(out),
        '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783');
  });

  test('hash/verify round trip with a random salt; wrong secret fails', () {
    final stored = CryptoUtils.hashSecret('482916', iterations: 1000);
    expect(CryptoUtils.verifySecret('482916', stored), isTrue);
    expect(CryptoUtils.verifySecret('482917', stored), isFalse);
    expect(CryptoUtils.hashSecret('482916', iterations: 1000), isNot(stored), reason: 'salted');
  });

  test('recovery code is 12 unambiguous chars and normalises', () {
    final code = CryptoUtils.recoveryCode();
    expect(RegExp(r'^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$').hasMatch(code), isTrue);
    expect(CryptoUtils.normaliseRecovery(code.toLowerCase().replaceAll('-', ' ')), code.replaceAll('-', ''));
  });

  test('lockout doubles from 30 s and caps at 30 min', () {
    expect(LockoutPolicy.durationForLevel(0), const Duration(seconds: 30));
    expect(LockoutPolicy.durationForLevel(1), const Duration(minutes: 1));
    expect(LockoutPolicy.durationForLevel(3), const Duration(minutes: 4));
    expect(LockoutPolicy.durationForLevel(20), const Duration(minutes: 30));
    expect(LockoutPolicy.remaining(3), 2);
  });

  test('PIN policy rejects weak PINs', () {
    expect(Validators.pin('111111'), isNotNull);
    expect(Validators.pin('123456'), isNotNull);
    expect(Validators.pin('12a456'), isNotNull);
    expect(Validators.pin('482916'), isNull);
  });
}
