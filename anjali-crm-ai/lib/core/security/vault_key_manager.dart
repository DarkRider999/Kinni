import 'dart:convert';

import 'crypto_utils.dart';
import 'secure_store.dart';

/// Creates (once) and loads the 256-bit AES key that encrypts every Hive box.
/// The key lives only in Android Keystore-backed secure storage.
class VaultKeyManager {
  VaultKeyManager(this._store);
  final SecureStore _store;

  Future<bool> hasKey() async => (await _store.read(SecureStore.vaultKey)) != null;

  Future<List<int>> loadOrCreateKey() async {
    final existing = await _store.read(SecureStore.vaultKey);
    if (existing != null) return base64Decode(existing);
    final key = CryptoUtils.randomBytes(32);
    await _store.write(SecureStore.vaultKey, base64Encode(key));
    return key;
  }
}
