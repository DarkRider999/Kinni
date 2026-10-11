import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce/hive_ce.dart';

import '../core/security/auth_service.dart';
import '../core/security/secure_store.dart';
import '../core/security/vault_key_manager.dart';
import '../data/backup/backup_service.dart';
import '../data/local/hive_repository.dart';
import '../data/local/hive_service.dart';
import '../data/local/settings_store.dart';
import '../data/remote/sync_service.dart';
import '../data/repositories/repositories.dart';
import '../domain/entities/activity.dart';
import '../domain/entities/call_log.dart';
import '../domain/entities/client.dart';
import '../domain/entities/client_document.dart';
import '../domain/entities/enums.dart';
import '../domain/entities/followup.dart';
import '../domain/entities/product.dart';
import '../domain/entities/security_event.dart';
import '../domain/entities/user_profile.dart';
import '../domain/entities/voice_note.dart';
import '../domain/services/insights_engine.dart';
import '../domain/services/productivity_calculator.dart';
import '../domain/services/report_engine.dart';

// ── Infrastructure ──────────────────────────────────────────────────────────

/// The plain `prefs` box; overridden in `main()` after it is opened.
final prefsBoxProvider = Provider<Box>((ref) => throw UnimplementedError('prefsBoxProvider must be overridden'));

final secureStoreProvider = Provider<SecureStore>((ref) => SecureStore());
final authServiceProvider = Provider<AuthService>((ref) => AuthService(ref.watch(secureStoreProvider)));
final vaultKeyManagerProvider = Provider<VaultKeyManager>((ref) => VaultKeyManager(ref.watch(secureStoreProvider)));

/// Whether the encrypted vault (all CRM boxes) is open.
class VaultController extends Notifier<bool> {
  @override
  bool build() => HiveService.instance.isVaultOpen;

  Future<void> open() async {
    final key = await ref.read(vaultKeyManagerProvider).loadOrCreateKey();
    await HiveService.instance.openVault(key);
    state = true;
  }

  Future<void> close() async {
    state = false;
    await HiveService.instance.closeVault();
  }
}

final vaultProvider = NotifierProvider<VaultController, bool>(VaultController.new);

final settingsStoreProvider = Provider<SettingsStore>((ref) {
  final open = ref.watch(vaultProvider);
  return SettingsStore(ref.watch(prefsBoxProvider), open ? HiveService.instance.box(HiveService.settings) : null);
});

// ── Repositories (rebuilt whenever the vault opens) ─────────────────────────

Box _box(Ref ref, String name) {
  if (!ref.watch(vaultProvider)) throw StateError('Vault is locked');
  return HiveService.instance.box(name);
}

final clientRepoProvider = Provider<ClientRepository>((ref) => HiveRepository(_box(ref, HiveService.clients), Client.fromMap));
final productRepoProvider = Provider<ProductRepository>((ref) => HiveRepository(_box(ref, HiveService.products), Product.fromMap));
final followupRepoProvider = Provider<FollowupRepository>((ref) => HiveRepository(_box(ref, HiveService.followups), Followup.fromMap));
final callLogRepoProvider = Provider<CallLogRepository>((ref) => HiveRepository(_box(ref, HiveService.callLogs), CallLog.fromMap));
final voiceNoteRepoProvider = Provider<VoiceNoteRepository>((ref) => HiveRepository(_box(ref, HiveService.voiceNotes), VoiceNote.fromMap));
final documentRepoProvider = Provider<DocumentRepository>((ref) => HiveRepository(_box(ref, HiveService.documents), ClientDocument.fromMap));
final activityRepoProvider = Provider<ActivityRepository>((ref) => HiveRepository(_box(ref, HiveService.activities), Activity.fromMap));
final securityLogRepoProvider =
    Provider<SecurityLogRepository>((ref) => HiveRepository(_box(ref, HiveService.securityEvents), SecurityEvent.fromMap));

/// Box name → repository for sync and backup.
final syncedReposProvider = Provider<Map<String, HiveRepository>>((ref) => {
      HiveService.products: ref.watch(productRepoProvider),
      HiveService.clients: ref.watch(clientRepoProvider),
      HiveService.followups: ref.watch(followupRepoProvider),
      HiveService.callLogs: ref.watch(callLogRepoProvider),
      HiveService.voiceNotes: ref.watch(voiceNoteRepoProvider),
      HiveService.documents: ref.watch(documentRepoProvider),
      HiveService.activities: ref.watch(activityRepoProvider),
    });

final syncServiceProvider = Provider<SyncService>((ref) {
  final s = SyncService(repos: ref.watch(syncedReposProvider), settings: ref.watch(settingsStoreProvider));
  ref.onDispose(() => s.status.dispose());
  return s;
});

final backupServiceProvider =
    Provider<BackupService>((ref) => BackupService(repos: ref.watch(syncedReposProvider), settings: ref.watch(settingsStoreProvider)));

// ── Live data streams ───────────────────────────────────────────────────────

final clientsProvider = StreamProvider<List<Client>>((ref) => ref.watch(clientRepoProvider).watchAll());
final productsProvider = StreamProvider<List<Product>>((ref) => ref
    .watch(productRepoProvider)
    .watchAll()
    .map((l) => l..sort((a, b) => a.sortOrder != b.sortOrder ? a.sortOrder.compareTo(b.sortOrder) : a.name.compareTo(b.name))));
final followupsProvider = StreamProvider<List<Followup>>((ref) => ref.watch(followupRepoProvider).watchAll());
final callLogsProvider = StreamProvider<List<CallLog>>((ref) => ref.watch(callLogRepoProvider).watchAll());
final voiceNotesProvider = StreamProvider<List<VoiceNote>>((ref) => ref.watch(voiceNoteRepoProvider).watchAll());
final documentsProvider = StreamProvider<List<ClientDocument>>((ref) => ref.watch(documentRepoProvider).watchAll());
final activitiesProvider = StreamProvider<List<Activity>>(
    (ref) => ref.watch(activityRepoProvider).watchAll().map((l) => l..sort((a, b) => b.at.compareTo(a.at))));
final securityEventsProvider = StreamProvider<List<SecurityEvent>>(
    (ref) => ref.watch(securityLogRepoProvider).watchAll().map((l) => l..sort((a, b) => b.at.compareTo(a.at))));

/// Synchronous snapshot helpers (empty while loading).
List<T> _v<T>(Ref ref, StreamProvider<List<T>> p) => ref.watch(p).value ?? <T>[];

/// Ticks every minute so time-based views (overdue, today) stay current.
final clockProvider = StreamProvider<DateTime>((ref) async* {
  yield DateTime.now();
  yield* Stream.periodic(const Duration(minutes: 1), (_) => DateTime.now());
});
DateTime _now(Ref ref) => ref.watch(clockProvider).value ?? DateTime.now();

// ── Derived view models ─────────────────────────────────────────────────────

final profileProvider = Provider<UserProfile>((ref) {
  ref.watch(profileVersionProvider);
  return ref.watch(vaultProvider) ? ref.watch(settingsStoreProvider).profile : UserProfile.fallback;
});

/// Bumped after the profile is edited so [profileProvider] re-reads it.
class _Counter extends Notifier<int> {
  @override
  int build() => 0;
  void bump() => state++;
}

final profileVersionProvider = NotifierProvider<_Counter, int>(_Counter.new);

class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => SettingsStore(ref.watch(prefsBoxProvider)).themeMode;
  Future<void> set(ThemeMode m) async {
    state = m;
    await SettingsStore(ref.read(prefsBoxProvider)).setThemeMode(m);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

final productNamesProvider = Provider<Map<String, String>>((ref) => {for (final p in _v(ref, productsProvider)) p.id: p.name});

final clientByIdProvider = Provider.family<Client?, String>((ref, id) {
  for (final c in _v(ref, clientsProvider)) {
    if (c.id == id) return c;
  }
  return null;
});

/// Client ids with at least one required document still pending.
final clientsWithPendingDocsProvider = Provider<Set<String>>((ref) => _v(ref, documentsProvider)
    .where((d) => d.type != DocumentType.custom && d.status == DocumentStatus.pending)
    .map((d) => d.clientId)
    .toSet());

final kpiProvider = Provider<KpiSummary>((ref) => ReportEngine.kpis(
      _v(ref, clientsProvider),
      _v(ref, followupsProvider),
      now: _now(ref),
      clientsWithPendingDocs: ref.watch(clientsWithPendingDocsProvider),
    ));

final insightsProvider = Provider<Insights>((ref) => InsightsEngine.build(
      clients: _v(ref, clientsProvider),
      followups: _v(ref, followupsProvider),
      documents: _v(ref, documentsProvider),
      products: _v(ref, productsProvider),
      now: _now(ref),
    ));

/// Lead score per client id.
final scoresProvider = Provider<Map<String, int>>((ref) => ref.watch(insightsProvider).scores);

final productivityProvider = Provider<Productivity>((ref) => ProductivityCalculator.compute(
      followups: _v(ref, followupsProvider),
      calls: _v(ref, callLogsProvider),
      activities: _v(ref, activitiesProvider),
      documents: _v(ref, documentsProvider),
      now: _now(ref),
    ));

final nowProvider = Provider<DateTime>((ref) => _now(ref));

// Per-client slices.
final clientFollowupsProvider = Provider.family<List<Followup>, String>(
    (ref, id) => _v(ref, followupsProvider).where((f) => f.clientId == id).toList()..sort((a, b) => b.dueAt.compareTo(a.dueAt)));
final clientCallsProvider = Provider.family<List<CallLog>, String>(
    (ref, id) => _v(ref, callLogsProvider).where((c) => c.clientId == id).toList()..sort((a, b) => b.calledAt.compareTo(a.calledAt)));
final clientDocumentsProvider = Provider.family<List<ClientDocument>, String>((ref, id) => _v(ref, documentsProvider)
    .where((d) => d.clientId == id)
    .toList()
  ..sort((a, b) => a.type.index != b.type.index ? a.type.index.compareTo(b.type.index) : a.createdAt.compareTo(b.createdAt)));
final clientVoiceNotesProvider = Provider.family<List<VoiceNote>, String>(
    (ref, id) => _v(ref, voiceNotesProvider).where((v) => v.clientId == id).toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
final clientActivitiesProvider =
    Provider.family<List<Activity>, String>((ref, id) => _v(ref, activitiesProvider).where((a) => a.clientId == id).toList());

/// Sync status for the Settings screen.
final syncStatusProvider = StreamProvider<SyncStatus>((ref) {
  final s = ref.watch(syncServiceProvider);
  final c = StreamController<SyncStatus>();
  void l() => c.add(s.status.value);
  c.add(s.status.value);
  s.status.addListener(l);
  ref.onDispose(() {
    s.status.removeListener(l);
    c.close();
  });
  return c.stream;
});
