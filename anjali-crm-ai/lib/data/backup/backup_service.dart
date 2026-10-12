import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:path/path.dart' as p;

import '../../core/security/file_vault.dart';
import '../../core/services/file_storage_service.dart';
import '../../core/utils/formatters.dart';
import '../local/hive_repository.dart';
import '../local/hive_service.dart';
import '../local/settings_store.dart';

/// Readable backup/restore failure (wraps file-system errors).
class BackupException implements Exception {
  const BackupException(this.message, [this.cause]);
  final String message;
  final Object? cause;
  @override
  String toString() => message;
}

/// Local ZIP backups: `manifest.json`, one JSON file per box, the settings,
/// and every attachment under `files/` (FR BAK-01/02).
///
/// Vault documents (`*.enc`) are stored decrypted inside the backup when
/// the vault is open, and re-encrypted with this device's key on restore.
/// That keeps a backup restorable after a reinstall or on a new phone,
/// where the old device key no longer exists. A file that could not be
/// decrypted (vault locked during a background backup) is listed under
/// `stillEncrypted` and restored as-is.
class BackupService {
  BackupService({required this.repos, required this.settings});

  final Map<String, HiveRepository> repos;
  final SettingsStore settings;

  static const keepAutomatic = 7;
  static const format = 'anjali-crm-backup';
  static const formatVersion = 2;

  Future<List<File>> listBackups() async {
    final dir = await FileStore.backupsDir();
    final files = dir.listSync().whereType<File>().where((f) => f.path.endsWith('.zip')).toList()
      ..sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
    return files;
  }

  /// Creates a backup. Automatic backups rotate to the newest [keepAutomatic].
  Future<File> createBackup({bool automatic = false}) async {
    final archive = Archive();
    final counts = <String, int>{};
    for (final name in HiveService.syncedBoxes) {
      final repo = repos[name]!;
      final records = [for (final v in repo.box.values) if (v is Map) Map<String, dynamic>.from(v)];
      counts[name] = records.length;
      final bytes = utf8.encode(jsonEncode(records));
      archive.addFile(ArchiveFile('data/$name.json', bytes.length, bytes));
    }
    final settingsBox = settings.settings;
    if (settingsBox != null) {
      final map = {for (final k in settingsBox.keys) '$k': settingsBox.get(k)};
      final bytes = utf8.encode(jsonEncode(map, toEncodable: (o) => o.toString()));
      archive.addFile(ArchiveFile('data/settings.json', bytes.length, bytes));
    }
    final root = (await FileStore.root()).path;
    final filesDir = Directory(p.join(root, 'files'));
    var fileCount = 0;
    final stillEncrypted = <String>[];
    if (filesDir.existsSync()) {
      try {
      for (final f in filesDir.listSync(recursive: true).whereType<File>()) {
        final rel = p.posix.joinAll(p.split(p.relative(f.path, from: root)));
        var bytes = await f.readAsBytes();
        if (rel.endsWith('.enc')) {
          if (FileVault.instance.isUnlocked) {
            try {
              bytes = await FileVault.instance.decryptBytes(bytes);
            } catch (_) {
              stillEncrypted.add(rel);
            }
          } else {
            stillEncrypted.add(rel);
          }
        }
        archive.addFile(ArchiveFile(rel, bytes.length, bytes));
        fileCount++;
      }
      } on FileSystemException catch (e) {
        throw BackupException('Could not read an attachment for the backup', e);
      }
    }
    final profile = settings.profile;
    final manifest = utf8.encode(jsonEncode({
      'format': format,
      'version': formatVersion,
      'schemaVersion': HiveService.schemaVersion,
      'createdAt': DateTime.now().toIso8601String(),
      'automatic': automatic,
      'owner': profile.name,
      'counts': counts,
      'files': fileCount,
      'stillEncrypted': stillEncrypted,
    }));
    archive.addFile(ArchiveFile('manifest.json', manifest.length, manifest));

    final zip = ZipEncoder().encode(archive);
    if (zip == null) throw StateError('Could not create the backup archive');
    final dir = await FileStore.backupsDir();
    final name = 'anjali_crm_${automatic ? 'auto' : 'manual'}_${Fmt.fileStamp(DateTime.now())}.zip';
    final out = File(p.join(dir.path, name));
    try {
      await out.writeAsBytes(zip, flush: true);
    } on FileSystemException catch (e) {
      throw BackupException('Could not write the backup file (is storage full?)', e);
    }
    await settings.setLastBackupAt(DateTime.now());
    if (automatic) await _rotate();
    return out;
  }

  Future<void> _rotate() async {
    final autos = (await listBackups()).where((f) => p.basename(f.path).contains('_auto_')).toList();
    for (final f in autos.skip(keepAutomatic)) {
      await f.delete();
    }
  }

  /// Reads and validates the manifest without changing anything.
  Future<Map<String, dynamic>> inspect(File zip) async {
    final Archive archive;
    try {
      archive = ZipDecoder().decodeBytes(await zip.readAsBytes());
    } catch (e) {
      throw BackupException('This file is not a readable backup', e);
    }
    final mf = archive.findFile('manifest.json');
    if (mf == null) throw const FormatException('Not an Anjali CRM backup (manifest missing)');
    final manifest = jsonDecode(utf8.decode(mf.content as List<int>)) as Map<String, dynamic>;
    if (manifest['format'] != format) throw const FormatException('Unrecognised backup format');
    if ((manifest['version'] as int? ?? 0) > formatVersion) {
      throw const FormatException('This backup was made by a newer app version. Please update the app first.');
    }
    return manifest;
  }

  /// Replaces all CRM data with the backup contents. File paths inside the
  /// records are rewritten to this device's documents folder.
  Future<Map<String, int>> restore(File zip) async {
    final manifest = await inspect(zip);
    // v1 backups copied vault files still encrypted with the old device key.
    final version = manifest['version'] as int? ?? 1;
    final keepAsIs = {...((manifest['stillEncrypted'] as List?) ?? const []).cast<String>()};
    final archive = ZipDecoder().decodeBytes(await zip.readAsBytes());
    final root = (await FileStore.root()).path;
    final oldRootPattern = RegExp(r'^.*?/files/');

    try {
      for (final f in archive.files.where((f) => f.isFile && f.name.startsWith('files/'))) {
        final dest = File(p.join(root, f.name));
        await dest.parent.create(recursive: true);
        var bytes = f.content as List<int>;
        if (version >= 2 && f.name.endsWith('.enc') && !keepAsIs.contains(f.name)) {
          bytes = await FileVault.instance.encryptBytes(bytes);
        }
        await dest.writeAsBytes(bytes, flush: true);
      }
    } on FileSystemException catch (e) {
      throw BackupException('Could not restore attachments (is storage full?)', e);
    } on StateError catch (e) {
      throw BackupException('Unlock the app before restoring a backup', e);
    }
    final settingsEntry = archive.findFile('data/settings.json');
    final settingsBox = settings.settings;
    if (settingsEntry != null && settingsBox != null) {
      try {
        final map = jsonDecode(utf8.decode(settingsEntry.content as List<int>)) as Map<String, dynamic>;
        await settingsBox.putAll(map);
      } on FormatException catch (e) {
        throw BackupException('The settings in this backup are damaged', e);
      }
    }

    final restored = <String, int>{};
    for (final name in HiveService.syncedBoxes) {
      final entry = archive.findFile('data/$name.json');
      final repo = repos[name]!;
      await repo.clear();
      if (entry == null) continue;
      final list = jsonDecode(utf8.decode(entry.content as List<int>)) as List;
      final map = <String, dynamic>{};
      for (final raw in list.cast<Map>()) {
        final m = Map<String, dynamic>.from(raw);
        for (final k in const ['filePath', 'photoPath']) {
          final v = m[k];
          if (v is String && v.contains('/files/')) m[k] = p.join(root, 'files', v.replaceFirst(oldRootPattern, ''));
        }
        // Restored data must be re-pushed so the cloud matches.
        map['${m['id']}'] = {...m, 'dirty': true};
      }
      await repo.box.putAll(map);
      restored[name] = map.length;
    }
    return restored;
  }
}
