import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/common.dart';
import '../../data/remote/sync_service.dart';
import '../../providers/app_providers.dart';

/// Compact Synced / Pending Sync / Sync Failed badge. Tapping it starts a
/// sync when cloud sync is set up.
class SyncStatusChip extends ConsumerWidget {
  const SyncStatusChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final indicator = ref.watch(syncIndicatorProvider);
    final status = ref.watch(syncStatusProvider).value ?? SyncStatus.idle;
    final pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    final (label, color, icon) = switch (indicator) {
      SyncIndicator.synced => ('Synced', AppColors.success, Icons.cloud_done_rounded),
      SyncIndicator.pending => (pending > 0 ? 'Pending Sync · $pending' : 'Syncing…', AppColors.warning, Icons.cloud_upload_rounded),
      SyncIndicator.failed => ('Sync Failed', AppColors.danger, Icons.cloud_off_rounded),
    };
    final hint = switch (status) {
      SyncStatus.notConfigured => 'Cloud sync is not set up. Data is safe on this device.',
      SyncStatus.disabled => 'Cloud sync is turned off in Settings.',
      SyncStatus.offline => 'Offline. Changes will sync when you are back online.',
      SyncStatus.error => 'Last sync failed. Tap to retry.',
      _ => label,
    };
    return Tooltip(
      message: hint,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () {
          final s = ref.read(syncServiceProvider);
          if (s.isConfigured) {
            s.requestSync();
            showSnack(context, 'Sync requested');
          } else {
            showSnack(context, hint);
          }
        },
        child: Pill(label: label, color: color, icon: icon, dense: true),
      ),
    );
  }
}
