import 'dart:io';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// AES-256-GCM encryption for document files at rest.
///
/// The key is the vault key, held in memory only while the vault is open
/// (set on unlock, cleared on lock), so documents are readable only after
/// login. File layout: 12-byte nonce · ciphertext · 16-byte MAC.
class FileVault {
  FileVault._();
  static final FileVault instance = FileVault._();

  final _algo = AesGcm.with256bits();
  SecretKey? _key;

  bool get isUnlocked => _key != null;

  void unlock(List<int> key) => _key = SecretKey(List<int>.from(key));
  void lock() => _key = null;

  SecretKey get _k {
    final k = _key;
    if (k == null) throw StateError('Document vault is locked');
    return k;
  }

  Future<Uint8List> encryptBytes(List<int> clear) async {
    final box = await _algo.encrypt(clear, secretKey: _k);
    return box.concatenation();
  }

  Future<Uint8List> decryptBytes(List<int> cipher) async {
    final box = SecretBox.fromConcatenation(cipher, nonceLength: 12, macLength: 16);
    return Uint8List.fromList(await _algo.decrypt(box, secretKey: _k));
  }

  /// Encrypts [sourcePath] into [destPath].
  Future<void> encryptFile(String sourcePath, String destPath) async {
    final bytes = await File(sourcePath).readAsBytes();
    await File(destPath).writeAsBytes(await encryptBytes(bytes), flush: true);
  }

  Future<Uint8List> readFile(String path, {required bool encrypted}) async {
    final raw = await File(path).readAsBytes();
    return encrypted ? decryptBytes(raw) : raw;
  }

  /// Writes a decrypted copy to the cache for sharing / saving, named
  /// [fileName]. Cleared by [purgeTemp] on every unlock.
  Future<File> exportTemp(String path, {required bool encrypted, required String fileName}) async {
    final dir = Directory(p.join((await getTemporaryDirectory()).path, 'vault_share'));
    await dir.create(recursive: true);
    final out = File(p.join(dir.path, fileName));
    await out.writeAsBytes(await readFile(path, encrypted: encrypted), flush: true);
    return out;
  }

  /// Deletes decrypted temp copies.
  Future<void> purgeTemp() async {
    try {
      final dir = Directory(p.join((await getTemporaryDirectory()).path, 'vault_share'));
      if (await dir.exists()) await dir.delete(recursive: true);
    } catch (_) {
      // Best effort: temp cleanup must never block unlocking.
    }
  }
}
