import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/models.dart';
import '../services/client_actions.dart';
import '../ui/dialogs.dart';
import '../ui/format.dart';
import '../ui/widgets.dart';
import '../widgets/async_body.dart';
import 'lead_form_screen.dart';

/// Everything about one client (guide §8, §13).
class ClientProfileScreen extends StatefulWidget {
  const ClientProfileScreen({super.key, required this.clientId});
  final int clientId;

  @override
  State<ClientProfileScreen> createState() => _ClientProfileScreenState();
}

class _ProfileData {
  _ProfileData(this.client, this.timeline, this.followups, this.calls);
  final Client client;
  final List<TimelineEvent> timeline;
  final List<Followup> followups;
  final List<CallLog> calls;
}

class _ClientProfileScreenState extends State<ClientProfileScreen> {
  late Future<_ProfileData> _future;
  final _db = CrmDatabase.instance;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ProfileData> _load() async {
    final c = await _db.client(widget.clientId);
    if (c == null) throw StateError('This client no longer exists.');
    return _ProfileData(
      c,
      await _db.timeline(widget.clientId),
      await _db.followups(clientId: widget.clientId),
      await _db.calls(widget.clientId),
    );
  }

  void _reload() {
    if (!mounted) return;
    setState(() {
      _future = _load();
    });
  }

  /// Runs a database change, reports failure, and reloads.
  Future<void> _run(Future<void> Function() change, {String? done}) async {
    try {
      await change();
      if (done != null && mounted) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save: $e');
    }
    _reload();
  }

  Future<void> _edit(Client c) async {
    await Navigator.push(context, MaterialPageRoute<int>(builder: (_) => LeadFormScreen(clientId: c.id)));
    _reload();
  }

  Future<void> _delete(Client c) async {
    final yes = await confirm(context, title: 'Delete client?', message: 'Delete ${c.name} with their followups, calls and history? This cannot be undone.');
    if (!yes) return;
    try {
      await _db.deleteClient(c.id!);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showSnack(context, 'Could not delete: $e');
    }
  }

  Future<void> _changeStatus(Client c) async {
    final change = await showChangeStatusDialog(context, c);
    if (change == null || change.status == c.status && !change.status.needsAmount) return;
    await _run(() => _db.changeStatus(c.id!, change.status, amount: change.amount), done: 'Status: ${change.status.label}');
  }

  Future<void> _addFollowup(Client c) async {
    final input = await showFollowupDialog(context);
    if (input == null) return;
    await _run(() => _db.addFollowup(c.id!, input.dueAt, note: input.note), done: 'Followup scheduled.');
  }

  Future<void> _addNote(Client c) async {
    final text = await showDialog<String>(context: context, builder: (_) => const _NoteDialog());
    if (text == null || text.trim().isEmpty) return;
    await _run(() => _db.addNote(c.id!, text), done: 'Note added.');
  }

  @override
  Widget build(BuildContext context) => AsyncBody<_ProfileData>(
        future: _future,
        onRetry: _reload,
        builder: (context, d) {
          final c = d.client;
          return DefaultTabController(
            length: 3,
            child: Scaffold(
              appBar: AppBar(
                title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                actions: [
                  IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined), onPressed: () => _edit(c)),
                  PopupMenuButton<String>(
                    tooltip: 'More',
                    onSelected: (v) => v == 'delete' ? _delete(c) : null,
                    itemBuilder: (_) => const [PopupMenuItem(value: 'delete', child: Text('Delete client'))],
                  ),
                ],
              ),
              body: NestedScrollView(
                headerSliverBuilder: (context, _) => [
                  SliverToBoxAdapter(child: _Header(client: c, onChangeStatus: () => _changeStatus(c), onCalled: _reload)),
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _TabBarDelegate(TabBar(tabs: [
                      Tab(text: 'Timeline (${d.timeline.length})'),
                      Tab(text: 'Followups (${d.followups.where((f) => !f.isDone).length})'),
                      Tab(text: 'Calls (${d.calls.length})'),
                    ]), Theme.of(context).scaffoldBackgroundColor),
                  ),
                ],
                body: TabBarView(children: [
                  _TimelineTab(events: d.timeline, onAddNote: () => _addNote(c)),
                  _FollowupsTab(
                    followups: d.followups,
                    onAdd: () => _addFollowup(c),
                    onComplete: (f) async {
                      final outcome = await showCompleteFollowupDialog(context);
                      if (outcome != null) await _run(() => _db.completeFollowup(f.id!, outcome: outcome), done: 'Followup completed.');
                    },
                    onReschedule: (f) async {
                      final input = await showFollowupDialog(context, title: 'Reschedule', initial: f.dueAt, showNote: false);
                      if (input != null) await _run(() => _db.rescheduleFollowup(f.id!, input.dueAt), done: 'Followup rescheduled.');
                    },
                    onDelete: (f) async {
                      if (await confirm(context, title: 'Delete followup?', message: 'Delete this followup?')) {
                        await _run(() => _db.deleteFollowup(f.id!), done: 'Followup deleted.');
                      }
                    },
                  ),
                  _CallsTab(calls: d.calls, onCallNow: () => ClientActions.call(context, c, onLogged: _reload)),
                ]),
              ),
            ),
          );
        },
      );
}

class _Header extends StatelessWidget {
  const _Header({required this.client, required this.onChangeStatus, required this.onCalled});
  final Client client;
  final VoidCallback onChangeStatus;
  final VoidCallback onCalled;

  @override
  Widget build(BuildContext context) {
    final c = client;
    final role = [c.jobTitle, c.company].where((s) => s.isNotEmpty).join(' at ');
    final money = [
      if (c.salary != null) ('Salary', aed(c.salary)),
      if (c.requestedAmount != null) ('Requested', aed(c.requestedAmount)),
      if (c.approvedAmount != null) ('Approved', aed(c.approvedAmount)),
      if (c.disbursedAmount != null) ('Disbursed', aed(c.disbursedAmount)),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Initials(c.name, radius: 26),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(c.name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                    if (role.isNotEmpty) Text(role, style: const TextStyle(color: Colors.grey)),
                    const SizedBox(height: 6),
                    Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      StatusChip(c.status),
                      PriorityLabel(c.priority),
                      if (c.rating > 0) StarRating(rating: c.rating, size: 14),
                    ]),
                  ]),
                ),
                ScoreCircle(c),
              ]),
              if (c.productName != null || money.isNotEmpty) ...[
                const Divider(height: 24),
                Wrap(spacing: 18, runSpacing: 8, children: [
                  if (c.productName != null) _Fact('Product', c.productName!),
                  for (final m in money) _Fact(m.$1, m.$2),
                  if (c.source.isNotEmpty) _Fact('Source', c.source),
                  if (c.nationality.isNotEmpty) _Fact('Nationality', c.nationality),
                ]),
              ],
              if (c.remarks.isNotEmpty) ...[
                const Divider(height: 24),
                Text(c.remarks),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          _Action(icon: Icons.call, label: 'Call', onTap: () => ClientActions.call(context, c, onLogged: onCalled)),
          _Action(icon: Icons.chat, label: 'WhatsApp', onTap: () => ClientActions.whatsapp(context, c)),
          _Action(icon: Icons.email_outlined, label: 'Email', onTap: () => ClientActions.email(context, c)),
          _Action(icon: Icons.place_outlined, label: 'Map', onTap: () => ClientActions.map(context, c)),
        ]),
        const SizedBox(height: 8),
        Text([c.phone, if (c.whatsapp.isNotEmpty) 'WhatsApp ${c.whatsapp}', c.email, c.location].where((s) => s.isNotEmpty).join(' · '),
            style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 12),
        _Pipeline(status: c.status),
        const SizedBox(height: 8),
        OutlinedButton.icon(key: const Key('change-status'), onPressed: onChangeStatus, icon: const Icon(Icons.swap_horiz), label: const Text('Change status')),
      ]),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ]);
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Column(children: [
            CircleAvatar(backgroundColor: const Color(0xFFF0E7FC), child: Icon(icon, color: brandPurple)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12)),
          ]),
        ),
      );
}

/// New Lead → … → Disbursed, with the current step highlighted. A lost lead
/// shows its status instead.
class _Pipeline extends StatelessWidget {
  const _Pipeline({required this.status});
  final LeadStatus status;

  @override
  Widget build(BuildContext context) {
    if (status.isLost) {
      return Row(children: [const Text('Pipeline: '), StatusChip(status)]);
    }
    final current = LeadStatus.pipeline.indexOf(status);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        for (var i = 0; i < LeadStatus.pipeline.length; i++) ...[
          if (i > 0) Icon(Icons.chevron_right, size: 16, color: i <= current ? brandPurple : Colors.grey),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: i == current ? brandPurple : i < current ? const Color(0xFFF0E7FC) : null,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: i <= current ? brandPurple : Colors.grey.shade400),
            ),
            child: Text(
              LeadStatus.pipeline[i].label,
              style: TextStyle(fontSize: 12, color: i == current ? Colors.white : i < current ? brandPurple : Colors.grey),
            ),
          ),
        ],
      ]),
    );
  }
}

class _TimelineTab extends StatelessWidget {
  const _TimelineTab({required this.events, required this.onAddNote});
  final List<TimelineEvent> events;
  final VoidCallback onAddNote;

  static IconData _icon(TimelineKind k) => switch (k) {
        TimelineKind.created => Icons.person_add_alt_1,
        TimelineKind.statusChanged => Icons.swap_horiz,
        TimelineKind.call => Icons.call,
        TimelineKind.followupAdded => Icons.event,
        TimelineKind.followupDone => Icons.task_alt,
        TimelineKind.note => Icons.sticky_note_2_outlined,
        TimelineKind.edited => Icons.edit_outlined,
      };

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(onPressed: onAddNote, icon: const Icon(Icons.note_add_outlined), label: const Text('Add note')),
        ),
        const SizedBox(height: 8),
        for (final e in events)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(backgroundColor: const Color(0xFFF0E7FC), child: Icon(_icon(e.kind), color: brandPurple, size: 20)),
            title: Text(e.title, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text([dateTimeLabel(e.at), if (e.detail.isNotEmpty) e.detail].join('\n')),
          ),
      ]);
}

class _FollowupsTab extends StatelessWidget {
  const _FollowupsTab({required this.followups, required this.onAdd, required this.onComplete, required this.onReschedule, required this.onDelete});
  final List<Followup> followups;
  final VoidCallback onAdd;
  final ValueChanged<Followup> onComplete;
  final ValueChanged<Followup> onReschedule;
  final ValueChanged<Followup> onDelete;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return ListView(padding: const EdgeInsets.all(16), children: [
      Align(
        alignment: Alignment.centerLeft,
        child: FilledButton.icon(key: const Key('profile-add-followup'), onPressed: onAdd, icon: const Icon(Icons.add), label: const Text('Add followup')),
      ),
      const SizedBox(height: 8),
      if (followups.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No followups yet.')),
      for (final f in followups)
        Card(
          child: ListTile(
            leading: Icon(f.isDone ? Icons.task_alt : Icons.event, color: f.isOverdue(now) ? Colors.red : f.isDone ? Colors.green : brandPurple),
            title: Text(dateTimeLabel(f.dueAt),
                style: TextStyle(fontWeight: FontWeight.w700, decoration: f.isDone ? TextDecoration.lineThrough : null, color: f.isOverdue(now) ? Colors.red : null)),
            subtitle: Text([if (f.note.isNotEmpty) f.note, if (f.isDone && f.outcome.isNotEmpty) 'Outcome: ${f.outcome}', if (f.isOverdue(now)) 'Overdue']
                .join('\n')),
            trailing: PopupMenuButton<String>(
              tooltip: 'Followup actions',
              onSelected: (v) => switch (v) {
                'complete' => onComplete(f),
                'reschedule' => onReschedule(f),
                _ => onDelete(f),
              },
              itemBuilder: (_) => [
                if (!f.isDone) const PopupMenuItem(value: 'complete', child: Text('Mark complete')),
                if (!f.isDone) const PopupMenuItem(value: 'reschedule', child: Text('Reschedule')),
                const PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ),
        ),
    ]);
  }
}

class _CallsTab extends StatelessWidget {
  const _CallsTab({required this.calls, required this.onCallNow});
  final List<CallLog> calls;
  final VoidCallback onCallNow;

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton.icon(onPressed: onCallNow, icon: const Icon(Icons.call), label: const Text('Call now')),
        ),
        const SizedBox(height: 8),
        if (calls.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No calls logged yet.')),
        for (final c in calls)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(c.outcome == wrongNumberOutcome ? Icons.phone_disabled : Icons.call, color: brandPurple),
            title: Text(c.outcome, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text([dateTimeLabel(c.calledAt), if (c.notes.isNotEmpty) c.notes].join('\n')),
          ),
      ]);
}

class _NoteDialog extends StatefulWidget {
  const _NoteDialog();
  @override
  State<_NoteDialog> createState() => _NoteDialogState();
}

class _NoteDialogState extends State<_NoteDialog> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Add note'),
        content: TextField(key: const Key('note-text'), controller: _text, autofocus: true, maxLines: 4, decoration: const InputDecoration(hintText: 'What did the client say?')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, _text.text), child: const Text('Save')),
        ],
      );
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
