import 'package:flutter/material.dart';
import 'package:hive_ce/hive_ce.dart';

import '../../core/services/notification_service.dart';
import '../../domain/entities/user_profile.dart';

/// Typed access to the two key/value boxes:
/// * `prefs` (plain): lock-screen state needed before the vault opens.
/// * `settings` (encrypted): everything else.
class SettingsStore {
  SettingsStore(this.prefs, [this.settings]);

  final Box prefs;
  final Box? settings;

  // ── Pre-unlock prefs ───────────────────────────────────────────────────
  bool get onboarded => prefs.get('onboarded', defaultValue: false) as bool;
  Future<void> setOnboarded(bool v) => prefs.put('onboarded', v);

  ThemeMode get themeMode => ThemeMode.values.byName(prefs.get('themeMode', defaultValue: 'system') as String);
  Future<void> setThemeMode(ThemeMode m) => prefs.put('themeMode', m.name);

  bool get biometricEnabled => prefs.get('biometricEnabled', defaultValue: false) as bool;
  Future<void> setBiometricEnabled(bool v) => prefs.put('biometricEnabled', v);

  bool get patternEnabled => prefs.get('patternEnabled', defaultValue: false) as bool;
  Future<void> setPatternEnabled(bool v) => prefs.put('patternEnabled', v);

  int get autoLockMinutes => prefs.get('autoLockMinutes', defaultValue: 5) as int;
  Future<void> setAutoLockMinutes(int v) => prefs.put('autoLockMinutes', v);

  String get displayName => prefs.get('displayName', defaultValue: 'Anjali') as String;
  Future<void> setDisplayName(String v) => prefs.put('displayName', v);

  int get failedAttempts => prefs.get('failedAttempts', defaultValue: 0) as int;
  Future<void> setFailedAttempts(int v) => prefs.put('failedAttempts', v);

  int get lockoutLevel => prefs.get('lockoutLevel', defaultValue: 0) as int;
  Future<void> setLockoutLevel(int v) => prefs.put('lockoutLevel', v);

  DateTime? get lockoutUntil {
    final s = prefs.get('lockoutUntil') as String?;
    return s == null ? null : DateTime.tryParse(s);
  }

  Future<void> setLockoutUntil(DateTime? d) =>
      d == null ? prefs.delete('lockoutUntil') : prefs.put('lockoutUntil', d.toIso8601String());

  /// Failed attempts made while the vault is closed; flushed to the
  /// encrypted security log on the next successful unlock.
  List<Map> get pendingSecurityEvents => List<Map>.from(prefs.get('pendingSecurityEvents', defaultValue: const []) as List);
  Future<void> setPendingSecurityEvents(List<Map> v) => prefs.put('pendingSecurityEvents', v);

  // ── Encrypted settings ─────────────────────────────────────────────────
  Box get _s => settings!;

  UserProfile get profile {
    final m = _s.get('profile');
    return m is Map ? UserProfile.fromMap(m) : UserProfile.fallback;
  }

  Future<void> setProfile(UserProfile p) async {
    await _s.put('profile', p.toMap());
    await setDisplayName(p.firstName);
  }

  List<int> get reminderOffsets =>
      List<int>.from(_s.get('reminderOffsetsMinutes', defaultValue: NotificationService.defaultOffsetsMinutes) as List);
  Future<void> setReminderOffsets(List<int> v) => _s.put('reminderOffsetsMinutes', v);

  bool get motivationEnabled => _s.get('motivationEnabled', defaultValue: true) as bool;
  Future<void> setMotivationEnabled(bool v) => _s.put('motivationEnabled', v);

  List<int> get motivationHistory => List<int>.from(_s.get('motivationHistory', defaultValue: const <int>[]) as List);
  Future<void> setMotivationHistory(List<int> v) => _s.put('motivationHistory', v);

  bool get cloudSyncEnabled => _s.get('cloudSyncEnabled', defaultValue: true) as bool;
  Future<void> setCloudSyncEnabled(bool v) => _s.put('cloudSyncEnabled', v);

  DateTime? _date(String k) {
    final s = _s.get(k) as String?;
    return s == null ? null : DateTime.tryParse(s);
  }

  DateTime? get lastPulledAt => _date('lastPulledAt');
  Future<void> setLastPulledAt(DateTime d) => _s.put('lastPulledAt', d.toUtc().toIso8601String());

  DateTime? get lastSyncAt => _date('lastSyncAt');
  Future<void> setLastSyncAt(DateTime d) => _s.put('lastSyncAt', d.toIso8601String());

  DateTime? get lastBackupAt => _date('lastBackupAt');
  Future<void> setLastBackupAt(DateTime d) => _s.put('lastBackupAt', d.toIso8601String());

  /// Call started from the app, awaiting an outcome (FR CALL-02).
  ({String clientId, DateTime startedAt})? get pendingCall {
    final m = _s.get('pendingCall');
    if (m is! Map) return null;
    final t = DateTime.tryParse('${m['startedAt']}');
    if (t == null) return null;
    return (clientId: '${m['clientId']}', startedAt: t);
  }

  Future<void> setPendingCall(String? clientId) => clientId == null
      ? _s.delete('pendingCall')
      : _s.put('pendingCall', {'clientId': clientId, 'startedAt': DateTime.now().toIso8601String()});
}
