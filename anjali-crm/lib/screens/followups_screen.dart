import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/followup_buckets.dart';
import '../data/models.dart';
import '../services/client_actions.dart';
import '../ui/dialogs.dart';
import '../ui/format.dart';
import '../ui/widgets.dart';
import '../widgets/async_body.dart';
import 'client_profile_screen.dart';

/// Every followup across all clients (guide §15).
class FollowupsScreen extends StatefulWidget {
  const FollowupsScreen({super.key, this.initialBucket = FollowupBucket.today, this.onChanged});
  final FollowupBucket initialBucket;

  /// Called after any change, so the shell can refresh the overdue badge.
  final VoidCallback? onChanged;

  @override
  State<FollowupsScreen> createState() => _FollowupsScreenState();
}

class _FollowupsScreenState extends State<FollowupsScreen> {
  late Future<List<Followup>> _future;
  final _db = CrmDatabase.instance;

  @override
  void initState() {
    super.initState();
    _future = _db.followups();
  }

  void _reload() {
    if (!mounted) return;
    setState(() {
      _future = _db.followups();
    });
    widget.onChanged?.call();
  }

  Future<void> _run(Future<void> Function() change, String done) async {
    try {
      await change();
      if (mounted) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save: $e');
    }
    _reload();
  }

  Future<void> _new() async {
    final client = await pickClient(context);
    if (client == null || !mounted) return;
    final input = await showFollowupDialog(context, title: 'Followup · ${client.name}');
    if (input == null) return;
    await _run(() => _db.addFollowup(client.id!, input.dueAt, note: input.note), 'Followup scheduled.');
  }

  Future<void> _call(Followup f) async {
    final c = f.clientId == null ? null : await _db.client(f.clientId!);
    if (c == null) {
      if (mounted) showSnack(context, 'This followup has no client to call.');
      return;
    }
    if (mounted) await ClientActions.call(context, c, onLogged: _reload);
  }

  @override
  Widget build(BuildContext context) => AsyncBody<List<Followup>>(
        future: _future,
        onRetry: _reload,
        builder: (context, all) {
          final now = DateTime.now();
          final byBucket = {for (final b in FollowupBucket.values) b: <Followup>[]};
          for (final f in all) {
            byBucket[bucketFor(f, now)]!.add(f);
          }
          final overdue = byBucket[FollowupBucket.overdue]!.length;
          return DefaultTabController(
            length: FollowupBucket.values.length,
            initialIndex: widget.initialBucket.index,
            child: Scaffold(
              appBar: AppBar(
                title: Row(children: [
                  const Text('Followups', style: TextStyle(fontWeight: FontWeight.bold)),
                  if (overdue > 0) ...[
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(12)),
                      child: Text('$overdue overdue', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ]),
                bottom: TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  tabs: [for (final b in FollowupBucket.values) Tab(text: '${b.label} (${byBucket[b]!.length})')],
                ),
              ),
              floatingActionButton: FloatingActionButton.extended(onPressed: _new, icon: const Icon(Icons.add), label: const Text('New followup')),
              body: TabBarView(children: [
                for (final b in FollowupBucket.values)
                  byBucket[b]!.isEmpty
                      ? Center(child: Text('Nothing ${b == FollowupBucket.completed ? 'completed yet' : 'due ${b.label.toLowerCase()}'}.'))
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
                          itemCount: byBucket[b]!.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, i) => FollowupCard(
                            followup: byBucket[b]![i],
                            now: now,
                            onOpenClient: (id) async {
                              await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ClientProfileScreen(clientId: id)));
                              _reload();
                            },
                            onCall: _call,
                            onComplete: (f) async {
                              final outcome = await showCompleteFollowupDialog(context);
                              if (outcome != null) await _run(() => _db.completeFollowup(f.id!, outcome: outcome), 'Followup completed.');
                            },
                            onReschedule: (f) async {
                              final input = await showFollowupDialog(context, title: 'Reschedule', initial: f.dueAt, showNote: false);
                              if (input != null) await _run(() => _db.rescheduleFollowup(f.id!, input.dueAt), 'Followup rescheduled.');
                            },
                            onReopen: (f) => _run(() => _db.reopenFollowup(f.id!), 'Followup reopened.'),
                            onDelete: (f) async {
                              if (await confirm(context, title: 'Delete followup?', message: 'Delete this followup?')) {
                                await _run(() => _db.deleteFollowup(f.id!), 'Followup deleted.');
                              }
                            },
                          ),
                        ),
              ]),
            ),
          );
        },
      );
}

/// One followup with its actions; also used by Home → Today's tasks.
class FollowupCard extends StatelessWidget {
  const FollowupCard({
    super.key,
    required this.followup,
    required this.now,
    required this.onOpenClient,
    required this.onCall,
    required this.onComplete,
    this.onWhatsApp,
    this.onReschedule,
    this.onReopen,
    this.onDelete,
  });

  final Followup followup;
  final DateTime now;
  final ValueChanged<int> onOpenClient;
  final ValueChanged<Followup> onCall;
  final ValueChanged<Followup> onComplete;
  final ValueChanged<Followup>? onWhatsApp;
  final ValueChanged<Followup>? onReschedule;
  final ValueChanged<Followup>? onReopen;
  final ValueChanged<Followup>? onDelete;

  @override
  Widget build(BuildContext context) {
    final f = followup;
    final overdue = f.isOverdue(now);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: InkWell(
                onTap: f.clientId == null ? null : () => onOpenClient(f.clientId!),
                child: Text(f.clientName ?? 'No client', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
            if (onDelete != null)
              PopupMenuButton<String>(
                tooltip: 'Followup actions',
                onSelected: (v) => v == 'reopen' ? onReopen?.call(f) : onDelete!(f),
                itemBuilder: (_) => [
                  if (f.isDone && onReopen != null) const PopupMenuItem(value: 'reopen', child: Text('Reopen')),
                  const PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
          ]),
          Text(
            f.isDone ? 'Done ${dateTimeLabel(f.completedAt!)}' : '${overdue ? 'Overdue · was due' : 'Due'} ${dateTimeLabel(f.dueAt)}',
            style: TextStyle(color: overdue ? Colors.red : f.isDone ? Colors.green : brandPurple, fontWeight: FontWeight.w600),
          ),
          if (f.note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(f.note)),
          if (f.isDone && f.outcome.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Outcome: ${f.outcome}')),
          if (!f.isDone)
            Wrap(spacing: 4, children: [
              TextButton.icon(onPressed: () => onCall(f), icon: const Icon(Icons.call, size: 18), label: const Text('Call')),
              if (onWhatsApp != null)
                TextButton.icon(onPressed: () => onWhatsApp!(f), icon: const Icon(Icons.chat, size: 18), label: const Text('WhatsApp')),
              if (onReschedule != null)
                TextButton.icon(onPressed: () => onReschedule!(f), icon: const Icon(Icons.schedule, size: 18), label: const Text('Reschedule')),
              TextButton.icon(
                key: Key('complete-${f.id}'),
                onPressed: () => onComplete(f),
                icon: const Icon(Icons.check, size: 18),
                label: const Text('Mark complete'),
              ),
            ]),
        ]),
      ),
    );
  }
}
