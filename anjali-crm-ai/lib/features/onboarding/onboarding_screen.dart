import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

import '../../core/constants/app_assets.dart';
import '../../core/constants/product_icons.dart';
import '../../core/services/file_storage_service.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../data/local/settings_store.dart';
import '../../data/seed/defaults.dart';
import '../../domain/entities/user_profile.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../../providers/lock_controller.dart';
import '../lock/pin_pad.dart';

/// First-launch wizard (FR ONB-01…04).
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key, required this.onFinished});
  final VoidCallback onFinished;

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  static const _steps = 8;
  int _step = 0;

  String? _photoTemp;
  final _name = TextEditingController(text: 'Anjali');
  final _mobile = TextEditingController();
  ThemeMode _theme = ThemeMode.system;
  String? _pinFirst;
  String? _pin;
  String? _pinError;
  int _pinTick = 0;
  bool _biometricAvailable = false;
  bool _biometric = false;
  final Set<String> _products = {for (final s in Defaults.productSpecs) s.$1};
  final List<String> _customProducts = [];
  bool _sample = true;
  bool _finishing = false;
  String? _recoveryCode;
  bool _savedCode = false;

  @override
  void initState() {
    super.initState();
    ref.read(authServiceProvider).biometricAvailable().then((v) {
      if (mounted) setState(() => _biometricAvailable = _biometric = v);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    super.dispose();
  }

  bool get _canNext => switch (_step) {
        1 => Validators.name(_name.text) == null,
        2 => Validators.phone(_mobile.text) == null,
        4 => _pin != null,
        6 => _products.isNotEmpty || _customProducts.isNotEmpty,
        7 => _savedCode,
        _ => true,
      };

  Future<void> _pickPhoto(ImageSource src) async {
    final x = await ImagePicker().pickImage(source: src, imageQuality: 85, maxWidth: 800, preferredCameraDevice: CameraDevice.front);
    if (x != null) setState(() => _photoTemp = x.path);
  }

  void _onPin(String pin) {
    if (_pinFirst == null) {
      final err = Validators.pin(pin);
      setState(() {
        _pinError = err;
        _pinTick++;
        if (err == null) _pinFirst = pin;
      });
    } else if (pin == _pinFirst) {
      setState(() {
        _pin = pin;
        _pinError = null;
      });
      _next();
    } else {
      setState(() {
        _pinFirst = null;
        _pinError = "PINs didn't match. Try again.";
        _pinTick++;
      });
    }
  }

  Future<void> _next() async {
    FocusScope.of(context).unfocus();
    if (_step == 6) {
      await _finish();
      return;
    }
    if (_step == 7) {
      await SettingsStore(ref.read(prefsBoxProvider)).setOnboarded(true);
      ref.read(lockControllerProvider.notifier).markUnlocked();
      widget.onFinished();
      return;
    }
    setState(() => _step++);
  }

  /// Persists everything, opens the encrypted vault and generates the
  /// recovery code (shown on the last step).
  Future<void> _finish() async {
    setState(() => _finishing = true);
    try {
      final auth = ref.read(authServiceProvider);
      await auth.setPin(_pin!);
      await ref.read(vaultProvider.notifier).open();
      final store = ref.read(settingsStoreProvider);

      String? photo;
      if (_photoTemp != null) {
        final dir = await FileStore.profileDir();
        photo = p.join(dir.path, 'profile${p.extension(_photoTemp!)}');
        await File(_photoTemp!).copy(photo);
      }
      await store.setProfile(UserProfile(name: _name.text.trim(), mobile: _mobile.text.trim(), photoPath: photo));
      await store.setBiometricEnabled(_biometric);
      await ref.read(themeModeProvider.notifier).set(_theme);

      final actions = ref.read(crmActionsProvider);
      await actions.seedDefaults([..._products, ..._customProducts]);
      if (_sample) await actions.loadSampleData();
      _recoveryCode = await auth.rotateRecoveryCode();
      await NotificationService.instance.requestPermissions();
      setState(() {
        _finishing = false;
        _step = 7;
      });
    } catch (e) {
      setState(() => _finishing = false);
      if (mounted) showSnack(context, 'Setup failed: $e', error: true);
    }
  }

  Future<void> _addCustomProduct() async {
    final c = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add product'),
        content: TextField(controller: c, autofocus: true, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(hintText: 'e.g. Gold Loan')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Add')),
        ],
      ),
    );
    if (name != null && name.isNotEmpty && !_customProducts.contains(name) && !_products.contains(name)) {
      setState(() => _customProducts.add(name));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      body: TabBackground(
        image: AppAssets.bgBlush,
        opacity: .22,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: Row(
                  children: [
                    if (_step > 0 && _step < 7)
                      IconButton(onPressed: () => setState(() => _step--), icon: const Icon(Icons.arrow_back_rounded))
                    else
                      const SizedBox(width: 48),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(value: (_step + 1) / _steps, minHeight: 6, backgroundColor: AppColors.primary.withValues(alpha: .12)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text('${_step + 1}/$_steps', style: t.labelMedium),
                  ],
                ),
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 280),
                  transitionBuilder: (c, a) => FadeTransition(
                    opacity: a,
                    child: SlideTransition(position: Tween(begin: const Offset(.08, 0), end: Offset.zero).animate(a), child: c),
                  ),
                  child: SingleChildScrollView(
                    key: ValueKey(_step),
                    padding: const EdgeInsets.all(24),
                    child: _body(t),
                  ),
                ),
              ),
              if (_step != 4)
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                  child: GradientButton(
                    label: switch (_step) { 0 => _photoTemp == null ? 'Skip for now' : 'Continue', 6 => 'Finish setup', 7 => "Let's go!", _ => 'Continue' },
                    icon: _step == 7 ? Icons.favorite_rounded : Icons.arrow_forward_rounded,
                    loading: _finishing,
                    onPressed: _canNext ? _next : null,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _title(TextTheme t, String title, String sub) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(sub, style: t.bodyMedium?.copyWith(color: t.bodySmall?.color)),
          const SizedBox(height: 24),
        ],
      );

  Widget _body(TextTheme t) {
    switch (_step) {
      case 0:
        return Column(
          children: [
            const AppLogo(size: 110),
            const SizedBox(height: 16),
            Text('Welcome to ${AppInfo.name}', textAlign: TextAlign.center, style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            Text(AppInfo.tagline, style: t.titleSmall?.copyWith(color: AppColors.secondary)),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: () => _pickPhoto(ImageSource.gallery),
              child: CircleAvatar(
                radius: 64,
                backgroundColor: AppColors.primary.withValues(alpha: .12),
                backgroundImage: _photoTemp == null ? null : FileImage(File(_photoTemp!)),
                child: _photoTemp == null ? const Icon(Icons.add_a_photo_rounded, size: 40, color: AppColors.primary) : null,
              ),
            ),
            const SizedBox(height: 12),
            Text('Add your profile picture', style: t.titleMedium),
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              OutlinedButton.icon(onPressed: () => _pickPhoto(ImageSource.camera), icon: const Icon(Icons.photo_camera_outlined), label: const Text('Camera')),
              const SizedBox(width: 12),
              OutlinedButton.icon(onPressed: () => _pickPhoto(ImageSource.gallery), icon: const Icon(Icons.photo_library_outlined), label: const Text('Gallery')),
            ]),
          ],
        );
      case 1:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(t, 'What should we call you?', 'Your name appears on greetings and reports.'),
          TextField(
            controller: _name,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Your name', prefixIcon: Icon(Icons.person_outline)),
            onChanged: (_) => setState(() {}),
          ),
        ]);
      case 2:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(t, 'Your mobile number', 'Used on reports you share with customers.'),
          TextField(
            controller: _mobile,
            autofocus: true,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
            decoration: const InputDecoration(labelText: 'Mobile', hintText: '+971 50 123 4567', prefixIcon: Icon(Icons.phone_iphone)),
            onChanged: (_) => setState(() {}),
          ),
        ]);
      case 3:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(t, 'Choose your look', 'You can change this any time in Settings.'),
          for (final (mode, label, icon) in const [
            (ThemeMode.light, 'Light', Icons.light_mode_rounded),
            (ThemeMode.dark, 'Dark', Icons.dark_mode_rounded),
            (ThemeMode.system, 'Match my phone', Icons.brightness_auto_rounded),
          ])
            GlassCard(
              margin: const EdgeInsets.only(bottom: 12),
              onTap: () {
                setState(() => _theme = mode);
                ref.read(themeModeProvider.notifier).set(mode);
              },
              color: _theme == mode ? AppColors.primary.withValues(alpha: .14) : null,
              child: Row(children: [
                Icon(icon, color: AppColors.primary),
                const SizedBox(width: 14),
                Expanded(child: Text(label, style: t.titleMedium)),
                if (_theme == mode) const Icon(Icons.check_circle_rounded, color: AppColors.primary),
              ]),
            ),
        ]);
      case 4:
        return Column(children: [
          _title(t, _pinFirst == null ? 'Create a 6-digit PIN' : 'Confirm your PIN', 'Your PIN protects every client record. Avoid birthdays and 123456.'),
          if (_pinError != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_pinError!, style: const TextStyle(color: AppColors.danger))),
          PinPad(onCompleted: _onPin, errorTick: _pinTick, minLength: 6),
        ]);
      case 5:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(t, 'Unlock with your fingerprint', 'Faster than a PIN, and just as safe. Face unlock is used where your phone supports it.'),
          GlassCard(
            child: SwitchListTile(
              contentPadding: EdgeInsets.zero,
              secondary: const Icon(Icons.fingerprint_rounded, size: 36, color: AppColors.secondary),
              title: const Text('Enable biometric unlock'),
              subtitle: Text(_biometricAvailable ? 'Fingerprint / face available' : 'Not available on this device. You can use your PIN.'),
              value: _biometric,
              onChanged: _biometricAvailable
                  ? (v) async {
                      if (v && !await ref.read(authServiceProvider).authenticateBiometric(reason: 'Confirm your fingerprint')) return;
                      setState(() => _biometric = v);
                    }
                  : null,
            ),
          ),
        ]);
      case 6:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(t, 'What do you sell?', 'Pick your product categories. Add, edit or remove them later in Settings → Products.'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final s in Defaults.productSpecs)
              FilterChip(
                label: Text(s.$1),
                avatar: Icon(ProductIcons.of(s.$2), size: 18, color: Color(s.$3)),
                selected: _products.contains(s.$1),
                onSelected: (v) => setState(() => v ? _products.add(s.$1) : _products.remove(s.$1)),
              ),
            for (final c in _customProducts) InputChip(label: Text(c), onDeleted: () => setState(() => _customProducts.remove(c))),
            ActionChip(avatar: const Icon(Icons.add, size: 18), label: const Text('Add product'), onPressed: _addCustomProduct),
          ]),
          const SizedBox(height: 20),
          GlassCard(
            child: CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _sample,
              onChanged: (v) => setState(() => _sample = v ?? false),
              title: const Text('Load sample data'),
              subtitle: const Text('30 demo leads so you can explore the dashboard. Remove them any time in Settings.'),
            ),
          ),
        ]);
      default:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(t, 'Save your recovery code', 'If you ever forget your PIN, this code is the only way back in. Write it down or keep it somewhere safe.'),
          GlassCard(
            child: Column(children: [
              SelectableText(_recoveryCode ?? '', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: 3, fontFamily: 'monospace')),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _recoveryCode ?? ''));
                  showSnack(context, 'Recovery code copied');
                },
                icon: const Icon(Icons.copy_rounded),
                label: const Text('Copy'),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          CheckboxListTile(
            value: _savedCode,
            onChanged: (v) => setState(() => _savedCode = v ?? false),
            title: const Text('I have saved my recovery code'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
        ]);
    }
  }
}
