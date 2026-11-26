import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

import 'crypto_utils.dart';
import 'secure_store.dart';

/// Escalating lockout after repeated failures (FR SEC-09).
/// 5 failures → 30 s, then each further round of 5 doubles, capped at 30 min.
abstract final class LockoutPolicy {
  static const maxAttempts = 5;
  static const base = Duration(seconds: 30);
  static const cap = Duration(minutes: 30);

  static Duration durationForLevel(int level) {
    final secs = base.inSeconds * (1 << level.clamp(0, 10));
    return Duration(seconds: secs.clamp(base.inSeconds, cap.inSeconds));
  }

  static int remaining(int failedAttempts) => (maxAttempts - failedAttempts).clamp(0, maxAttempts);
}

/// PIN, pattern, recovery-code and biometric authentication.
/// Hashing runs in a background isolate so the UI never janks.
class AuthService {
  AuthService(this._store, [LocalAuthentication? localAuth]) : _local = localAuth ?? LocalAuthentication();

  final SecureStore _store;
  final LocalAuthentication _local;

  static Future<String> _hash(String secret) => Isolate.run(() => CryptoUtils.hashSecret(secret));
  static Future<bool> _verify(String secret, String stored) => Isolate.run(() => CryptoUtils.verifySecret(secret, stored));

  // ── PIN ────────────────────────────────────────────────────────────────
  Future<bool> hasPin() async => (await _store.read(SecureStore.pinHash)) != null;

  Future<void> setPin(String pin) async => _store.write(SecureStore.pinHash, await _hash(pin));

  Future<bool> verifyPin(String pin) async {
    final stored = await _store.read(SecureStore.pinHash);
    return stored != null && await _verify(pin, stored);
  }

  // ── Pattern ────────────────────────────────────────────────────────────
  Future<bool> hasPattern() async => (await _store.read(SecureStore.patternHash)) != null;

  Future<void> setPattern(List<int> dots) async =>
      _store.write(SecureStore.patternHash, await _hash(CryptoUtils.patternToSecret(dots)));

  Future<void> clearPattern() => _store.delete(SecureStore.patternHash);

  Future<bool> verifyPattern(List<int> dots) async {
    final stored = await _store.read(SecureStore.patternHash);
    return stored != null && await _verify(CryptoUtils.patternToSecret(dots), stored);
  }

  // ── Recovery code ──────────────────────────────────────────────────────
  /// Generates a new recovery code, stores its hash and returns the clear
  /// code so it can be shown to the user exactly once.
  Future<String> rotateRecoveryCode() async {
    final code = CryptoUtils.recoveryCode();
    await _store.write(SecureStore.recoveryHash, await _hash(CryptoUtils.normaliseRecovery(code)));
    return code;
  }

  Future<bool> verifyRecovery(String input) async {
    final stored = await _store.read(SecureStore.recoveryHash);
    return stored != null && await _verify(CryptoUtils.normaliseRecovery(input), stored);
  }

  // ── Biometrics ─────────────────────────────────────────────────────────
  Future<bool> biometricAvailable() async {
    try {
      final supported = await _local.isDeviceSupported();
      final can = await _local.canCheckBiometrics;
      if (!supported || !can) return false;
      return (await _local.getAvailableBiometrics()).isNotEmpty;
    } on PlatformException {
      return false;
    }
  }

  Future<List<BiometricType>> availableBiometrics() async {
    try {
      return await _local.getAvailableBiometrics();
    } on PlatformException {
      return const [];
    }
  }

  Future<bool> authenticateBiometric({String reason = 'Unlock Anjali CRM AI'}) async {
    try {
      return await _local.authenticate(localizedReason: reason, biometricOnly: true, persistAcrossBackgrounding: true);
    } on PlatformException catch (e) {
      debugPrint('Biometric auth error: ${e.code}');
      return false;
    } on LocalAuthException catch (e) {
      debugPrint('Biometric auth error: $e');
      return false;
    }
  }
}
