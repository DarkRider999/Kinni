import 'package:hive_ce_flutter/hive_ce_flutter.dart';

/// Owns every Hive box. Sensitive boxes are opened with AES-256 using the
/// vault key; `prefs` (non-sensitive lock-screen preferences) is plain.
class HiveService {
  HiveService._();
  static final HiveService instance = HiveService._();

  static const schemaVersion = 1;

  static const prefsBox = 'prefs';
  static const clients = 'clients';
  static const products = 'products';
  static const followups = 'followups';
  static const callLogs = 'call_logs';
  static const voiceNotes = 'voice_notes';
  static const documents = 'documents';
  static const activities = 'activities';
  static const securityEvents = 'security_events';
  static const settings = 'settings';

  /// Boxes mirrored to Firestore, in dependency order.
  static const syncedBoxes = [products, clients, followups, callLogs, voiceNotes, documents, activities];

  static const encryptedBoxes = [...syncedBoxes, securityEvents, settings];

  bool _flutterInitialised = false;
  bool get isVaultOpen => Hive.isBoxOpen(clients);

  Future<void> init() async {
    if (_flutterInitialised) return;
    await Hive.initFlutter('anjali_crm');
    _flutterInitialised = true;
  }

  /// Plain box available before unlock.
  Future<Box> openPrefs() async {
    await init();
    return Hive.isBoxOpen(prefsBox) ? Hive.box(prefsBox) : Hive.openBox(prefsBox);
  }

  Box get prefs => Hive.box(prefsBox);

  /// Opens every encrypted box with [key] (32 bytes).
  Future<void> openVault(List<int> key) async {
    await init();
    final cipher = HiveAesCipher(key);
    for (final name in encryptedBoxes) {
      if (!Hive.isBoxOpen(name)) {
        await Hive.openBox(name, encryptionCipher: cipher);
      }
    }
    final s = Hive.box(settings);
    if (s.get('schemaVersion') == null) await s.put('schemaVersion', schemaVersion);
  }

  /// Closes encrypted boxes; data stays AES-encrypted on disk and the key
  /// is no longer referenced by Hive.
  Future<void> closeVault() async {
    for (final name in encryptedBoxes) {
      if (Hive.isBoxOpen(name)) await Hive.box(name).close();
    }
  }

  Box box(String name) => Hive.box(name);

  /// Deletes every encrypted box from disk (used before restore).
  Future<void> wipeVault() async {
    for (final name in encryptedBoxes) {
      if (Hive.isBoxOpen(name)) {
        await Hive.box(name).clear();
      }
    }
  }
}
