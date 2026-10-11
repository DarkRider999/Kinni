import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/local/settings_store.dart';
import '../../providers/app_providers.dart';
import '../../providers/lock_controller.dart';
import '../lock/lock_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../shell/main_shell.dart';
import '../splash/splash_screen.dart';

/// Root state machine: Splash → Onboarding | Lock → Shell.
/// The lock screen overlays the shell on auto-lock so tab state survives;
/// the shell is only built once the vault has been opened.
class AppGate extends ConsumerStatefulWidget {
  const AppGate({super.key});

  @override
  ConsumerState<AppGate> createState() => _AppGateState();
}

class _AppGateState extends ConsumerState<AppGate> with WidgetsBindingObserver {
  bool _splashDone = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    final lock = ref.read(lockControllerProvider.notifier);
    if (s == AppLifecycleState.paused) lock.onPaused();
    if (s == AppLifecycleState.resumed) lock.onResumed();
  }

  @override
  Widget build(BuildContext context) {
    if (!_splashDone) return SplashScreen(onDone: () => setState(() => _splashDone = true));

    final onboarded = SettingsStore(ref.watch(prefsBoxProvider)).onboarded;
    final vaultOpen = ref.watch(vaultProvider);
    final locked = ref.watch(lockControllerProvider.select((s) => s.locked));

    if (!onboarded) {
      return OnboardingScreen(onFinished: () => setState(() {}));
    }
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => ref.read(lockControllerProvider.notifier).resetIdleTimer(),
      child: Stack(
        children: [
          if (vaultOpen) const MainShell(),
          if (locked || !vaultOpen) const Positioned.fill(child: LockScreen()),
        ],
      ),
    );
  }
}
