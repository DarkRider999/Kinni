import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/security_event.dart';
import '../../providers/app_providers.dart';
import '../../providers/lock_controller.dart';
import '../lock/lock_screen.dart';
import '../lock/pattern_lock.dart';
import '../lock/pin_pad.dart';
import 'settings_widgets.dart';

/// Biometrics, PIN, pattern, auto-lock, recovery code and the security log
/// (FR-SEC).
class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  static const autoLockOptions = <int, String>{1: '1 minute', 2: '2 minutes', 5: '5 minutes', 10: '10 minutes', 30: '30 minutes', 0: 'Never'};

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  late bool _biometric = ref.read(settingsStoreProvider).biometricEnabled;
  late bool _pattern = ref.read(settingsStoreProvider).patternEnabled;
  late int _autoLock = ref.read(settingsStoreProvider).autoLockMinutes;

  Future<void> _toggleBiometric(bool on) async {
    final store = ref.read(settingsStoreProvider);
    if (on) {
      final auth = ref.read(authServiceProvider);
      if (!await auth.biometricAvailable()) {
        if (mounted) showSnack(context, 'No fingerprint or face is enrolled on this device', error: true);
        return;
      }
      if (!await auth.authenticateBiometric(reason: 'Confirm to enable biometric unlock')) {
        if (mounted) showSnack(context, 'Biometric check failed', error: true);
        return;
      }
    }
    await store.setBiometricEnabled(on);
    if (mounted) setState(() => _biometric = on);
  }

  Future<void> _changePin() async {
    if (!await verifyPinDialog(context, ref, title: 'Enter current PIN') || !mounted) return;
    await showDialog<void>(context: context, barrierDismissible: false, builder: (_) => const NewPinDialog());
  }

  Future<void> _togglePattern(bool on) async {
    final auth = ref.read(authServiceProvider);
    final store = ref.read(settingsStoreProvider);
    if (!await verifyPinDialog(context, ref, title: 'Enter PIN to ${on ? 'set' : 'remove'} pattern') || !mounted) return;
    if (on) {
      final dots = await showDialog<List<int>>(context: context, barrierDismissible: false, builder: (_) => const _SetPatternDialog());
      if (dots == null) return;
      await auth.setPattern(dots);
      await store.setPatternEnabled(true);
    } else {
      await auth.clearPattern();
      await store.setPatternEnabled(false);
    }
    if (!mounted) return;
    setState(() => _pattern = on);
    showSnack(context, on ? 'Pattern lock set' : 'Pattern lock removed');
  }

  Future<void> _regenerateRecovery() async {
    if (!await verifyPinDialog(context, ref, title: 'Enter PIN to continue') || !mounted) return;
    final ok = await confirm(context,
        title: 'New recovery code?', message: 'Your old recovery code will stop working immediately.', ok: 'Generate');
    if (!ok || !mounted) return;
    final code = await ref.read(authServiceProvider).rotateRecoveryCode();
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        title: const Text('Your recovery code'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Write it down and keep it safe. It is shown only once and lets you reset a forgotten PIN.'),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: .1), borderRadius: BorderRadius.circular(12)),
            child: SelectableText(code,
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 1.5)),
          ),
        ]),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code));
              if (c.mounted) showSnack(c, 'Copied');
            },
            icon: const Icon(Icons.copy_rounded),
            label: const Text('Copy'),
          ),
          FilledButton(onPressed: () => Navigator.pop(c), child: const Text('I saved it')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => SettingsPage(
        title: 'Security',
        children: [
          SettingsGroup(title: 'Unlock', icon: Icons.lock_open_rounded, children: [
            SwitchListTile(
              secondary: const SettingsIcon(icon: Icons.fingerprint_rounded),
              title: const Text('Biometric unlock', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Fingerprint or face'),
              value: _biometric,
              onChanged: _toggleBiometric,
            ),
            SettingsTile(icon: Icons.pin_outlined, title: 'Change PIN', onTap: _changePin),
            SwitchListTile(
              secondary: const SettingsIcon(icon: Icons.pattern_rounded, color: AppColors.secondary),
              title: const Text('Pattern lock', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Unlock by drawing a pattern'),
              value: _pattern,
              onChanged: _togglePattern,
            ),
          ]),
          SettingsGroup(title: 'Auto-lock', icon: Icons.timer_outlined, children: [
            ListTile(
              leading: const SettingsIcon(icon: Icons.hourglass_bottom_rounded, color: AppColors.info),
              title: const Text('Lock after inactivity', style: TextStyle(fontWeight: FontWeight.w600)),
              trailing: DropdownButton<int>(
                value: SecurityScreen.autoLockOptions.containsKey(_autoLock) ? _autoLock : 5,
                underline: const SizedBox.shrink(),
                items: [
                  for (final e in SecurityScreen.autoLockOptions.entries) DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) async {
                  if (v == null) return;
                  setState(() => _autoLock = v);
                  await ref.read(settingsStoreProvider).setAutoLockMinutes(v);
                  ref.read(lockControllerProvider.notifier).resetIdleTimer();
                },
              ),
            ),
            SettingsNote(lockoutSummary(), icon: Icons.gpp_maybe_outlined),
          ]),
          SettingsGroup(title: 'Recovery & audit', icon: Icons.policy_outlined, children: [
            SettingsTile(
              icon: Icons.key_rounded,
              color: AppColors.gold,
              title: 'Regenerate recovery code',
              subtitle: 'Old code stops working',
              onTap: _regenerateRecovery,
            ),
            SettingsTile(
              icon: Icons.history_rounded,
              color: AppColors.danger,
              title: 'Security log',
              subtitle: 'Unlocks, failed attempts, intruder photos',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SecurityLogScreen())),
            ),
          ]),
        ],
      );
}

/// Asks for the current PIN on a [PinPad]; true once it verifies.
Future<bool> verifyPinDialog(BuildContext context, WidgetRef ref, {String title = 'Enter PIN'}) async {
  final r = await showDialog<bool>(context: context, builder: (_) => _VerifyPinDialog(title: title));
  return r ?? false;
}

class _VerifyPinDialog extends ConsumerStatefulWidget {
  const _VerifyPinDialog({required this.title});
  final String title;

  @override
  ConsumerState<_VerifyPinDialog> createState() => _VerifyPinDialogState();
}

class _VerifyPinDialogState extends ConsumerState<_VerifyPinDialog> {
  int _errorTick = 0;
  bool _busy = false;
  String? _error;

  Future<void> _check(String pin) async {
    setState(() => _busy = true);
    final ok = await ref.read(authServiceProvider).verifyPin(pin);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context, true);
    } else {
      setState(() {
        _busy = false;
        _errorTick++;
        _error = 'Wrong PIN';
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.title),
        content: SizedBox(
          width: 300,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
              PinPad(onCompleted: _check, enabled: !_busy, errorTick: _errorTick),
            ]),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel'))],
      );
}

/// Draw a pattern twice (min 4 dots); pops the confirmed dots.
class _SetPatternDialog extends StatefulWidget {
  const _SetPatternDialog();

  @override
  State<_SetPatternDialog> createState() => _SetPatternDialogState();
}

class _SetPatternDialogState extends State<_SetPatternDialog> {
  static const minDots = 4;
  List<int>? _first;
  String _hint = 'Draw a pattern (at least $minDots dots)';
  int _errorTick = 0;

  void _onDrawn(List<int> dots) {
    if (dots.length < minDots) {
      setState(() {
        _errorTick++;
        _hint = 'Connect at least $minDots dots';
      });
      return;
    }
    if (_first == null) {
      setState(() {
        _first = List.of(dots);
        _hint = 'Draw the same pattern again to confirm';
      });
      return;
    }
    if (_first!.length == dots.length && List.generate(dots.length, (i) => _first![i] == dots[i]).every((x) => x)) {
      Navigator.pop(context, _first);
    } else {
      setState(() {
        _first = null;
        _errorTick++;
        _hint = 'Patterns did not match. Start again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Set pattern'),
        content: SizedBox(
          width: 280,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(_hint, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (_, c) => PatternLock(size: c.maxWidth.clamp(180, 260).toDouble(), errorTick: _errorTick, onCompleted: _onDrawn),
              ),
            ]),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))],
      );
}

/// Security event history with intruder photo thumbnails (FR SEC-10).
class SecurityLogScreen extends ConsumerWidget {
  const SecurityLogScreen({super.key});

  static IconData _icon(SecurityEventType t) => switch (t) {
        SecurityEventType.unlockSuccess => Icons.lock_open_rounded,
        SecurityEventType.lockout => Icons.gpp_bad_rounded,
        SecurityEventType.pinChanged => Icons.pin_rounded,
        SecurityEventType.recoveryUsed => Icons.key_rounded,
        SecurityEventType.failedBiometric => Icons.fingerprint_rounded,
        _ => Icons.error_outline_rounded,
      };

  static Color _color(SecurityEventType t) => switch (t) {
        SecurityEventType.unlockSuccess => AppColors.success,
        SecurityEventType.pinChanged || SecurityEventType.recoveryUsed => AppColors.info,
        SecurityEventType.lockout => AppColors.danger,
        _ => AppColors.warning,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(securityEventsProvider);
    return SettingsScaffold(
      title: 'Security log',
      body: events.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EmptyState(icon: Icons.error_outline_rounded, title: 'Could not load the log', message: '$e'),
        data: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.verified_user_outlined, title: 'No security events yet')
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _EventTile(event: list[i], icon: _icon(list[i].type), color: _color(list[i].type)),
              ),
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event, required this.icon, required this.color});
  final SecurityEvent event;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final photo = event.photoPath == null ? null : File(event.photoPath!);
    final hasPhoto = photo != null && photo.existsSync();
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Row(children: [
        SettingsIcon(icon: icon, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(event.type.label, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(Fmt.dateTime(event.at), style: Theme.of(context).textTheme.bodySmall),
            if (event.detail != null && event.detail!.isNotEmpty)
              Text(event.detail!, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
          ]),
        ),
        if (hasPhoto)
          GestureDetector(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _PhotoViewer(file: photo))),
            child: Hero(
              tag: 'intruder-${event.id}',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.file(photo, width: 52, height: 52, fit: BoxFit.cover, cacheWidth: 160),
              ),
            ),
          ),
      ]),
    );
  }
}

class _PhotoViewer extends StatelessWidget {
  const _PhotoViewer({required this.file});
  final File file;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: const Text('Intruder photo')),
        body: Center(child: InteractiveViewer(maxScale: 5, child: Image.file(file))),
      );
}
