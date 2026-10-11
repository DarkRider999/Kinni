import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:workmanager/workmanager.dart';

import '../core/config/firebase_config.dart';
import '../core/security/secure_store.dart';
import '../core/security/vault_key_manager.dart';
import '../core/services/notification_service.dart';
import '../data/backup/backup_service.dart';
import '../data/local/hive_repository.dart';
import '../data/local/hive_service.dart';
import '../data/local/settings_store.dart';
import '../data/remote/sync_service.dart';
import '../domain/entities/activity.dart';
import '../domain/entities/call_log.dart';
import '../domain/entities/client.dart';
import '../domain/entities/client_document.dart';
import '../domain/entities/followup.dart';
import '../domain/entities/product.dart';
import '../domain/entities/voice_note.dart';
import '../domain/entities/whatsapp_template.dart';

const syncTask = 'anjali.sync';
const backupTask = 'anjali.dailyBackup';

/// Registers the 15-minute sync/missed-reminder sweep and the daily backup.
Future<void> registerBackgroundTasks() async {
  await Workmanager().registerPeriodicTask(
    syncTask,
    syncTask,
    frequency: const Duration(minutes: 15),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
  );
  await Workmanager().registerPeriodicTask(
    backupTask,
    backupTask,
    frequency: const Duration(hours: 24),
    initialDelay: const Duration(hours: 2),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    constraints: Constraints(networkType: NetworkType.notRequired, requiresBatteryNotLow: true),
  );
}

Map<String, HiveRepository> _repos() => {
      HiveService.products: HiveRepository(HiveService.instance.box(HiveService.products), Product.fromMap),
      HiveService.templates: HiveRepository(HiveService.instance.box(HiveService.templates), WhatsAppTemplate.fromMap),
      HiveService.clients: HiveRepository(HiveService.instance.box(HiveService.clients), Client.fromMap),
      HiveService.followups: HiveRepository(HiveService.instance.box(HiveService.followups), Followup.fromMap),
      HiveService.callLogs: HiveRepository(HiveService.instance.box(HiveService.callLogs), CallLog.fromMap),
      HiveService.voiceNotes: HiveRepository(HiveService.instance.box(HiveService.voiceNotes), VoiceNote.fromMap),
      HiveService.documents: HiveRepository(HiveService.instance.box(HiveService.documents), ClientDocument.fromMap),
      HiveService.activities: HiveRepository(HiveService.instance.box(HiveService.activities), Activity.fromMap),
    };

/// Background isolate entry point.
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, input) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    try {
      final prefs = await HiveService.instance.openPrefs();
      if (!SettingsStore(prefs).onboarded) return true;
      final key = await VaultKeyManager(SecureStore()).loadOrCreateKey();
      await HiveService.instance.openVault(key);
      final settings = SettingsStore(prefs, HiveService.instance.box(HiveService.settings));
      final repos = _repos();

      if (task == backupTask) {
        await BackupService(repos: repos, settings: settings).createBackup(automatic: true);
      } else {
        await NotificationService.instance.init();
        await _notifyMissed(repos);
        if (FirebaseConfig.isConfigured) {
          await FirebaseConfig.ensureInitialised();
          await SyncService(repos: repos, settings: settings).syncNow();
        }
      }
      return true;
    } catch (e) {
      debugPrint('background task $task failed: $e');
      return false;
    } finally {
      await HiveService.instance.closeVault();
    }
  });
}

Future<void> _notifyMissed(Map<String, HiveRepository> repos) async {
  final followups = repos[HiveService.followups]! as HiveRepository<Followup>;
  final clients = repos[HiveService.clients]! as HiveRepository<Client>;
  final now = DateTime.now();
  for (final f in followups.getAll().where((f) => f.isOverdue(now) && !f.missedNotified)) {
    final c = clients.getById(f.clientId);
    if (c == null || c.deleted || !c.status.isOpen) continue;
    await NotificationService.instance.showMissed(f, c);
    await followups.upsert(f.copyWith(missedNotified: true));
  }
}
