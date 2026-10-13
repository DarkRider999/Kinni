import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/parent_session.dart';
import '../../design/tokens.dart';

/// Parent gate (SPEC §9.3). Phase-0 uses a deliberate confirmation challenge;
/// a PIN / biometric check via `local_auth` is added in Phase 1. On success it
/// elevates the session and continues to the originally requested route.
class ParentGateScreen extends ConsumerWidget {
  const ParentGateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String redirect = GoRouterState.of(context)
            .uri
            .queryParameters['redirect'] ??
        parentPathPrefixFallback;
    return Scaffold(
      appBar: AppBar(title: const Text('Parents only')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(SbSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                'Ask a grown-up to continue',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SbSpacing.xxl),
              FilledButton(
                onPressed: () {
                  ref.read(parentSessionProvider.notifier).elevate();
                  context.go(redirect);
                },
                child: const Text('I am a grown-up'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Default destination if the gate is reached without a redirect target.
const String parentPathPrefixFallback = '/parent';
