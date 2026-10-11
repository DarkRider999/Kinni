import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/followup.dart';
import '../../domain/services/followup_bucketer.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../calls/call_actions.dart';
import '../clients/client_profile_screen.dart';
import '../common/date_time_picker.dart';
import '../whatsapp/whatsapp_button.dart';

/// Followups tab (FR FUP-01…05): six segments, nearest date first.
class FollowupsScreen extends ConsumerWidget {
  const FollowupsScreen({super.key});

  static const _order = [
    FollowupBucket.today,
    FollowupBucket.tomorrow,
    FollowupBucket.thisWeek,
    FollowupBucket.upcoming,
    FollowupBucket.overdue,
    FollowupBucket.completed,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider);
    final clients = {for (final c in ref.watch(clientsProvider).value ?? const <Client>[]) c.id: c};
    final all = (ref.watch(followupsProvider).value ?? const <Followup>[]).where((f) => clients.containsKey(f.clientId)).toList();
    final buckets = FollowupBucketer.bucket(all, now);

    return DefaultTabController(
      length: _order.length,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        floatingActionButton: Padding(
          padding: const EdgeInsets.only(bottom: 76),
          child: FloatingActionButton.extended(
            heroTag: 'new_followup',
            onPressed: () => _newFollowup(context, ref, clients.values.toList()),
            icon: const Icon(Icons.add_alarm_rounded),
            label: const Text('New followup'),
          ),
        ),
        body: TabBackground(
          image: AppAssets.tabBackgrounds[3],
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
                  child: Row(children: [
                    Text('Followups', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                    const Spacer(),
                    if (buckets[FollowupBucket.overdue]!.isNotEmpty)
                      Pill(label: '${buckets[FollowupBucket.overdue]!.length} overdue', color: AppColors.danger, icon: Icons.alarm_rounded),
                  ]),
                ),
                TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  tabs: [
                    for (final b in _order)
                      Tab(
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Text(b.label),
                          const SizedBox(width: 6),
                          _CountBadge(buckets[b]!.length, danger: b == FollowupBucket.overdue),
                        ]),
                      ),
                  ],
                ),
                Expanded(
                  child: TabBarView(
                    children: [
                      for (final b in _order)
                        buckets[b]!.isEmpty
                            ? EmptyState(
                                icon: b == FollowupBucket.overdue ? Icons.verified_rounded : Icons.event_available_rounded,
                                title: b == FollowupBucket.overdue ? 'Nothing overdue. Well done!' : 'No followups here',
                                message: b == FollowupBucket.completed ? null : 'Schedule one from a client profile or with the button below.',
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.fromLTRB(16, 12, 16, 160),
                                itemCount: buckets[b]!.length,
                                itemBuilder: (_, i) {
                                  final f = buckets[b]![i];
                                  return FollowupCard(followup: f, client: clients[f.clientId]!, now: now);
                                },
                              ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _newFollowup(BuildContext context, WidgetRef ref, List<Client> clients) async {
    final client = await pickClient(context, clients.where((c) => c.status.isOpen).toList());
    if (client == null || !context.mounted) return;
    final when = await pickDateTime(context, title: 'Followup with ${client.name}');
    if (when == null || !context.mounted) return;
    final note = await _askNote(context, title: 'Followup note (optional)');
    if (!context.mounted) return;
    await ref.read(crmActionsProvider).scheduleFollowup(client.id, when, note: note);
    if (context.mounted) showSnack(context, 'Followup scheduled for ${Fmt.dateTime(when)}');
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge(this.count, {this.danger = false});
  final int count;
  final bool danger;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
        decoration: BoxDecoration(
          color: (danger && count > 0 ? AppColors.danger : AppColors.primary).withValues(alpha: .15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text('$count', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: danger && count > 0 ? AppColors.danger : AppColors.primary)),
      );
}

Future<String?> _askNote(BuildContext context, {required String title, String? initial}) async {
  final c = TextEditingController(text: initial);
  final r = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: TextField(controller: c, autofocus: true, maxLines: 3, textCapitalization: TextCapitalization.sentences),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, ''), child: const Text('Skip')),
        FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Save')),
      ],
    ),
  );
  return (r == null || r.isEmpty) ? null : r;
}

/// Searchable client picker bottom sheet.
Future<Client?> pickClient(BuildContext context, List<Client> clients) {
  final sorted = [...clients]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  return showModalBottomSheet<Client>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      var query = '';
      return StatefulBuilder(
        builder: (ctx, setState) {
          final q = query.toLowerCase();
          final list = sorted.where((c) => q.isEmpty || c.name.toLowerCase().contains(q) || c.phone.contains(q)).toList();
          return SizedBox(
            height: MediaQuery.sizeOf(ctx).height * .75,
            child: Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
              child: Column(children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: TextField(
                    autofocus: true,
                    decoration: const InputDecoration(hintText: 'Search clients', prefixIcon: Icon(Icons.search)),
                    onChanged: (v) => setState(() => query = v),
                  ),
                ),
                Expanded(
                  child: list.isEmpty
                      ? const Center(child: Text('No matching clients'))
                      : ListView.builder(
                          itemCount: list.length,
                          itemBuilder: (_, i) => ListTile(
                            leading: PersonAvatar(photoPath: list[i].photoPath, initials: list[i].initials, size: 38),
                            title: Text(list[i].name),
                            subtitle: Text('${list[i].phone} · ${list[i].status.label}'),
                            onTap: () => Navigator.pop(ctx, list[i]),
                          ),
                        ),
                ),
              ]),
            ),
          );
        },
      );
    },
  );
}

/// One followup with Call / WhatsApp / Reschedule / Complete actions.
class FollowupCard extends ConsumerWidget {
  const FollowupCard({super.key, required this.followup, required this.client, required this.now});
  final Followup followup;
  final Client client;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final f = followup;
    final t = Theme.of(context).textTheme;
    final overdue = f.isOverdue(now);
    final done = !f.isPending;
    final accent = done ? AppColors.success : overdue ? AppColors.danger : AppColors.primary;
    final actions = ref.read(crmActionsProvider);

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 6),
      color: overdue ? AppColors.danger.withValues(alpha: .07) : null,
      onTap: () => ClientProfileScreen.open(context, client.id),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PersonAvatar(photoPath: client.photoPath, initials: client.initials, size: 42),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(client.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                    Text(
                      done
                          ? 'Completed ${Fmt.dateTime(f.completedAt ?? f.dueAt)}'
                          : '${Fmt.dateTime(f.dueAt)} · ${Fmt.relative(f.dueAt, now)}',
                      style: t.bodySmall?.copyWith(color: accent, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              StatusChip(client.status, dense: true),
              PopupMenuButton<String>(
                onSelected: (v) async {
                  if (v == 'delete' &&
                      await confirm(context, title: 'Delete followup?', message: 'Its reminders will be cancelled.', ok: 'Delete', destructive: true)) {
                    await actions.deleteFollowup(f);
                  }
                },
                itemBuilder: (_) => const [PopupMenuItem(value: 'delete', child: Text('Delete'))],
              ),
            ],
          ),
          if (f.note != null && f.note!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8, right: 8),
              child: Text(f.note!, style: t.bodyMedium),
            ),
          Row(
            children: [
              WhatsAppIcon(phone: client.whatsappNumber, client: client),
              Expanded(child: Text(client.phone, overflow: TextOverflow.ellipsis, style: t.bodySmall)),
              if (!done) ...[
                IconButton(
                  tooltip: 'Call',
                  icon: const Icon(Icons.call_rounded, color: AppColors.primary),
                  onPressed: () => startCall(context, ref, client),
                ),
                IconButton(
                  tooltip: 'Reschedule',
                  icon: const Icon(Icons.update_rounded, color: AppColors.warning),
                  onPressed: () async {
                    final when = await pickDateTime(context, initial: f.dueAt, title: 'Reschedule followup');
                    if (when == null) return;
                    await actions.rescheduleFollowup(f, when);
                    if (context.mounted) showSnack(context, 'Moved to ${Fmt.dateTime(when)}');
                  },
                ),
                IconButton(
                  tooltip: 'Mark complete',
                  icon: const Icon(Icons.check_circle_rounded, color: AppColors.success),
                  onPressed: () async {
                    final note = await _askNote(context, title: 'Outcome (optional)', initial: f.note);
                    await actions.completeFollowup(f, outcomeNote: note);
                    if (context.mounted) showSnack(context, 'Followup completed');
                  },
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
