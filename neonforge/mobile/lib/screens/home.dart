import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';
import 'batches.dart';
import 'editor.dart';
import 'settings.dart';
import 'upload.dart';

/// Bottom-nav shell: Home · Batch · Settings (spec §2.2).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _tab, children: const [HomeTab(), BatchesScreen(), SettingsScreen()]),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.layers_outlined), label: 'Batch'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'Settings'),
        ],
      ),
    );
  }
}

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});
  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  Future<List<MediaFile>>? _files;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _files ??= SessionScope.of(context).api.files();
  }

  Future<void> _refresh() async {
    final f = SessionScope.of(context).api.files();
    setState(() {
      _files = f;
    });
    await f;
  }

  void _open(String mode, {String? tool}) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => UploadScreen(batch: mode == 'batch', tool: tool)));
    if (mounted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final me = SessionScope.of(context).me!;
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Hi ${me.displayName}', style: Theme.of(context).textTheme.headlineSmall, overflow: TextOverflow.ellipsis),
              const Text('What are we creating today?', style: TextStyle(color: NF.text2)),
            ]),
          ),
          const CreditRing(),
        ]),
        const SizedBox(height: 16),
        _Hero(
          key: const Key('single-edit'),
          icon: Icons.auto_awesome,
          color: NF.cyan,
          title: 'Single Edit',
          subtitle: 'One photo or video with live preview',
          onTap: () => _open('single'),
        ),
        const SizedBox(height: 12),
        _Hero(
          key: const Key('batch-edit'),
          icon: Icons.layers,
          color: NF.magenta,
          title: 'Batch Edit',
          subtitle: 'Apply one recipe to many files · up to ${me.plan.maxBatchFiles} per batch',
          onTap: () => _open('batch'),
        ),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final (label, icon, tool) in const [
            ('Enhance', Icons.auto_fix_high, 'enhance'),
            ('Upscale', Icons.photo_size_select_large, 'upscale'),
            ('Background', Icons.crop, 'background'),
            ('Retouch', Icons.face_retouching_natural, 'face'),
            ('Color grade', Icons.palette_outlined, 'color'),
            ('Stabilize', Icons.video_stable, 'motion'),
          ])
            ActionChip(avatar: Icon(icon, size: 16), label: Text(label), onPressed: () => _open('single', tool: tool)),
        ]),
        const SizedBox(height: 24),
        const Text('RECENT FILES', style: TextStyle(color: NF.text2, letterSpacing: 1.2, fontSize: 12)),
        const SizedBox(height: 8),
        FutureBuilder<List<MediaFile>>(
          future: _files,
          builder: (context, snap) {
            if (!snap.hasData) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
            final files = snap.data!;
            if (files.isEmpty) {
              return const Card(
                  child: Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No files yet', style: TextStyle(color: NF.text2)))));
            }
            return GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                for (final f in files.take(30))
                  InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EditorScreen(fileId: f.id))),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Stack(fit: StackFit.expand, children: [
                        if (f.thumbUrl != null) Image.network(f.thumbUrl!, fit: BoxFit.cover),
                        Positioned(
                          top: 6,
                          left: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(99)),
                            child: Text(f.kind == 'image' ? 'IMG' : f.kind == 'video' ? 'VID' : 'GIF',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ]),
                    ),
                  ),
              ],
            );
          },
        ),
      ]),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({super.key, required this.icon, required this.color, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final Color color;
  final String title, subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NF.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: NF.borderStrong)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: RadialGradient(
                center: const Alignment(0.9, 0.9), radius: 1.1, colors: [color.withValues(alpha: 0.22), Colors.transparent]),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(color: NF.text2)),
          ]),
        ),
      ),
    );
  }
}
