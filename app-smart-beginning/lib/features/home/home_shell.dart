import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/guards.dart';

/// Child shell with the 7-destination bottom navigation (SPEC §4.3 / §6.1).
/// Phase-0 renders placeholder bodies; the real worlds land in Phase 1–3.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;

  static const List<_Dest> _dests = <_Dest>[
    _Dest('Home', Icons.home_rounded),
    _Dest('Explore', Icons.map_rounded),
    _Dest('Learn', Icons.school_rounded),
    _Dest('Videos', Icons.ondemand_video_rounded),
    _Dest('Music', Icons.music_note_rounded),
    _Dest('Rewards', Icons.emoji_events_rounded),
    _Dest('Profile', Icons.person_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_dests[_index].label),
        actions: <Widget>[
          IconButton(
            tooltip: 'Parent area',
            icon: const Icon(Icons.lock_outline),
            onPressed: () => context.go(parentPathPrefix),
          ),
        ],
      ),
      body: Center(
        child: Text(
          '${_dests[_index].label} — Phase 1',
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (int i) => setState(() => _index = i),
        destinations: <Widget>[
          for (final _Dest d in _dests)
            NavigationDestination(icon: Icon(d.icon), label: d.label),
        ],
      ),
    );
  }
}

class _Dest {
  const _Dest(this.label, this.icon);

  final String label;
  final IconData icon;
}
