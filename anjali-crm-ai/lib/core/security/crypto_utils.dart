import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// PBKDF2-HMAC-SHA256 and helpers for hashing PINs, patterns and the
/// recovery code. Secrets are never stored in clear text.
abstract final class CryptoUtils {
  static const iterations = 120000;
  static const keyLength = 32;

  static final _rng = Random.secure();

  static Uint8List randomBytes(int n) => Uint8List.fromList(List<int>.generate(n, (_) => _rng.nextInt(256)));

  static String randomSaltB64() => base64Encode(randomBytes(16));

  /// RFC 8018 PBKDF2 with HMAC-SHA256.
  static Uint8List pbkdf2(List<int> password, List<int> salt, {int iterations = iterations, int length = keyLength}) {
    final hmac = Hmac(sha256, password);
    final blocks = (length / 32).ceil();
    final out = BytesBuilder();
    for (var i = 1; i <= blocks; i++) {
      final block = Uint8List(4)..buffer.asByteData().setUint32(0, i);
      var u = hmac.convert([...salt, ...block]).bytes;
      final t = Uint8List.fromList(u);
      for (var j = 1; j < iterations; j++) {
        u = hmac.convert(u).bytes;
        for (var k = 0; k < t.length; k++) {
          t[k] ^= u[k];
        }
      }
      out.add(t);
    }
    return Uint8List.fromList(out.toBytes().sublist(0, length));
  }

  /// Returns "iterations$saltB64$hashB64".
  static String hashSecret(String secret, {String? saltB64, int iterations = iterations}) {
    final salt = saltB64 ?? randomSaltB64();
    final h = pbkdf2(utf8.encode(secret), base64Decode(salt), iterations: iterations);
    return '$iterations\$$salt\$${base64Encode(h)}';
  }

  static bool verifySecret(String secret, String stored) {
    final parts = stored.split(r'$');
    if (parts.length != 3) return false;
    final it = int.tryParse(parts[0]) ?? iterations;
    final h = pbkdf2(utf8.encode(secret), base64Decode(parts[1]), iterations: it);
    return constantTimeEquals(h, base64Decode(parts[2]));
  }

  static bool constantTimeEquals(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) {
      r |= a[i] ^ b[i];
    }
    return r == 0;
  }

  /// Human-friendly recovery code, e.g. "K7QM-2XRP-H9TD" (no 0/O/1/I).
  static String recoveryCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final chars = List.generate(12, (_) => alphabet[_rng.nextInt(alphabet.length)]).join();
    return '${chars.substring(0, 4)}-${chars.substring(4, 8)}-${chars.substring(8)}';
  }

  static String normaliseRecovery(String input) => input.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

  /// Pattern (list of dot indexes 0..8) to a hashable string.
  static String patternToSecret(List<int> dots) => 'pattern:${dots.join('-')}';
}
