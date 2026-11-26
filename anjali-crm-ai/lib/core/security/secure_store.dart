import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keystore-backed secret storage (vault key, PIN/pattern/recovery hashes).
class SecureStore {
  SecureStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;

  static const vaultKey = 'vault_key_v1';
  static const pinHash = 'pin_hash_v1';
  static const patternHash = 'pattern_hash_v1';
  static const recoveryHash = 'recovery_hash_v1';

  Future<String?> read(String key) => _s.read(key: key);
  Future<void> write(String key, String value) => _s.write(key: key, value: value);
  Future<void> delete(String key) => _s.delete(key: key);
}
