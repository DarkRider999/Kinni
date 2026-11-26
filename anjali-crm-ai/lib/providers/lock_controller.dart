import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/security/auth_service.dart';
import '../core/security/intruder_camera.dart';
import '../core/utils/id.dart';
import '../data/local/settings_store.dart';
import '../domain/entities/enums.dart';
import '../domain/entities/security_event.dart';
import 'app_providers.dart';

/// Lock-screen state.
class LockState {
  const LockState({
    required this.locked,
    this.failedAttempts = 0,
    this.lockoutUntil,
    this.busy = false,
    this.message,
  });

  final bool locked;
  final int failedAttempts;
  final DateTime? lockoutUntil;
  final bool busy;
  final String? message;

  bool isLockedOut(DateTime now) => lockoutUntil != null && lockoutUntil!.isAfter(now);
  int get remainingAttempts => LockoutPolicy.remaining(failedAttempts);

  LockState copyWith({bool? locked, int? failedAttempts, Object? lockoutUntil = _u, bool? busy, Object? message = _u}) => LockState(
        locked: locked ?? this.locked,
        failedAttempts: failedAttempts ?? this.failedAttempts,
        lockoutUntil: identical(lockoutUntil, _u) ? this.lockoutUntil : lockoutUntil as DateTime?,
        busy: busy ?? this.busy,
        message: identical(message, _u) ? this.message : message as String?,
      );
  static const _u = Object();
}

/// Authentication, failed-attempt tracking, lockout and auto-lock
/// (FR SEC-02…SEC-10).
class LockController extends Notifier<LockState> {
  Timer? _idleTimer;
  DateTime? _pausedAt;

  SettingsStore get _prefs => SettingsStore(ref.read(prefsBoxProvider));
  AuthService get _auth => ref.read(authServiceProvider);

  @override
  LockState build() {
    ref.onDispose(() => _idleTimer?.cancel());
    final p = _prefs;
    return LockState(locked: true, failedAttempts: p.failedAttempts, lockoutUntil: p.lockoutUntil);
  }

  // ── Unlock paths ─────────────────────────────────────────────────────────

  Future<bool> unlockWithPin(String pin) => _attempt(() => _auth.verifyPin(pin), SecurityEventType.failedPin);

  Future<bool> unlockWithPattern(List<int> dots) => _attempt(() => _auth.verifyPattern(dots), SecurityEventType.failedPattern);

  Future<bool> unlockWithBiometric() async {
    if (state.isLockedOut(DateTime.now())) return false;
    final ok = await _auth.authenticateBiometric();
    if (ok) {
      await _success();
    } else {
      await _queueEvent(SecurityEventType.failedBiometric);
    }
    return ok;
  }

  /// Verifies the recovery code. On success the vault opens and the caller
  /// must force a new PIN.
  Future<bool> unlockWithRecovery(String code) async {
    final ok = await _attempt(() => _auth.verifyRecovery(code), SecurityEventType.failedRecovery);
    if (ok) await _logNow(SecurityEventType.recoveryUsed);
    return ok;
  }

  Future<bool> _attempt(Future<bool> Function() verify, SecurityEventType failType) async {
    final now = DateTime.now();
    if (state.isLockedOut(now) || state.busy) return false;
    state = state.copyWith(busy: true, message: null);
    final ok = await verify();
    if (ok) {
      await _success();
      return true;
    }
    final attempts = state.failedAttempts + 1;
    await _prefs.setFailedAttempts(attempts);
    await _queueEvent(failType);
    if (attempts >= LockoutPolicy.maxAttempts) {
      await _lockout(now);
    } else {
      final left = LockoutPolicy.remaining(attempts);
      state = state.copyWith(busy: false, failedAttempts: attempts, message: '$left attempt${left == 1 ? '' : 's'} remaining');
    }
    return false;
  }

  Future<void> _lockout(DateTime now) async {
    final level = _prefs.lockoutLevel;
    final until = now.add(LockoutPolicy.durationForLevel(level));
    await _prefs.setLockoutLevel(level + 1);
    await _prefs.setLockoutUntil(until);
    await _prefs.setFailedAttempts(0);
    state = state.copyWith(busy: false, failedAttempts: 0, lockoutUntil: until, message: 'Too many attempts');
    // Evict the key: close the encrypted vault (data stays AES-encrypted).
    if (ref.read(vaultProvider)) await ref.read(vaultProvider.notifier).close();
    final photo = await IntruderCamera.capture();
    await _queueEvent(SecurityEventType.lockout, photoPath: photo, detail: 'Locked until ${until.toIso8601String()}');
  }

  Future<void> _success() async {
    await _prefs.setFailedAttempts(0);
    await _prefs.setLockoutLevel(0);
    await _prefs.setLockoutUntil(null);
    if (!ref.read(vaultProvider)) await ref.read(vaultProvider.notifier).open();
    await _flushEvents();
    await _logNow(SecurityEventType.unlockSuccess);
    state = const LockState(locked: false);
    resetIdleTimer();
  }

  // ── Security log ─────────────────────────────────────────────────────────

  Future<void> _queueEvent(SecurityEventType t, {String? photoPath, String? detail}) async {
    final list = _prefs.pendingSecurityEvents
      ..add({'type': t.name, 'at': DateTime.now().toIso8601String(), 'photoPath': photoPath, 'detail': detail});
    // Keep the plain-box queue bounded.
    await _prefs.setPendingSecurityEvents(list.length > 200 ? list.sublist(list.length - 200) : list);
  }

  Future<void> _flushEvents() async {
    final pending = _prefs.pendingSecurityEvents;
    if (pending.isEmpty) return;
    final repo = ref.read(securityLogRepoProvider);
    for (final m in pending) {
      final at = DateTime.tryParse('${m['at']}') ?? DateTime.now();
      await repo.upsert(SecurityEvent(
        id: newId(),
        createdAt: at,
        updatedAt: at,
        type: SecurityEventType.fromName(m['type']),
        at: at,
        photoPath: m['photoPath'] as String?,
        detail: m['detail'] as String?,
      ));
    }
    await _prefs.setPendingSecurityEvents(const []);
  }

  Future<void> _logNow(SecurityEventType t, {String? detail}) async {
    if (!ref.read(vaultProvider)) return _queueEvent(t, detail: detail);
    final now = DateTime.now();
    await ref.read(securityLogRepoProvider).upsert(SecurityEvent(id: newId(), createdAt: now, updatedAt: now, type: t, at: now, detail: detail));
  }

  Future<void> logPinChanged() => _logNow(SecurityEventType.pinChanged);

  // ── Locking ──────────────────────────────────────────────────────────────

  /// Marks the app unlocked right after onboarding (vault already open).
  void markUnlocked() {
    state = const LockState(locked: false);
    resetIdleTimer();
  }

  void lock() {
    _idleTimer?.cancel();
    if (!state.locked) state = state.copyWith(locked: true, message: null);
  }

  /// Called on every pointer event while unlocked.
  void resetIdleTimer() {
    if (state.locked) return;
    _idleTimer?.cancel();
    final minutes = _prefs.autoLockMinutes;
    if (minutes <= 0) return;
    _idleTimer = Timer(Duration(minutes: minutes), lock);
  }

  void onPaused() {
    _pausedAt = DateTime.now();
    _idleTimer?.cancel();
  }

  void onResumed() {
    final paused = _pausedAt;
    _pausedAt = null;
    if (state.locked) return;
    final minutes = _prefs.autoLockMinutes;
    if (paused != null && minutes > 0 && DateTime.now().difference(paused) >= Duration(minutes: minutes)) {
      lock();
    } else {
      resetIdleTimer();
    }
  }

  /// Clears an expired lockout so the keypad re-enables.
  void refreshLockout() {
    final until = state.lockoutUntil;
    if (until != null && !until.isAfter(DateTime.now())) {
      state = state.copyWith(lockoutUntil: null, message: null);
    }
  }
}

final lockControllerProvider = NotifierProvider<LockController, LockState>(LockController.new);
