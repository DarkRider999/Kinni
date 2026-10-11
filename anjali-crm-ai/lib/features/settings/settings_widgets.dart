import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/glass_card.dart';

/// Scaffold for a settings sub-page: app bar over the Settings tab
/// background with a scrollable body.
class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.title, required this.children, this.actions, this.floatingActionButton});

  final String title;
  final List<Widget> children;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) => SettingsScaffold(
        title: title,
        actions: actions,
        floatingActionButton: floatingActionButton,
        body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: children),
      );
}

/// Like [SettingsPage] but with a custom body (e.g. a reorderable list).
class SettingsScaffold extends StatelessWidget {
  const SettingsScaffold({super.key, required this.title, required this.body, this.actions, this.floatingActionButton});

  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) => Scaffold(
        extendBodyBehindAppBar: false,
        appBar: AppBar(title: Text(title), actions: actions),
        floatingActionButton: floatingActionButton,
        body: TabBackgroundShim(child: SafeArea(top: false, child: body)),
      );
}

/// The Settings tab background, shared by every settings sub-page.
class TabBackgroundShim extends StatelessWidget {
  const TabBackgroundShim({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = dark ? AppColors.backgroundDark : AppColors.background;
    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: base),
        Opacity(
          opacity: dark ? .08 : .1,
          child: Image.asset(AppAssets.tabBackgrounds[5], fit: BoxFit.cover, alignment: Alignment.topCenter, gaplessPlayback: true),
        ),
        child,
      ],
    );
  }
}

/// A titled glass card grouping related settings rows.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.title, required this.children, this.icon});

  final String title;
  final IconData? icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 18, 6, 8),
            child: Row(
              children: [
                if (icon != null) ...[Icon(icon, size: 18, color: AppColors.primary), const SizedBox(width: 8)],
                Expanded(
                  child: Text(title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: .2)),
                ),
              ],
            ),
          ),
          GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(children: children),
          ),
        ],
      );
}

/// A settings row with a tinted leading icon.
class SettingsTile extends StatelessWidget {
  const SettingsTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.color = AppColors.primary,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        leading: SettingsIcon(icon: icon, color: color),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: subtitle == null ? null : Text(subtitle!),
        trailing: trailing ?? (onTap == null ? null : const Icon(Icons.chevron_right_rounded)),
      );
}

/// Rounded-square tinted icon used as a tile leading.
class SettingsIcon extends StatelessWidget {
  const SettingsIcon({super.key, required this.icon, this.color = AppColors.primary});
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: color, size: 20),
      );
}

/// Short explanatory text inside a group.
class SettingsNote extends StatelessWidget {
  const SettingsNote(this.text, {super.key, this.icon = Icons.info_outline_rounded});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: t.bodySmall?.color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: t.bodySmall)),
        ],
      ),
    );
  }
}

/// Runs [task] behind a modal progress indicator.
Future<T> withProgress<T>(BuildContext context, Future<T> Function() task, {String message = 'Please wait…'}) async {
  final nav = Navigator.of(context, rootNavigator: true);
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => PopScope(
      canPop: false,
      child: AlertDialog(
        content: Row(children: [
          const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.6)),
          const SizedBox(width: 18),
          Expanded(child: Text(message)),
        ]),
      ),
    ),
  );
  try {
    return await task();
  } finally {
    nav.pop();
  }
}

/// Human-readable byte size.
String fileSizeLabel(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
