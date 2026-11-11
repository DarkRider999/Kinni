import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/security/auth_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/common.dart';
import '../../data/local/settings_store.dart';
import '../../providers/app_providers.dart';
import '../../providers/lock_controller.dart';
import 'pattern_lock.dart';
import 'pin_pad.dart';

/// Unlock with fingerprint/face, PIN or pattern (FR SEC-02…SEC-04, SEC-09).
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  int _errorTick = 0;
  bool _usePattern = false;
  bool _biometricAvailable = false;
  Timer? _ticker;

  SettingsStore get _prefs => SettingsStore(ref.read(prefsBoxProvider));

  @override
  void initState() {
    super.initState();
    _usePattern = _prefs.patternEnabled;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      ref.read(lockControllerProvider.notifier).refreshLockout();
      if (mounted && ref.read(lockControllerProvider).lockoutUntil != null) setState(() {});
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _initBiometric());
  }

  Future<void> _initBiometric() async {
    if (!_prefs.biometricEnabled) return;
    final ok = await ref.read(authServiceProvider).biometricAvailable();
    if (!mounted) return;
    setState(() => _biometricAvailable = ok);
    if (ok && !ref.read(lockControllerProvider).isLockedOut(DateTime.now())) _biometric();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _biometric() => ref.read(lockControllerProvider.notifier).unlockWithBiometric();

  Future<void> _pin(String pin) async {
    final ok = await ref.read(lockControllerProvider.notifier).unlockWithPin(pin);
    if (!ok && mounted) setState(() => _errorTick++);
  }

  Future<void> _pattern(List<int> dots) async {
    if (dots.length < PatternLock.minDots) {
      setState(() => _errorTick++);
      return;
    }
    final ok = await ref.read(lockControllerProvider.notifier).unlockWithPattern(dots);
    if (!ok && mounted) setState(() => _errorTick++);
  }

  Future<void> _forgot() async {
    final ctrl = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Forgot PIN?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter the recovery code you saved during setup (e.g. K7QM-2XRP-H9TD).'),
            const SizedBox(height: 12),
            TextField(controller: ctrl, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Recovery code')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(c, ctrl.text), child: const Text('Verify')),
        ],
      ),
    );
    if (code == null || code.trim().isEmpty || !mounted) return;
    final ok = await ref.read(lockControllerProvider.notifier).unlockWithRecovery(code);
    if (!mounted) return;
    if (!ok) {
      setState(() => _errorTick++);
      showSnack(context, 'Recovery code not recognised', error: true);
      return;
    }
    await showDialog<void>(context: context, barrierDismissible: false, builder: (_) => const NewPinDialog(forced: true));
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(lockControllerProvider);
    final now = DateTime.now();
    final lockedOut = s.isLockedOut(now);
    final remaining = lockedOut ? s.lockoutUntil!.difference(now) : Duration.zero;
    final name = _prefs.displayName;
    final canPattern = _prefs.patternEnabled;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1E1B2E), Color(0xFF2E2552), Color(0xFF4B3F99)],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Opacity(opacity: .14, child: Image.asset(AppAssets.bgBlush, fit: BoxFit.cover)),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, c) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: c.maxHeight),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 16),
                        const AppLogo(size: 86),
                        const SizedBox(height: 14),
                        Text('Welcome back, $name',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        SizedBox(
                          height: 22,
                          child: Text(
                            lockedOut
                                ? 'Too many attempts. Try again in ${_mmss(remaining)}'
                                : (s.message ?? (_usePattern ? 'Draw your pattern' : 'Enter your PIN')),
                            style: TextStyle(color: lockedOut || s.message != null ? const Color(0xFFFFB4C8) : Colors.white70),
                          ),
                        ),
                        const SizedBox(height: 22),
                        if (s.busy)
                          const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator(minHeight: 2))
                        else
                          const SizedBox(height: 18),
                        if (_usePattern)
                          PatternLock(onCompleted: _pattern, light: true, errorTick: _errorTick, enabled: !lockedOut && !s.busy)
                        else
                          PinPad(
                            onCompleted: _pin,
                            length: 6,
                            light: true,
                            enabled: !lockedOut && !s.busy,
                            errorTick: _errorTick,
                            leading: _biometricAvailable
                                ? SizedBox(
                                    width: 76,
                                    height: 76,
                                    child: IconButton(
                                      onPressed: lockedOut ? null : _biometric,
                                      icon: const Icon(Icons.fingerprint_rounded, size: 40, color: AppColors.secondary),
                                    ),
                                  )
                                : null,
                          ),
                        const SizedBox(height: 18),
                        Wrap(
                          alignment: WrapAlignment.center,
                          children: [
                            if (canPattern)
                              TextButton(
                                onPressed: () => setState(() => _usePattern = !_usePattern),
                                child: Text(_usePattern ? 'Use PIN' : 'Use pattern', style: const TextStyle(color: Colors.white)),
                              ),
                            if (_biometricAvailable && _usePattern)
                              TextButton.icon(
                                onPressed: lockedOut ? null : _biometric,
                                icon: const Icon(Icons.fingerprint, color: Colors.white),
                                label: const Text('Biometric', style: TextStyle(color: Colors.white)),
                              ),
                            TextButton(onPressed: lockedOut ? null : _forgot, child: const Text('Forgot PIN?', style: TextStyle(color: Colors.white70))),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _mmss(Duration d) => '${d.inMinutes.toString().padLeft(2, '0')}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}

/// Set a new PIN (enter + confirm). Used for "Change PIN" and after recovery.
class NewPinDialog extends ConsumerStatefulWidget {
  const NewPinDialog({super.key, this.forced = false});
  final bool forced;

  @override
  ConsumerState<NewPinDialog> createState() => _NewPinDialogState();
}

class _NewPinDialogState extends ConsumerState<NewPinDialog> {
  String? _first;
  String? _error;
  int _tick = 0;
  bool _saving = false;

  Future<void> _entered(String pin) async {
    if (_first == null) {
      final err = Validators.pin(pin);
      if (err != null) {
        setState(() {
          _error = err;
          _tick++;
        });
        return;
      }
      setState(() {
        _first = pin;
        _error = null;
        _tick++;
      });
      return;
    }
    if (pin != _first) {
      setState(() {
        _first = null;
        _error = 'PINs did not match. Start again.';
        _tick++;
      });
      return;
    }
    setState(() => _saving = true);
    await ref.read(authServiceProvider).setPin(pin);
    await ref.read(lockControllerProvider.notifier).logPinChanged();
    if (mounted) {
      Navigator.pop(context);
      showSnack(context, 'PIN updated');
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: !widget.forced,
        child: AlertDialog(
          title: Text(_first == null ? 'Choose a new 6-digit PIN' : 'Confirm your new PIN'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: AppColors.danger))),
                if (_saving) const LinearProgressIndicator() else PinPad(onCompleted: _entered, errorTick: _tick, minLength: 6),
              ],
            ),
          ),
          actions: [if (!widget.forced) TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))],
        ),
      );
}

/// Re-exported for settings so lockout duration copy stays consistent.
String lockoutSummary() => 'After ${LockoutPolicy.maxAttempts} wrong attempts the app locks for '
    '${LockoutPolicy.base.inSeconds} s (doubling up to ${LockoutPolicy.cap.inMinutes} min) and takes an intruder photo.';
