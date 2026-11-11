import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/launcher_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../common/date_time_picker.dart';

/// Click-to-call (FR CALL-01). Remembers the pending call so the outcome
/// sheet opens when Anjali returns to the app (see MainShell).
Future<void> startCall(BuildContext context, WidgetRef ref, Client c) async {
  if (c.wrongNumber) {
    final go = await confirm(context, title: 'Number flagged', message: '${c.phone} was marked as a wrong number. Call anyway?', ok: 'Call');
    if (!go) return;
  }
  await ref.read(crmActionsProvider).setPendingCall(c.id);
  final ok = await Launcher.call(c.phone);
  if (!ok) {
    await ref.read(crmActionsProvider).setPendingCall(null);
    if (context.mounted) showSnack(context, 'Could not open the dialer', error: true);
  }
}

/// After-call popup (FR CALL-02/03).
Future<void> showCallOutcomeSheet(BuildContext context, WidgetRef ref, Client c) async {
  final note = TextEditingController();
  const icons = {
    CallOutcome.interested: (Icons.thumb_up_alt_rounded, AppColors.success),
    CallOutcome.callBack: (Icons.phone_callback_rounded, AppColors.primary),
    CallOutcome.noAnswer: (Icons.phone_missed_rounded, AppColors.warning),
    CallOutcome.rejected: (Icons.thumb_down_alt_rounded, AppColors.danger),
    CallOutcome.wrongNumber: (Icons.phonelink_erase_rounded, Color(0xFF64748B)),
  };
  final outcome = await showModalBottomSheet<CallOutcome>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(ctx).bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('How did the call with ${c.name} go?', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final o in CallOutcome.values)
                ActionChip(
                  avatar: Icon(icons[o]!.$1, color: icons[o]!.$2, size: 20),
                  label: Text(o.label),
                  onPressed: () => Navigator.pop(ctx, o),
                ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(controller: note, maxLines: 2, decoration: const InputDecoration(labelText: 'Call notes (optional)')),
          const SizedBox(height: 6),
          Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Skip'))),
        ],
      ),
    ),
  );
  await ref.read(crmActionsProvider).setPendingCall(null);
  if (outcome == null || !context.mounted) return;

  DateTime? when;
  if (outcome == CallOutcome.callBack) {
    when = await pickDateTime(context, title: 'When should you call back?');
  }
  final current = ref.read(clientByIdProvider(c.id)) ?? c;
  final effect = await ref
      .read(crmActionsProvider)
      .logCall(current, outcome, note: note.text.trim().isEmpty ? null : note.text.trim(), followupAt: when);
  if (!context.mounted) return;
  final parts = <String>['Call logged: ${outcome.label}'];
  if (effect.newStatus != null) parts.add('status → ${effect.newStatus!.label}');
  final scheduled = when ?? (effect.askForFollowup ? null : effect.suggestFollowupAt);
  if (scheduled != null) parts.add('followup ${Fmt.dateTime(scheduled)}');
  showSnack(context, parts.join(' · '));
}
