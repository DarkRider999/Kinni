import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

import '../../core/services/connectivity_service.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_colors.dart';
import '../../domain/entities/followup.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../../providers/lock_controller.dart';
import '../calls/call_actions.dart';
import '../../core/widgets/common.dart';
import '../clients/client_form_screen.dart';
import '../documents/documents_tab.dart';
import '../clients/client_list_screen.dart';
import '../clients/client_profile_screen.dart';
import '../followups/followups_screen.dart';
import '../home/home_screen.dart';
import '../motivation/motivation_dialog.dart';
import '../reports/reports_screen.dart';
import '../settings/settings_screen.dart';
import '../tts/speak_button.dart';

/// Bottom-navigation shell: Home · Clients · Add Lead · Followups · Reports ·
/// Settings. Also owns cross-cutting runtime behaviour:
/// * motivation dialog after each unlock (cold start),
/// * after-call outcome sheet when returning from the dialer,
/// * notification taps → client profile,
/// * sync when connectivity returns, missed-reminder sweep.
class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  /// Lets any screen switch tabs (e.g. Home → Followups).
  static void goToTab(BuildContext context, int index) => context.findAncestorStateOfType<_MainShellState>()?._select(index);

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> with WidgetsBindingObserver {
  int _index = 0;
  bool _motivationShown = false;
  StreamSubscription<String>? _taps;
  StreamSubscription<bool>? _net;
  StreamSubscription<List<SharedMediaFile>>? _shares;

  static const _destinations = [
    NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Home'),
    NavigationDestination(icon: Icon(Icons.people_alt_outlined), selectedIcon: Icon(Icons.people_alt_rounded), label: 'Clients'),
    NavigationDestination(icon: _AddIcon(), label: 'Add Lead'),
    NavigationDestination(icon: Icon(Icons.event_note_outlined), selectedIcon: Icon(Icons.event_note_rounded), label: 'Followups'),
    NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights_rounded), label: 'Reports'),
    NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings_rounded), label: 'Settings'),
  ];

  // Built lazily so a tab is only constructed when first visited.
  final _built = <int>{0};

  Widget _tab(int i) => switch (i) {
        0 => const HomeScreen(),
        1 => const ClientListScreen(embedded: true),
        2 => const ClientFormScreen(embedded: true),
        3 => const FollowupsScreen(),
        4 => const ReportsScreen(),
        _ => const SettingsScreen(),
      };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _taps = NotificationService.instance.taps.listen(_openPayload);
    try {
      _shares = ReceiveSharingIntent.instance.getMediaStream().listen(_onShared, onError: (_) {});
    } catch (_) {
      // Not supported on this platform.
    }
    _net = Net.changes().listen((online) {
      if (online) ref.read(syncServiceProvider).requestSync();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _afterUnlock());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _taps?.cancel();
    _shares?.cancel();
    _net?.cancel();
    super.dispose();
  }

  void _select(int i) => setState(() {
        _index = i;
        _built.add(i);
      });

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Give the lock controller a frame to decide whether we re-locked.
      Future.delayed(const Duration(milliseconds: 400), () {
        if (mounted && !ref.read(lockControllerProvider).locked) _checkPendingCall();
      });
      ref.read(syncServiceProvider).requestSync();
    }
  }

  /// Runs once the user is unlocked: motivation, pending call, launch payload.
  Future<void> _afterUnlock() async {
    if (ref.read(lockControllerProvider).locked) return;
    final actions = ref.read(crmActionsProvider);
    if (!_motivationShown) {
      _motivationShown = true;
      final msg = await actions.nextMotivation();
      if (msg != null && mounted) {
        await MotivationDialog.show(context, msg, name: ref.read(profileProvider).firstName);
      }
    }
    if (!mounted) return;
    final launch = NotificationService.instance.launchPayload;
    if (launch != null) {
      NotificationService.instance.launchPayload = null;
      _openPayload(launch);
    }
    await _checkPendingCall();
    await actions.notifyMissed();
    await actions.expireDocuments();
    try {
      _onShared(await ReceiveSharingIntent.instance.getInitialMedia());
    } catch (_) {
      // Share intents are unavailable on this platform (tests, desktop).
    }
    await _processShares();
    ref.read(syncServiceProvider).requestSync();
  }

  Future<void> _checkPendingCall() async {
    final pending = ref.read(settingsStoreProvider).pendingCall;
    if (pending == null) return;
    // Ignore stale markers (dialer never actually used, or > 3 h old).
    final age = DateTime.now().difference(pending.startedAt);
    if (age < const Duration(seconds: 3) || age > const Duration(hours: 3)) {
      if (age > const Duration(hours: 3)) await ref.read(crmActionsProvider).setPendingCall(null);
      return;
    }
    final c = ref.read(clientRepoProvider).getById(pending.clientId);
    if (c == null || !mounted) {
      await ref.read(crmActionsProvider).setPendingCall(null);
      return;
    }
    await showCallOutcomeSheet(context, ref, c);
  }

  /// Notification tap: `followup:<id>` or `client:<id>` (document expiry).
  void _openPayload(String payload) {
    if (!mounted) return;
    if (payload.startsWith('client:')) {
      final id = payload.substring('client:'.length);
      if (ref.read(clientRepoProvider).getById(id) != null) ClientProfileScreen.open(context, id, tab: ClientProfileScreen.vaultTab);
      return;
    }
    if (!payload.startsWith('followup:')) return;
    final Followup? f = ref.read(followupRepoProvider).getById(payload.substring('followup:'.length));
    if (f == null) return;
    ClientProfileScreen.open(context, f.clientId);
  }

  // ── Share-to-app (WhatsApp, Files, Gallery → client vault) ───────────────

  /// Files shared while locked wait here until the next unlock.
  final _pendingShares = <String>[];

  void _onShared(List<SharedMediaFile> files) {
    final paths = [
      for (final f in files)
        if (vaultExtensions.contains(p.extension(f.path).replaceFirst('.', '').toLowerCase())) f.path,
    ];
    if (files.isNotEmpty && paths.isEmpty && mounted && !ref.read(lockControllerProvider).locked) {
      showSnack(context, 'Only PDF, JPG, PNG and WEBP files can be saved to the vault', error: true);
    }
    if (paths.isEmpty) return;
    _pendingShares.addAll(paths);
    if (!ref.read(lockControllerProvider).locked) _processShares();
  }

  Future<void> _processShares() async {
    if (_pendingShares.isEmpty || !mounted) return;
    final paths = [..._pendingShares];
    _pendingShares.clear();
    try {
      ReceiveSharingIntent.instance.reset();
    } catch (_) {
      // Clearing the consumed intent is best effort.
    }
    showSnack(context, 'Choose the client to save ${paths.length == 1 ? 'this document' : '${paths.length} documents'} to');
    final client = await pickClient(context, ref.read(clientsProvider).value ?? const []);
    if (client == null || !mounted) return;
    try {
      for (final path in paths) {
        if (!mounted) return;
        await attachSharedFile(context, ref, client.id, path);
      }
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save the shared file: $e', error: true);
      return;
    }
    if (mounted) ClientProfileScreen.open(context, client.id, tab: ClientProfileScreen.vaultTab);
  }

  @override
  Widget build(BuildContext context) {
    // Show the motivation again after the next unlock from a cold lock.
    ref.listen(lockControllerProvider.select((s) => s.locked), (prev, locked) {
      if (prev == true && !locked) _afterUnlock();
    });
    final overdue = ref.watch(kpiProvider).overdueFollowups;
    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _select(0);
      },
      child: Scaffold(
        extendBody: true,
        body: Stack(
          children: [
            IndexedStack(
              index: _index,
              children: [for (var i = 0; i < 6; i++) _built.contains(i) ? _tab(i) : const SizedBox.shrink()],
            ),
            // Read-aloud controls (pause / resume / stop / speed) stay
            // reachable from every tab while text is being spoken.
            const Positioned(left: 12, right: 12, bottom: 96, child: TtsMiniPlayer()),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _select,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            for (var i = 0; i < _destinations.length; i++)
              i == 3 && overdue > 0
                  ? NavigationDestination(
                      icon: Badge(label: Text('$overdue'), child: const Icon(Icons.event_note_outlined)),
                      selectedIcon: Badge(label: Text('$overdue'), child: const Icon(Icons.event_note_rounded)),
                      label: 'Followups',
                    )
                  : _destinations[i],
          ],
        ),
      ),
    );
  }
}

/// Raised gradient "+" for the centre Add Lead tab.
class _AddIcon extends StatelessWidget {
  const _AddIcon();

  @override
  Widget build(BuildContext context) => Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          gradient: AppColors.brandGradient,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(color: AppColors.secondary.withValues(alpha: .4), blurRadius: 10, offset: const Offset(0, 3))],
        ),
        child: const Icon(Icons.person_add_alt_1_rounded, color: Colors.white),
      );
}
