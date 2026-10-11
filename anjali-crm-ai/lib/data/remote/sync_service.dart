import 'dart:async';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

import '../../core/config/firebase_config.dart';
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
        await storage.ref(remote).putFile(f);
        await repo.box.put(key, {...Map<String, dynamic>.from(m), 'remotePath': remote, 'dirty': true});
        uploaded++;
      }
    }
    return uploaded;
  }
}
