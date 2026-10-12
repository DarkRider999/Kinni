import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/celebration.dart';
import '../../core/widgets/common.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../providers/crm_actions.dart';

/// Status picker used by long-press on a client card. Approved and
/// Disbursed ask for the amount and celebrate.
Future<void> showStatusChangeSheet(BuildContext context, WidgetRef ref, Client c) async {
  final s = await showModalBottomSheet<LeadStatus>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text('Change status · ${c.name}', style: const TextStyle(fontWeight: FontWeight.w800))),
          for (final s in LeadStatus.values)
            ListTile(
              leading: Icon(Icons.circle, size: 14, color: AppColors.status(s)),
              title: Text(s.label),
              trailing: s == c.status ? const Icon(Icons.check_rounded) : null,
              onTap: () => Navigator.pop(ctx, s),
            ),
        ]),
      ),
    ),
  );
  if (s == null || s == c.status || !context.mounted) return;
  double? amount;
  if (s.isConverted) {
    final ctrl = TextEditingController(text: (c.approvedAmount ?? c.requestedAmount)?.toStringAsFixed(0) ?? '');
    final v = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(s == LeadStatus.disbursed ? 'Disbursed amount (AED)' : 'Approved amount (AED)'),
        content: TextField(controller: ctrl, keyboardType: TextInputType.number, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, ''), child: const Text('Skip')),
          FilledButton(onPressed: () => Navigator.pop(d, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
    amount = Validators.parseAmount(v);
  }
  await ref.read(crmActionsProvider).changeStatus(c, s, amount: amount);
  if (!context.mounted) return;
  showSnack(context, '${c.name} → ${s.label}');
  if (s.isConverted) await showCelebration(context, message: s == LeadStatus.disbursed ? 'Loan disbursed! 🎉' : 'Approved! 🎉');
}
