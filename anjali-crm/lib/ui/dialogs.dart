import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/models.dart';
import 'format.dart';
import 'widgets.dart';

/// Date then time picker. Null if either is cancelled.
Future<DateTime?> pickDateTime(BuildContext context, {DateTime? initial}) async {
  final now = DateTime.now();
  final start = initial ?? DateTime(now.year, now.month, now.day, now.hour + 1);
  final first = DateTime(now.year - 1);
  final date = await showDatePicker(
    context: context,
    initialDate: start,
    firstDate: start.isBefore(first) ? start : first,
    lastDate: DateTime(now.year + 10),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(start));
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

/// Result of [showChangeStatusDialog].
class StatusChange {
  const StatusChange(this.status, this.amount);
  final LeadStatus status;
  final double? amount;
}

Future<StatusChange?> showChangeStatusDialog(BuildContext context, Client client) =>
    showDialog<StatusChange>(context: context, builder: (_) => _ChangeStatusDialog(client));

class _ChangeStatusDialog extends StatefulWidget {
  const _ChangeStatusDialog(this.client);
  final Client client;
  @override
  State<_ChangeStatusDialog> createState() => _ChangeStatusDialogState();
}

class _ChangeStatusDialogState extends State<_ChangeStatusDialog> {
  late LeadStatus _status = widget.client.status;
  final _form = GlobalKey<FormState>();
  late final _amount = TextEditingController(text: _initialAmount(widget.client.status));

  String _initialAmount(LeadStatus s) {
    final v = s == LeadStatus.disbursed
        ? widget.client.disbursedAmount ?? widget.client.approvedAmount
        : s == LeadStatus.approved
            ? widget.client.approvedAmount ?? widget.client.requestedAmount
            : null;
    return v == null ? '' : v.toStringAsFixed(v.truncateToDouble() == v ? 0 : 2);
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  void _select(LeadStatus s) => setState(() {
        _status = s;
        if (s.needsAmount) _amount.text = _initialAmount(s);
      });

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text('Change status · ${widget.client.name}'),
        content: Form(
          key: _form,
          child: SizedBox(
            width: 360,
            // A Column (not a lazy ListView) so the amount field is always
            // built: Form.validate() only checks fields that exist.
            child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
              RadioGroup<LeadStatus>(
                groupValue: _status,
                onChanged: (v) => _select(v!),
                child: Column(children: [
                  for (final s in LeadStatus.values)
                    RadioListTile<LeadStatus>(
                      key: Key('status-${s.key}'),
                      value: s,
                      dense: true,
                      title: Text(s.label),
                      secondary: Icon(Icons.circle, size: 12, color: statusColor(s)),
                    ),
                ]),
              ),
              if (_status.needsAmount)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: TextFormField(
                    key: const Key('status-amount'),
                    controller: _amount,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: '${_status == LeadStatus.approved ? 'Approved' : 'Disbursed'} amount (AED) *'),
                    validator: (v) {
                      try {
                        final a = parseAmount(v ?? '');
                        return a == null || a == 0 ? 'Amount is required' : null;
                      } on FormatException catch (e) {
                        return e.message;
                      }
                    },
                  ),
                ),
            ])),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (!_form.currentState!.validate()) return;
              Navigator.pop(context, StatusChange(_status, _status.needsAmount ? parseAmount(_amount.text) : null));
            },
            child: const Text('Save'),
          ),
        ],
      );
}

/// Result of [showCallOutcomeSheet].
class CallOutcome {
  const CallOutcome(this.outcome, this.notes, this.callBackAt);
  final String outcome;
  final String notes;
  final DateTime? callBackAt;
}

/// "How did the call with … go?" (guide §13). Null when skipped.
Future<CallOutcome?> showCallOutcomeSheet(BuildContext context, Client client) =>
    showModalBottomSheet<CallOutcome>(context: context, isScrollControlled: true, builder: (_) => _CallOutcomeSheet(client));

class _CallOutcomeSheet extends StatefulWidget {
  const _CallOutcomeSheet(this.client);
  final Client client;
  @override
  State<_CallOutcomeSheet> createState() => _CallOutcomeSheetState();
}

class _CallOutcomeSheetState extends State<_CallOutcomeSheet> {
  String? _outcome;
  DateTime? _callBackAt;
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _choose(String o) async {
    setState(() => _outcome = o);
    if (o == callBackOutcome) {
      final when = await pickDateTime(context);
      if (mounted) setState(() => _callBackAt = when);
    }
  }

  bool get _canSave => _outcome != null && (_outcome != callBackOutcome || _callBackAt != null);

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('How did the call with ${widget.client.name} go?', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final o in callOutcomes)
                ChoiceChip(label: Text(o), selected: _outcome == o, onSelected: (_) => _choose(o)),
            ]),
            if (_outcome == callBackOutcome)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: OutlinedButton.icon(
                  onPressed: () => _choose(callBackOutcome),
                  icon: const Icon(Icons.event),
                  label: Text(_callBackAt == null ? 'When should you call back? *' : 'Call back ${dateTimeLabel(_callBackAt!)}'),
                ),
              ),
            const SizedBox(height: 12),
            TextField(key: const Key('call-notes'), controller: _notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Notes (optional)')),
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Skip')),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _canSave ? () => Navigator.pop(context, CallOutcome(_outcome!, _notes.text, _callBackAt)) : null,
                child: const Text('Save'),
              ),
            ]),
          ]),
        ),
      );
}

/// Result of [showFollowupDialog].
class FollowupInput {
  const FollowupInput(this.dueAt, this.note);
  final DateTime dueAt;
  final String note;
}

/// New or rescheduled followup: date, time and note.
Future<FollowupInput?> showFollowupDialog(BuildContext context, {String title = 'New followup', DateTime? initial, String note = '', bool showNote = true}) =>
    showDialog<FollowupInput>(context: context, builder: (_) => _FollowupDialog(title, initial, note, showNote));

class _FollowupDialog extends StatefulWidget {
  const _FollowupDialog(this.title, this.initial, this.note, this.showNote);
  final String title;
  final DateTime? initial;
  final String note;
  final bool showNote;
  @override
  State<_FollowupDialog> createState() => _FollowupDialogState();
}

class _FollowupDialogState extends State<_FollowupDialog> {
  late DateTime? _due = widget.initial;
  late final _note = TextEditingController(text: widget.note);

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.title),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          OutlinedButton.icon(
            key: const Key('followup-when'),
            onPressed: () async {
              final d = await pickDateTime(context, initial: _due);
              if (d != null && mounted) setState(() => _due = d);
            },
            icon: const Icon(Icons.event),
            label: Text(_due == null ? 'Choose date and time *' : dateTimeLabel(_due!)),
          ),
          if (widget.showNote) ...[
            const SizedBox(height: 12),
            TextField(key: const Key('followup-note'), controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: 'Note (optional)')),
          ],
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: _due == null ? null : () => Navigator.pop(context, FollowupInput(_due!, _note.text)),
            child: const Text('Save'),
          ),
        ],
      );
}

/// Mark complete with an optional outcome note. Null when cancelled.
Future<String?> showCompleteFollowupDialog(BuildContext context) =>
    showDialog<String>(context: context, builder: (_) => const _CompleteDialog());

class _CompleteDialog extends StatefulWidget {
  const _CompleteDialog();
  @override
  State<_CompleteDialog> createState() => _CompleteDialogState();
}

class _CompleteDialogState extends State<_CompleteDialog> {
  final _outcome = TextEditingController();

  @override
  void dispose() {
    _outcome.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Mark complete'),
        content: TextField(
          key: const Key('complete-outcome'),
          controller: _outcome,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Outcome (optional)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, _outcome.text), child: const Text('Complete')),
        ],
      );
}

/// Search-and-pick a client (guide §15 "+ New followup").
Future<Client?> pickClient(BuildContext context) =>
    showDialog<Client>(context: context, builder: (_) => const _ClientPicker());

class _ClientPicker extends StatefulWidget {
  const _ClientPicker();
  @override
  State<_ClientPicker> createState() => _ClientPickerState();
}

class _ClientPickerState extends State<_ClientPicker> {
  final _search = TextEditingController();
  late Future<List<Client>> _future = CrmDatabase.instance.clients(const ClientQuery(sort: ClientSort.nameAsc));

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {
        _future = CrmDatabase.instance.clients(ClientQuery(search: _search.text, sort: ClientSort.nameAsc));
      });

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Choose a client'),
        contentPadding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        content: SizedBox(
          width: 400,
          height: 420,
          child: Column(children: [
            TextField(
              key: const Key('pick-client-search'),
              controller: _search,
              autofocus: true,
              onChanged: (_) => _refresh(),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search name, phone, company'),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: FutureBuilder<List<Client>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.hasError) return Center(child: Text('Could not load clients: ${snap.error}'));
                  if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
                  final rows = snap.data!;
                  if (rows.isEmpty) return const Center(child: Text('No matching clients'));
                  return ListView.builder(
                    itemCount: rows.length,
                    itemBuilder: (context, i) => ListTile(
                      leading: Initials(rows[i].name),
                      title: Text(rows[i].name),
                      subtitle: Text([rows[i].phone, rows[i].company].where((s) => s.isNotEmpty).join(' · ')),
                      onTap: () => Navigator.pop(context, rows[i]),
                    ),
                  );
                },
              ),
            ),
          ]),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))],
      );
}

/// Yes/no confirmation; true only when confirmed.
Future<bool> confirm(BuildContext context, {required String title, required String message, String action = 'Delete'}) async =>
    await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(action)),
        ],
      ),
    ) ??
    false;
