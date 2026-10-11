import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:share_plus/share_plus.dart';

import '../../core/services/file_storage_service.dart';
import '../../core/services/launcher_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../data/export/pdf_exporter.dart';
import '../../domain/entities/activity.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/followup.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../calls/call_actions.dart';
import '../common/date_time_picker.dart';
import '../documents/documents_tab.dart';
import '../voice_notes/voice_notes_tab.dart';
import '../whatsapp/whatsapp_button.dart';
import 'client_form_screen.dart';

/// Full customer profile.
class ClientProfileScreen extends ConsumerWidget {
  const ClientProfileScreen({super.key, required this.clientId});
  final String clientId;

  /// Pushes the profile for [clientId].
  static Future<void> open(BuildContext context, String clientId) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientProfileScreen(clientId: clientId)));

  static const _tabs = ['Timeline', 'Notes', 'Documents', 'Calls', 'Followups', 'Files'];

  Future<void> _delete(BuildContext context, WidgetRef ref, Client c) async {
    final ok = await confirm(
      context,
      title: 'Delete ${c.name}?',
      message: 'The client and their followups are removed. You can restore them from a backup.',
      ok: 'Delete',
      destructive: true,
    );
    if (!ok || !context.mounted) return;
    await ref.read(crmActionsProvider).deleteClient(c);
    if (context.mounted) {
      Navigator.of(context).pop();
      showSnack(context, '${c.name} deleted');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(clientByIdProvider(clientId));
    if (c == null) {
      final loading = ref.watch(clientsProvider).isLoading;
      return Scaffold(
        appBar: AppBar(),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : const EmptyState(icon: Icons.person_off_rounded, title: 'Client not found', message: 'This client may have been deleted or merged.'),
      );
    }
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text(c.name, overflow: TextOverflow.ellipsis),
          actions: [
            IconButton(
              tooltip: 'Edit',
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientFormScreen(existing: c))),
              icon: const Icon(Icons.edit_rounded),
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'delete') _delete(context, ref, c);
              },
              itemBuilder: (_) => const [
                PopupMenuItem(
                  value: 'delete',
                  child: ListTile(leading: Icon(Icons.delete_outline_rounded, color: AppColors.danger), title: Text('Delete client')),
                ),
              ],
            ),
          ],
        ),
        body: NestedScrollView(
          headerSliverBuilder: (_, _) => [
            SliverToBoxAdapter(child: _Header(client: c)),
            SliverPersistentHeader(
              pinned: true,
              delegate: _TabBarDelegate(
                TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  tabs: [for (final t in _tabs) Tab(text: t)],
                ),
                Theme.of(context).scaffoldBackgroundColor,
              ),
            ),
          ],
          body: TabBarView(
            children: [
              _TimelineTab(clientId: c.id),
              VoiceNotesTab(clientId: c.id),
              DocumentsTab(clientId: c.id),
              _CallsTab(client: c),
              _FollowupsTab(client: c),
              _FilesTab(client: c),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  _TabBarDelegate(this.tabBar, this.background);
  final TabBar tabBar;
  final Color background;

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => ColoredBox(color: background, child: tabBar);

  @override
  bool shouldRebuild(_TabBarDelegate old) => old.tabBar != tabBar || old.background != background;
}

// ── Header ──────────────────────────────────────────────────────────────────

class _Header extends ConsumerWidget {
  const _Header({required this.client});
  final Client client;

  Future<void> _openMap(BuildContext context) async {
    final c = client;
    if (c.hasLocation) {
      await Launcher.navigate(c.latitude!, c.longitude!);
    } else if ((c.location ?? '').trim().isNotEmpty) {
      await Launcher.mapSearch(c.location!);
    } else if (context.mounted) {
      showSnack(context, 'No location saved. Edit the client to add one.');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = client;
    final t = Theme.of(context).textTheme;
    final product = ref.watch(productNamesProvider)[c.productId];
    final score = ref.watch(scoresProvider)[c.id] ?? 0;
    final sub = [c.jobTitle, c.company].whereType<String>().where((s) => s.trim().isNotEmpty).join(' · ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    PersonAvatar(photoPath: c.photoPath, initials: c.initials, size: 72, heroTag: 'avatar-${c.id}'),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.name, style: t.titleLarge?.copyWith(fontWeight: FontWeight.w800), maxLines: 2, overflow: TextOverflow.ellipsis),
                          if (sub.isNotEmpty) Text(sub, style: t.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              StatusChip(c.status, dense: true),
                              Pill(label: c.priority.label, color: AppColors.priority(c.priority), dense: true),
                              if (c.wrongNumber) const Pill(label: 'Wrong number', color: AppColors.danger, dense: true, icon: Icons.phonelink_erase_rounded),
                            ],
                          ),
                          if (c.rating > 0) Padding(padding: const EdgeInsets.only(top: 6), child: RatingStars(value: c.rating, size: 16)),
                        ],
                      ),
                    ),
                    ScoreBadge(score, size: 44),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 16,
                  runSpacing: 6,
                  children: [
                    _Fact(icon: Icons.category_rounded, text: product ?? 'No product'),
                    if (c.monthlySalary != null) _Fact(icon: Icons.payments_rounded, text: '${Fmt.aed(c.monthlySalary)}/mo'),
                    if (c.requestedAmount != null) _Fact(icon: Icons.request_quote_rounded, text: 'Req. ${Fmt.aed(c.requestedAmount)}'),
                    if (c.approvedAmount != null) _Fact(icon: Icons.verified_rounded, text: 'Appr. ${Fmt.aed(c.approvedAmount)}'),
                    if (c.disbursedAmount != null) _Fact(icon: Icons.account_balance_rounded, text: 'Disb. ${Fmt.aed(c.disbursedAmount)}'),
                    if (c.nationality != null) _Fact(icon: Icons.flag_rounded, text: c.nationality!),
                  ],
                ),
                const Divider(height: 20),
                PhoneWithActions(phone: c.phone, client: c, label: 'Phone', onCall: () => startCall(context, ref, c)),
                if (c.whatsapp != null && c.whatsapp!.trim().isNotEmpty && c.whatsapp != c.phone)
                  PhoneWithActions(phone: c.whatsapp!, client: c, label: 'WhatsApp'),
                if (c.email != null)
                  InkWell(
                    onTap: () => Launcher.email(c.email!),
                    child: Padding(padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10), child: _Fact(icon: Icons.email_rounded, text: c.email!)),
                  ),
                if (c.location != null || c.hasLocation)
                  InkWell(
                    onTap: () => _openMap(context),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
                      child: _Fact(icon: Icons.place_rounded, text: c.location ?? 'Pinned on map'),
                    ),
                  ),
                if (c.remarks != null && c.remarks!.trim().isNotEmpty)
                  Padding(padding: const EdgeInsets.fromLTRB(10, 6, 10, 0), child: Text(c.remarks!, style: t.bodySmall)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _ActionButton(icon: Icons.call_rounded, label: 'Call', color: AppColors.success, onTap: () => startCall(context, ref, c)),
              _ActionButton(
                icon: Icons.chat_rounded,
                label: 'WhatsApp',
                color: whatsappGreen,
                onTap: () => openWhatsApp(context, ref, c.whatsappNumber, client: c),
              ),
              _ActionButton(icon: Icons.map_rounded, label: 'Map', color: AppColors.info, onTap: () => _openMap(context)),
              _ActionButton(
                icon: Icons.edit_rounded,
                label: 'Edit',
                color: AppColors.primary,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientFormScreen(existing: c))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _StatusStepper(client: c),
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 6),
          Flexible(child: Text(text, style: Theme.of(context).textTheme.bodyMedium, overflow: TextOverflow.ellipsis)),
        ],
      );
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.icon, required this.label, required this.color, required this.onTap});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 10),
            radius: 16,
            onTap: onTap,
            child: Column(
              children: [
                Icon(icon, color: color),
                const SizedBox(height: 4),
                FittedBox(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
              ],
            ),
          ),
        ),
      );
}

// ── Status ──────────────────────────────────────────────────────────────────

/// Pipeline stepper plus the "Change status" sheet (FR PRO-03).
class _StatusStepper extends ConsumerWidget {
  const _StatusStepper({required this.client});
  final Client client;

  Future<void> _change(BuildContext context, WidgetRef ref) async {
    final c = client;
    final s = await showModalBottomSheet<LeadStatus>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(title: Text('Change status', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
              for (final s in LeadStatus.values)
                ListTile(
                  leading: Icon(Icons.circle, size: 14, color: AppColors.status(s)),
                  title: Text(s.label),
                  trailing: s == c.status ? const Icon(Icons.check_rounded) : null,
                  onTap: () => Navigator.pop(ctx, s),
                ),
            ],
          ),
        ),
      ),
    );
    if (s == null || !context.mounted) return;
    double? amount;
    if (s == LeadStatus.approved || s == LeadStatus.disbursed) {
      final prefill = s == LeadStatus.approved ? (c.approvedAmount ?? c.requestedAmount) : (c.disbursedAmount ?? c.approvedAmount);
      final r = await _askAmount(context, s == LeadStatus.approved ? 'Approved amount (AED)' : 'Disbursed amount (AED)', prefill);
      if (r == null || !context.mounted) return;
      amount = r.isEmpty ? null : Validators.parseAmount(r);
    } else if (s == c.status) {
      return;
    }
    await ref.read(crmActionsProvider).changeStatus(c, s, amount: amount);
    if (context.mounted) showSnack(context, 'Status → ${s.label}');
  }

  /// Returns the entered text ('' to skip), or null when cancelled.
  Future<String?> _askAmount(BuildContext context, String label, double? prefill) async {
    final ctrl = TextEditingController(text: prefill == null ? '' : prefill.toStringAsFixed(0));
    final key = GlobalKey<FormState>();
    final r = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(label),
        content: Form(
          key: key,
          child: TextFormField(
            controller: ctrl,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(hintText: 'Amount', prefixText: 'AED '),
            validator: Validators.optionalAmount,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (key.currentState?.validate() ?? false) Navigator.pop(c, ctrl.text.trim());
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    return r;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = client;
    final idx = c.status.pipelineIndex;
    final t = Theme.of(context).textTheme;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Pipeline', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
              if (idx < 0) StatusChip(c.status, dense: true),
              TextButton.icon(onPressed: () => _change(context, ref), icon: const Icon(Icons.swap_horiz_rounded), label: const Text('Change status')),
            ],
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (var i = 0; i < LeadStatus.pipeline.length; i++) ...[
                  if (i > 0)
                    Container(
                      width: 18,
                      height: 2,
                      color: (idx >= i ? AppColors.status(LeadStatus.pipeline[i]) : Colors.grey).withValues(alpha: idx >= i ? 1 : .3),
                    ),
                  _Step(status: LeadStatus.pipeline[i], done: idx >= i, current: idx == i),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('Since ${Fmt.date(c.statusChangedAt)}', style: t.bodySmall),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.status, required this.done, required this.current});
  final LeadStatus status;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.status(status);
    return SizedBox(
      width: 64,
      child: Column(
        children: [
          Container(
            width: current ? 26 : 20,
            height: current ? 26 : 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? color : Colors.transparent,
              border: Border.all(color: done ? color : Colors.grey.withValues(alpha: .5), width: 2),
            ),
            child: done ? const Icon(Icons.check_rounded, size: 14, color: Colors.white) : null,
          ),
          const SizedBox(height: 4),
          Text(
            status.label,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: TextStyle(fontSize: 10, fontWeight: current ? FontWeight.w800 : FontWeight.w500, color: done ? color : null),
          ),
        ],
      ),
    );
  }
}

// ── Tabs ────────────────────────────────────────────────────────────────────

class _TimelineTab extends ConsumerWidget {
  const _TimelineTab({required this.clientId});
  final String clientId;

  static IconData _icon(ActivityType t) => switch (t) {
        ActivityType.created => Icons.person_add_alt_1_rounded,
        ActivityType.updated => Icons.edit_rounded,
        ActivityType.statusChanged => Icons.flag_rounded,
        ActivityType.call => Icons.call_rounded,
        ActivityType.whatsapp => Icons.chat_rounded,
        ActivityType.followupScheduled => Icons.event_rounded,
        ActivityType.followupCompleted => Icons.event_available_rounded,
        ActivityType.document => Icons.description_rounded,
        ActivityType.voiceNote => Icons.mic_rounded,
        ActivityType.merged => Icons.merge_rounded,
        ActivityType.report => Icons.picture_as_pdf_rounded,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(clientActivitiesProvider(clientId));
    if (items.isEmpty) return const EmptyState(icon: Icons.timeline_rounded, title: 'No activity yet');
    final t = Theme.of(context).textTheme;
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 32),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final Activity a = items[i];
        final color = a.toStatus != null ? AppColors.status(a.toStatus!) : AppColors.primary;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: color.withValues(alpha: .14), shape: BoxShape.circle),
                  child: Icon(_icon(a.type), size: 16, color: color),
                ),
                if (i < items.length - 1) Container(width: 2, height: 30, color: color.withValues(alpha: .2)),
              ],
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 4, bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(a.title, style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                    if (a.detail != null && a.detail!.isNotEmpty) Text(a.detail!, style: t.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                    Text(Fmt.dateTime(a.at), style: t.labelSmall?.copyWith(color: t.bodySmall?.color)),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CallsTab extends ConsumerWidget {
  const _CallsTab({required this.client});
  final Client client;

  static Color _color(CallOutcome o) => switch (o) {
        CallOutcome.interested => AppColors.success,
        CallOutcome.callBack => AppColors.primary,
        CallOutcome.noAnswer => AppColors.warning,
        CallOutcome.rejected => AppColors.danger,
        CallOutcome.wrongNumber => const Color(0xFF64748B),
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final calls = ref.watch(clientCallsProvider(client.id));
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 32),
      children: [
        FilledButton.icon(
          onPressed: () => startCall(context, ref, client),
          icon: const Icon(Icons.call_rounded),
          label: const Text('Call now'),
        ),
        const SizedBox(height: 8),
        if (calls.isEmpty) const EmptyState(icon: Icons.phone_in_talk_rounded, title: 'No calls logged yet'),
        for (final x in calls)
          GlassCard(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(Icons.call_made_rounded, color: _color(x.outcome)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Pill(label: x.outcome.label, color: _color(x.outcome), dense: true),
                          Text(Fmt.dateTime(x.calledAt), style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                      if (x.note != null && x.note!.isNotEmpty)
                        Padding(padding: const EdgeInsets.only(top: 4), child: Text(x.note!)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _FollowupsTab extends ConsumerWidget {
  const _FollowupsTab({required this.client});
  final Client client;

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final when = await pickDateTime(context);
    if (when == null || !context.mounted) return;
    final note = await _askNote(context, 'Followup note (optional)');
    if (note == null) return;
    await ref.read(crmActionsProvider).scheduleFollowup(client.id, when, note: note.isEmpty ? null : note);
    if (context.mounted) showSnack(context, 'Followup set for ${Fmt.dateTime(when)}');
  }

  Future<void> _menu(BuildContext context, WidgetRef ref, Followup f, String action) async {
    final actions = ref.read(crmActionsProvider);
    switch (action) {
      case 'complete':
        final note = await _askNote(context, 'Outcome (optional)');
        if (note == null) return;
        await actions.completeFollowup(f, outcomeNote: note.isEmpty ? null : note);
      case 'reschedule':
        final when = await pickDateTime(context, initial: f.dueAt, title: 'Reschedule followup');
        if (when != null) await actions.rescheduleFollowup(f, when);
      case 'delete':
        if (await confirm(context, title: 'Delete followup?', message: 'Its reminders are cancelled.', ok: 'Delete', destructive: true)) {
          await actions.deleteFollowup(f);
        }
    }
  }

  /// Optional note prompt; '' when left empty, null when cancelled.
  static Future<String?> _askNote(BuildContext context, String title) async {
    final c = TextEditingController();
    final r = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, autofocus: true, maxLines: 3, minLines: 1),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('OK')),
        ],
      ),
    );
    c.dispose();
    return r;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(clientFollowupsProvider(client.id));
    final now = ref.watch(nowProvider);
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 32),
      children: [
        FilledButton.icon(onPressed: () => _add(context, ref), icon: const Icon(Icons.add_alarm_rounded), label: const Text('Add followup')),
        const SizedBox(height: 8),
        if (items.isEmpty) const EmptyState(icon: Icons.event_note_rounded, title: 'No followups yet'),
        for (final f in items)
          GlassCard(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            child: Row(
              children: [
                Icon(
                  f.status == FollowupStatus.completed
                      ? Icons.check_circle_rounded
                      : f.isOverdue(now)
                          ? Icons.warning_amber_rounded
                          : Icons.schedule_rounded,
                  color: f.status == FollowupStatus.completed
                      ? AppColors.success
                      : f.isOverdue(now)
                          ? AppColors.danger
                          : AppColors.info,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(Fmt.dateTime(f.dueAt), style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                      Text(
                        f.status == FollowupStatus.completed
                            ? 'Completed${f.completedAt == null ? '' : ' ${Fmt.dateTime(f.completedAt!)}'}'
                            : f.status == FollowupStatus.cancelled
                                ? 'Cancelled'
                                : Fmt.relative(f.dueAt, now),
                        style: t.bodySmall,
                      ),
                      if (f.note != null && f.note!.isNotEmpty) Text(f.note!, style: t.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'Followup actions',
                  onSelected: (a) => _menu(context, ref, f, a),
                  itemBuilder: (_) => [
                    if (f.isPending) ...const [
                      PopupMenuItem(value: 'complete', child: Text('Mark complete')),
                      PopupMenuItem(value: 'reschedule', child: Text('Reschedule')),
                    ],
                    const PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Generated PDF reports stored in the client's folder.
class _FilesTab extends ConsumerStatefulWidget {
  const _FilesTab({required this.client});
  final Client client;

  @override
  ConsumerState<_FilesTab> createState() => _FilesTabState();
}

class _FilesTabState extends ConsumerState<_FilesTab> {
  late Future<List<File>> _files = _load();
  bool _busy = false;

  /// PDFs in the client folder, excluding documents attached as files.
  Future<List<File>> _load() async {
    final dir = await FileStore.clientDir(widget.client.id);
    final attached = ref.read(clientDocumentsProvider(widget.client.id)).map((d) => d.filePath).whereType<String>().toSet();
    final files = (await dir.list().toList())
        .whereType<File>()
        .where((f) => f.path.toLowerCase().endsWith('.pdf') && !attached.contains(f.path))
        .toList()
      ..sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
    return files;
  }

  Future<void> _generate() async {
    setState(() => _busy = true);
    try {
      final c = ref.read(clientByIdProvider(widget.client.id)) ?? widget.client;
      final file = await PdfExporter.exportClient(
        client: c,
        productName: ref.read(productNamesProvider)[c.productId] ?? '—',
        documents: ref.read(clientDocumentsProvider(c.id)),
        activities: ref.read(clientActivitiesProvider(c.id)),
        score: ref.read(scoresProvider)[c.id] ?? 0,
        agentName: ref.read(profileProvider).name,
      );
      await ref.read(crmActionsProvider).logReport(c.id, p.basename(file.path));
      if (!mounted) return;
      setState(() => _files = _load());
      showSnack(context, 'Profile PDF created', action: SnackBarAction(label: 'Share', onPressed: () => _share(file)));
    } catch (e) {
      if (mounted) showSnack(context, 'Could not create the PDF', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share(File f) => SharePlus.instance.share(ShareParams(files: [XFile(f.path)], subject: p.basename(f.path)));

  Future<void> _delete(File f) async {
    if (!await confirm(context, title: 'Delete file?', message: p.basename(f.path), ok: 'Delete', destructive: true)) return;
    await FileStore.deleteQuietly(f.path);
    if (mounted) setState(() => _files = _load());
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<File>>(
        future: _files,
        builder: (context, snap) {
          final files = snap.data ?? const <File>[];
          return ListView(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 32),
            children: [
              FilledButton.icon(
                onPressed: _busy ? null : _generate,
                icon: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.picture_as_pdf_rounded),
                label: const Text('Generate profile PDF'),
              ),
              const SizedBox(height: 8),
              if (snap.connectionState == ConnectionState.done && files.isEmpty)
                const EmptyState(icon: Icons.folder_open_rounded, title: 'No reports yet', message: 'Generate a profile PDF to share it.'),
              for (final f in files)
                GlassCard(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
                  onTap: () => _share(f),
                  child: Row(
                    children: [
                      const Icon(Icons.picture_as_pdf_rounded, color: AppColors.danger),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(p.basename(f.path), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(Fmt.dateTime(f.lastModifiedSync()), style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                      IconButton(tooltip: 'Open / share', onPressed: () => _share(f), icon: const Icon(Icons.share_rounded)),
                      IconButton(tooltip: 'Delete', onPressed: () => _delete(f), icon: const Icon(Icons.delete_outline_rounded)),
                    ],
                  ),
                ),
            ],
          );
        },
      );
}
