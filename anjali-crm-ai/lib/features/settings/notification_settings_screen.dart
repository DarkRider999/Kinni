import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/notification_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/common.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../motivation/motivation_dialog.dart';
import 'settings_widgets.dart';

/// Reminder offsets (max 4), daily motivation and notification permission.
class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  /// Offset (minutes before the followup) → label.
  static const options = <int, String>{1440: '1 day before', 180: '3 h before', 60: '1 h before', 30: '30 min before', 15: '15 min before', 0: 'At time'};
  static const maxOffsets = 4;

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  late Set<int> _offsets = ref.read(settingsStoreProvider).reminderOffsets.toSet();
  late bool _motivation = ref.read(settingsStoreProvider).motivationEnabled;

  Future<void> _toggleOffset(int minutes, bool on) async {
    final next = {..._offsets};
    if (on) {
      if (next.length >= NotificationSettingsScreen.maxOffsets) {
        showSnack(context, 'Choose up to ${NotificationSettingsScreen.maxOffsets} reminders');
        return;
      }
      next.add(minutes);
    } else {
      if (next.length == 1) {
        showSnack(context, 'Keep at least one reminder');
        return;
      }
      next.remove(minutes);
    }
    setState(() => _offsets = next);
    await ref.read(settingsStoreProvider).setReminderOffsets(next.toList()..sort((a, b) => b.compareTo(a)));
    await ref.read(crmActionsProvider).rescheduleAllReminders();
  }

  Future<void> _preview() async {
    final m = await ref.read(crmActionsProvider).nextMotivation();
    if (!mounted || m == null) return;
    await MotivationDialog.show(context, m, name: ref.read(profileProvider).firstName);
  }

  @override
  Widget build(BuildContext context) => SettingsPage(
        title: 'Notifications',
        children: [
          SettingsGroup(title: 'Followup reminders', icon: Icons.alarm_rounded, children: [
            const SettingsNote('Choose when to be reminded before each followup (up to 4). Existing reminders are rescheduled.'),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final e in NotificationSettingsScreen.options.entries)
                    FilterChip(
                      label: Text(e.value),
                      selected: _offsets.contains(e.key),
                      onSelected: (v) => _toggleOffset(e.key, v),
                    ),
                ],
              ),
            ),
          ]),
          SettingsGroup(title: 'Daily motivation', icon: Icons.auto_awesome_rounded, children: [
            SwitchListTile(
              secondary: const SettingsIcon(icon: Icons.wb_sunny_outlined, color: AppColors.gold),
              title: const Text('Show a daily message', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Once a day when you open the app'),
              value: _motivation,
              onChanged: (v) async {
                setState(() => _motivation = v);
                await ref.read(settingsStoreProvider).setMotivationEnabled(v);
              },
            ),
            SettingsTile(
              icon: Icons.visibility_outlined,
              color: AppColors.secondary,
              title: 'Preview a message',
              subtitle: _motivation ? null : 'Turn on daily motivation first',
              onTap: _motivation ? _preview : null,
            ),
          ]),
          SettingsGroup(title: 'Permission', icon: Icons.notifications_none_rounded, children: [
            SettingsTile(
              icon: Icons.notifications_active_outlined,
              title: 'Request notification permission',
              subtitle: 'Needed for reminders and exact alarms',
              onTap: () async {
                await NotificationService.instance.requestPermissions();
                if (context.mounted) showSnack(context, 'Permission request sent');
              },
            ),
          ]),
        ],
      );
}
