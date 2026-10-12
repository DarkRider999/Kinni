import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/parent_session.dart';
import '../../design/tokens.dart';

/// Parent Control Dashboard (SPEC §10.22). Phase-0 lists the sections and
/// provides the exit-to-child-mode action; each section is built out in later
/// phases. Reached only through the parent gate (enforced by the router guard).
class ParentControlScreen extends ConsumerWidget {
  const ParentControlScreen({super.key});

  static const List<String> _sections = <String>[
    'Learning Analytics',
    'Screen Time',
    'Content Filters',
    'Video Permissions',
    'Download Permissions',
    'Language Controls',
    'Notifications',
    'Reports',
    'Subscription',
    'Export Data',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Parent Control'),
        actions: <Widget>[
          IconButton(
            tooltip: 'Exit parent area',
            icon: const Icon(Icons.logout),
            onPressed: () {
              ref.read(parentSessionProvider.notifier).clear();
              context.go('/home');
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(SbSpacing.lg),
        children: <Widget>[
          for (final String section in _sections)
            Card(
              child: ListTile(
                title: Text(section),
                trailing: const Icon(Icons.chevron_right),
              ),
            ),
        ],
      ),
    );
  }
}
