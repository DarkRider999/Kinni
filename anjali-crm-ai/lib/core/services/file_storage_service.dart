import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../utils/id.dart';

/// App-private file storage: `files/{clientId}/…`, `exports/`, `backups/`.
abstract final class FileStore {
  static Future<Directory> _dir(String sub) async {
    final root = await getApplicationDocumentsDirectory();
    final d = Directory(p.join(root.path, sub));
    if (!await d.exists()) await d.create(recursive: true);
    return d;
  }

  static Future<Directory> root() => getApplicationDocumentsDirectory();
  static Future<Directory> clientDir(String clientId) => _dir(p.join('files', clientId));
  /// Encrypted per-client document vault: files/{clientId}/vault/.
  static Future<Directory> vaultDir(String clientId) => _dir(p.join('files', clientId, 'vault'));
  static Future<Directory> exportsDir() => _dir('exports');
  static Future<Directory> backupsDir() => _dir('backups');
  static Future<Directory> profileDir() => _dir('profile');

  /// Copies [source] into the client's folder with a unique name.
  static Future<String> importForClient(String clientId, String sourcePath, {String? prefix}) async {
    final dir = await clientDir(clientId);
    final ext = p.extension(sourcePath).isEmpty ? '.jpg' : p.extension(sourcePath);
    final dest = p.join(dir.path, '${prefix ?? 'file'}_${newId().substring(0, 8)}$ext');
    await File(sourcePath).copy(dest);
    return dest;
  }

  static Future<String> newClientFilePath(String clientId, String prefix, String ext) async {
    final dir = await clientDir(clientId);
    return p.join(dir.path, '${prefix}_${DateTime.now().millisecondsSinceEpoch}$ext');
  }

  static Future<void> deleteQuietly(String? path) async {
    if (path == null) return;
    try {
      final f = File(path);
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }

  static Future<void> deleteClientFiles(String clientId) async {
    final d = await clientDir(clientId);
    if (await d.exists()) await d.delete(recursive: true);
  }

  static String extensionForMime(String? mime) => switch (mime) {
        'application/pdf' => '.pdf',
        'image/png' => '.png',
        'image/webp' => '.webp',
        'image/heic' => '.heic',
        'image/jpeg' => '.jpg',
        _ => '',
      };

  static String mimeFor(String path) {
    final e = p.extension(path).toLowerCase();
    return switch (e) {
      '.pdf' => 'application/pdf',
      '.png' => 'image/png',
      '.jpg' || '.jpeg' => 'image/jpeg',
      '.webp' => 'image/webp',
      '.heic' => 'image/heic',
      '.m4a' => 'audio/mp4',
      '.xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip' => 'application/zip',
      _ => 'application/octet-stream',
    };
  }
}
