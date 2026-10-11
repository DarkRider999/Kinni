import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../providers/app_providers.dart';
import '../../providers/lock_controller.dart';
import 'about_screen.dart';
import 'data_screens.dart';
import 'notification_settings_screen.dart';
import 'product_manager_screen.dart';
import 'profile_screen.dart';
import 'security_screens.dart';
import 'settings_widgets.dart';

/// Settings tab (FR-SET): profile, appearance, security, notifications,
/// products, data (export / backup / sync / sample data) and app info.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  void _open(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final mode = ref.watch(themeModeProvider);
    final t = Theme.of(context).textTheme;
    final initials = profile.name.trim().isEmpty
        ? 'A'
        : profile.name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    return TabBackground(
      image: AppAssets.tabBackgrounds[5],
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          children: [
            Text('Settings', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            GlassCard(
              onTap: () => _open(context, const ProfileScreen()),
              child: Row(
                children: [
                  PersonAvatar(photoPath: profile.photoPath, initials: initials, size: 60, heroTag: 'profile-photo'),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(profile.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(profile.mobile.isEmpty ? 'Add your mobile number' : profile.mobile,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall),
                      ],
                    ),
                  ),
                  const Icon(Icons.edit_rounded, size: 20, color: AppColors.primary),
                ],
              ),
            ),
            SettingsGroup(
              title: 'Appearance',
              icon: Icons.palette_outlined,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<ThemeMode>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_rounded), label: Text('System')),
                        ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_rounded), label: Text('Light')),
                        ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_rounded), label: Text('Dark')),
                      ],
                      selected: {mode},
                      onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).set(s.first),
                    ),
                  ),
                ),
              ],
            ),
            SettingsGroup(
              title: 'Security & notifications',
              icon: Icons.shield_outlined,
              children: [
                SettingsTile(
                  icon: Icons.lock_outline_rounded,
                  title: 'Security',
                  subtitle: 'PIN, pattern, biometrics, auto-lock',
                  onTap: () => _open(context, const SecurityScreen()),
                ),
                SettingsTile(
                  icon: Icons.notifications_active_outlined,
                  color: AppColors.secondary,
                  title: 'Notifications',
                  subtitle: 'Reminder times, daily motivation',
                  onTap: () => _open(context, const NotificationSettingsScreen()),
                ),
              ],
            ),
            SettingsGroup(
              title: 'CRM',
              icon: Icons.category_outlined,
              children: [
                SettingsTile(
                  icon: Icons.inventory_2_outlined,
                  color: AppColors.chart[2],
                  title: 'Products',
                  subtitle: 'Add, edit, reorder loan products',
                  onTap: () => _open(context, const ProductManagerScreen()),
                ),
              ],
            ),
            SettingsGroup(
              title: 'Data',
              icon: Icons.storage_rounded,
              children: [
                SettingsTile(
                  icon: Icons.file_download_outlined,
                  color: AppColors.success,
                  title: 'Export data',
                  subtitle: 'Excel or PDF report',
                  onTap: () => _open(context, const ExportScreen()),
                ),
                SettingsTile(
                  icon: Icons.backup_outlined,
                  color: AppColors.info,
                  title: 'Backup & restore',
                  subtitle: 'Local encrypted-data backups',
                  onTap: () => _open(context, const BackupScreen()),
                ),
                SettingsTile(
                  icon: Icons.cloud_sync_outlined,
                  color: AppColors.chart[5],
                  title: 'Cloud sync',
                  subtitle: 'Firebase sync status',
                  onTap: () => _open(context, const CloudSyncScreen()),
                ),
                SettingsTile(
                  icon: Icons.science_outlined,
                  color: AppColors.warning,
                  title: 'Sample data',
                  subtitle: 'Load or clear demo clients',
                  onTap: () => _open(context, const SampleDataScreen()),
                ),
              ],
            ),
            SettingsGroup(
              title: 'About',
              icon: Icons.info_outline_rounded,
              children: [
                SettingsTile(
                  icon: Icons.favorite_outline_rounded,
                  color: AppColors.secondary,
                  title: AppInfo.name,
                  subtitle: 'Version, licences, privacy',
                  onTap: () => _open(context, const AboutScreen()),
                ),
              ],
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), foregroundColor: AppColors.danger),
              onPressed: () => ref.read(lockControllerProvider.notifier).lock(),
              icon: const Icon(Icons.lock_rounded),
              label: const Text('Lock now'),
            ),
          ],
        ),
      ),
    );
  }
}
