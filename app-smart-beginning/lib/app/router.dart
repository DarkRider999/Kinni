import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/parent_session.dart';
import '../features/home/home_shell.dart';
import '../features/onboarding/age_selection_screen.dart';
import '../features/parent/parent_control_screen.dart';
import '../features/parent/parent_gate_screen.dart';
import '../features/splash/splash_screen.dart';
import 'guards.dart';

/// App router with the child-mode / parent-mode boundary enforced as a
/// redirect guard (SPEC §4.2), not merely in the UI.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final ParentSession session = ref.read(parentSessionProvider);
      return parentGuardRedirect(
        location: state.uri.path,
        parentElevated: session.isElevatedAt(DateTime.now()),
      );
    },
    routes: <RouteBase>[
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/age', builder: (_, __) => const AgeSelectionScreen()),
      GoRoute(path: '/home', builder: (_, __) => const HomeShell()),
      GoRoute(
        path: parentGatePath,
        builder: (_, __) => const ParentGateScreen(),
      ),
      GoRoute(
        path: parentPathPrefix,
        builder: (_, __) => const ParentControlScreen(),
      ),
    ],
  );
});
