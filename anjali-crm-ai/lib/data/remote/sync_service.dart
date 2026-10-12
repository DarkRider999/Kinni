import 'dart:async';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

import '../../core/config/firebase_config.dart';
import '../../core/security/file_vault.dart';
import '../../core/services/file_storage_service.dart';
import '../../core/services/connectivity_service.dart';
import '../local/hive_repository.dart';
import '../local/hive_service.dart';
import '../local/settings_store.dart';

enum SyncStatus { notConfigured, disabled, offline, idle, syncing, error }

class SyncReport {
  const SyncReport({this.pushed = 0, this.pulled = 0, this.filesUploaded = 0, this.error});
  final int pushed;
  final int pulled;
  final int filesUploaded;
  final String? error;
  bool get ok => error == null;
}

/// Offline-first, last-write-wins sync with Firestore + Storage
/// (docs/02-system-architecture.md §4.3). Every method is safe to call when
/// offline or unconfigured: it simply returns.
class SyncService {
  SyncService({required this.repos, required this.settings});

  /// Box name → repository, for [HiveService.syncedBoxes].
  final Map<String, HiveRepository> repos;
  final SettingsStore settings;

  final status = ValueNotifier<SyncStatus>(SyncStatus.idle);
  Timer? _debounce;
  bool _running = false;

  bool get isConfigured => FirebaseConfig.isConfigured;

  /// Debounced sync after local writes.
  void requestSync() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(seconds: 5), () => syncNow());
  }

  Future<String?> _uid() async {
    final auth = FirebaseAuth.instance;
    if (auth.currentUser == null) await auth.signInAnonymously();
    return auth.currentUser?.uid;
  }

  Future<SyncReport> syncNow() async {
    if (!isConfigured) {
      status.value = SyncStatus.notConfigured;
      return const SyncReport(error: 'Cloud sync is not configured');
    }
    if (!settings.cloudSyncEnabled) {
      status.value = SyncStatus.disabled;
      return const SyncReport(error: 'Cloud sync is turned off');
    }
    if (!await Net.isOnline()) {
      status.value = SyncStatus.offline;
      return const SyncReport(error: 'Offline');
    }
    if (_running) return const SyncReport();
    _running = true;
    status.value = SyncStatus.syncing;
    try {
      if (!await FirebaseConfig.ensureInitialised()) throw StateError('Firebase failed to initialise');
      final uid = await _uid();
      if (uid == null) throw StateError('Anonymous sign-in failed');
      final db = FirebaseFirestore.instance;
      final userDoc = db.collection('users').doc(uid);

      final files = await _uploadFiles(uid);
      var pushed = 0;
      for (final name in HiveService.syncedBoxes) {
        pushed += await _push(userDoc.collection(name), repos[name]!);
      }
      final since = settings.lastPulledAt;
      var pulled = 0;
      DateTime? maxSeen = since;
      for (final name in HiveService.syncedBoxes) {
        final r = await _pull(userDoc.collection(name), repos[name]!, since);
        pulled += r.$1;
        if (r.$2 != null && (maxSeen == null || r.$2!.isAfter(maxSeen))) maxSeen = r.$2;
      }
      if (maxSeen != null) await settings.setLastPulledAt(maxSeen);
      await _downloadMissingFiles();
      await settings.setLastSyncAt(DateTime.now());
      status.value = SyncStatus.idle;
      return SyncReport(pushed: pushed, pulled: pulled, filesUploaded: files);
    } catch (e, st) {
      debugPrint('sync failed: $e\n$st');
      status.value = SyncStatus.error;
      return SyncReport(error: '$e');
    } finally {
      _running = false;
    }
  }

  Future<int> _push(CollectionReference<Map<String, dynamic>> col, HiveRepository repo) async {
    final dirty = repo.dirtyMaps();
    if (dirty.isEmpty) return 0;
    for (var i = 0; i < dirty.length; i += 400) {
      final chunk = dirty.sublist(i, (i + 400).clamp(0, dirty.length));
      final batch = col.firestore.batch();
      for (final m in chunk) {
        batch.set(col.doc('${m['id']}'), _forCloud(m), SetOptions(merge: true));
      }
      await batch.commit();
      await repo.markClean(chunk.map((m) => '${m['id']}'));
    }
    return dirty.length;
  }

  /// Local file paths are device specific; the cloud copy keeps them only
  /// as a hint. `remotePath` is the portable reference.
  Map<String, dynamic> _forCloud(Map<String, dynamic> m) => {...m}..remove('dirty');

  Future<(int, DateTime?)> _pull(CollectionReference<Map<String, dynamic>> col, HiveRepository repo, DateTime? since) async {
    Query<Map<String, dynamic>> q = col;
    if (since != null) q = q.where('updatedAt', isGreaterThan: since.toUtc().toIso8601String());
    final snap = await q.get();
    var applied = 0;
    DateTime? maxSeen;
    for (final doc in snap.docs) {
      final remote = doc.data();
      final rUpdated = DateTime.tryParse('${remote['updatedAt']}');
      if (rUpdated != null && (maxSeen == null || rUpdated.isAfter(maxSeen))) maxSeen = rUpdated;
      final local = repo.box.get(doc.id);
      if (local is Map) {
        final lUpdated = DateTime.tryParse('${local['updatedAt']}');
        if (local['dirty'] == true) continue; // local edit wins; pushed next round
        if (lUpdated != null && rUpdated != null && !rUpdated.isAfter(lUpdated)) continue;
        // Keep a valid local file path when the remote copy came from another device.
        for (final k in const ['filePath', 'photoPath']) {
          final lp = local[k];
          if (lp is String && lp.isNotEmpty && File(lp).existsSync()) remote[k] = lp;
        }
      }
      await repo.putRaw({...remote, 'id': doc.id});
      applied++;
    }
    return (applied, maxSeen);
  }

  /// Uploads attachments that have a local file but no `remotePath` yet.
  Future<int> _uploadFiles(String uid) async {
    final storage = FirebaseStorage.instance;
    var uploaded = 0;
    for (final name in [HiveService.documents, HiveService.voiceNotes]) {
      final repo = repos[name]!;
      for (final key in repo.box.keys.toList()) {
        final m = repo.box.get(key);
        if (m is! Map || m['deleted'] == true) continue;
        final path = m['filePath'];
        if (path is! String || path.isEmpty || (m['remotePath'] is String && (m['remotePath'] as String).isNotEmpty)) continue;
        final f = File(path);
        if (!f.existsSync()) continue;
        final remote = 'users/$uid/files/${m['clientId']}/${p.basename(path)}';
        if (m['encrypted'] == true) {
          // Vault files are encrypted with this phone's key, which no other
          // phone has. Upload the plain bytes (Storage is private to this
          // user and encrypted at rest by Firebase); every phone re-encrypts
          // with its own key on download. Skipped while the vault is locked.
          if (!FileVault.instance.isUnlocked) continue;
          await storage.ref(remote).putData(await FileVault.instance.decryptBytes(await f.readAsBytes()));
        } else {
          await storage.ref(remote).putFile(f);
        }
        await repo.box.put(key, {...Map<String, dynamic>.from(m), 'remotePath': remote, 'dirty': true});
        uploaded++;
      }
    }
    return uploaded;
  }

  /// Largest attachment fetched automatically (bytes).
  static const _maxDownload = 40 * 1024 * 1024;

  /// Fetches attachments synced from another phone (or before a reinstall)
  /// so they open offline here. Vault files are re-encrypted with this
  /// phone's key; they wait for the next sync while the vault is locked.
  /// A failed file is skipped and retried on the next sync.
  Future<int> _downloadMissingFiles() async {
    final storage = FirebaseStorage.instance;
    final root = (await FileStore.root()).path;
    var downloaded = 0;
    for (final name in [HiveService.documents, HiveService.voiceNotes]) {
      final repo = repos[name]!;
      for (final key in repo.box.keys.toList()) {
        final m = repo.box.get(key);
        if (m is! Map || m['deleted'] == true) continue;
        final remote = m['remotePath'];
        if (remote is! String || remote.isEmpty) continue;
        final local = m['filePath'];
        if (local is String && local.isNotEmpty && File(local).existsSync()) continue;
        final encrypted = m['encrypted'] == true;
        if (encrypted && !FileVault.instance.isUnlocked) continue;
        try {
          final data = await storage.ref(remote).getData(_maxDownload);
          if (data == null) continue;
          final folder = name == HiveService.documents ? 'vault' : 'voice';
          final dest = File(p.join(root, 'files', '${m['clientId']}', folder, p.basename(remote)));
          await dest.parent.create(recursive: true);
          await dest.writeAsBytes(encrypted ? await FileVault.instance.encryptBytes(data) : data, flush: true);
          await repo.box.put(key, {...Map<String, dynamic>.from(m), 'filePath': dest.path});
          downloaded++;
        } on FirebaseException catch (e) {
          debugPrint('download $remote failed: ${e.code}');
        } on FileSystemException catch (e) {
          debugPrint('could not save $remote: $e');
        }
      }
    }
    return downloaded;
  }
}
