import 'package:material_ui/material_ui.dart';
import 'package:intl/intl.dart';

import '../data/crm_database.dart';
import '../data/validators.dart';
import '../widgets/async_body.dart';

class ActivitiesScreen extends StatefulWidget {
  const ActivitiesScreen({super.key});
  @override
  State<ActivitiesScreen> createState() => _ActivitiesScreenState();
}

class _ActivitiesScreenState extends State<ActivitiesScreen> {
  late Future<List<Map<String, Object?>>> future;

  @override
  void initState() {
    super.initState();
    future = CrmDatabase.instance.activities();
  }

  void refresh() {
    if (!mounted) return;
    setState(() {
      future = CrmDatabase.instance.activities();
    });
  }

  void _snack(String message) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> edit([Map<String, Object?>? item]) async {
    final List<Map<String, Object?>> contacts;
    try {
      contacts = await CrmDatabase.instance.contacts();
    } catch (e) {
      _snack('Could not load contacts: $e');
      return;
    }
    if (!mounted) return;
    final values = await showDialog<Map<String, Object?>>(
      context: context,
      builder: (_) => ActivityFormDialog(initial: item, contacts: contacts),
    );
    if (values == null) return;
    try {
      await CrmDatabase.instance.saveActivity({
        if (item != null) 'id': item['id'],
        ...values,
        'completed': item?['completed'] ?? 0,
        'created_at': item?['created_at'] ?? DateTime.now().toIso8601String(),
      });
      _snack(item == null ? 'Activity added.' : 'Activity updated.');
    } catch (e) {
      _snack('Could not save activity: $e');
    }
    refresh();
  }

  Future<void> remove(Map<String, Object?> item) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete activity?'),
        content: Text('Delete "${item['title']}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (yes != true) return;
    try {
      await CrmDatabase.instance.deleteActivity(item['id'] as int);
      _snack('Activity deleted.');
    } catch (e) {
      _snack('Could not delete activity: $e');
    }
    refresh();
  }

  Future<void> toggle(Map<String, Object?> item, bool done) async {
    try {
      await CrmDatabase.instance.setActivityCompleted(item['id'] as int, done);
    } catch (e) {
      _snack('Could not update activity: $e');
    }
    refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Activities', style: TextStyle(fontWeight: FontWeight.bold))),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => edit(),
          icon: const Icon(Icons.add_task),
          label: const Text('Add activity'),
        ),
        body: AsyncBody<List<Map<String, Object?>>>(
          future: future,
          onRetry: refresh,
          builder: (context, rows) {
            if (rows.isEmpty) {
              return const Center(child: Text('No activities. Add a follow-up to get started.'));
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final a = rows[i];
                final done = a['completed'] == 1;
                final due = a['due_at'] as String?;
                final contact = a['contact_name'] as String?;
                final notes = a['notes'] as String;
                final lines = [
                  due == null ? 'No due date' : 'Due ${DateFormat.yMMMd().format(DateTime.parse(due))}',
                  if (contact != null) 'With $contact',
                  if (notes.isNotEmpty) notes,
                ];
                return Card(
                  child: ListTile(
                    leading: Checkbox(
                      value: done,
                      onChanged: (v) => toggle(a, v ?? false),
                    ),
                    title: Text(
                      a['title'] as String,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        decoration: done ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    subtitle: Text(lines.join('\n')),
                    onTap: () => edit(a),
                    trailing: PopupMenuButton<String>(
                      tooltip: 'Activity actions',
                      onSelected: (v) => v == 'edit' ? edit(a) : remove(a),
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'edit', child: Text('Edit')),
                        PopupMenuItem(value: 'delete', child: Text('Delete')),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      );
}

/// Add/edit form for an activity. Pops with `title`, `notes`, `due_at` and
/// `contact_id`, or null on Cancel. Owns its controllers (see
/// ContactFormDialog for why).
class ActivityFormDialog extends StatefulWidget {
  const ActivityFormDialog({super.key, this.initial, required this.contacts});
  final Map<String, Object?>? initial;
  final List<Map<String, Object?>> contacts;
  @override
  State<ActivityFormDialog> createState() => _ActivityFormDialogState();
}

class _ActivityFormDialogState extends State<ActivityFormDialog> {
  final _form = GlobalKey<FormState>();
  late final _title = TextEditingController(text: widget.initial?['title'] as String? ?? '');
  late final _notes = TextEditingController(text: widget.initial?['notes'] as String? ?? '');
  late DateTime? _due = switch (widget.initial?['due_at']) {
    final String s => DateTime.parse(s),
    _ => null,
  };
  late int? _contactId = _initialContactId();

  /// The stored contact id, if that contact still exists.
  int? _initialContactId() {
    final id = widget.initial?['contact_id'] as int?;
    return widget.contacts.any((c) => c['id'] == id) ? id : null;
  }

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final first = now.subtract(const Duration(days: 365));
    final initial = _due ?? now;
    final d = await showDatePicker(
      context: context,
      firstDate: initial.isBefore(first) ? initial : first,
      lastDate: now.add(const Duration(days: 3650)),
      initialDate: initial,
    );
    if (d != null && mounted) setState(() => _due = d);
  }

  void _save() {
    if (!_form.currentState!.validate()) return;
    Navigator.pop<Map<String, Object?>>(context, {
      'title': _title.text.trim(),
      'notes': _notes.text.trim(),
      'due_at': _due?.toIso8601String(),
      'contact_id': _contactId,
    });
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.initial == null ? 'New activity' : 'Edit activity'),
        content: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                key: const Key('activity-title'),
                controller: _title,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Activity title *'),
                validator: (v) => Validators.required(v, 'Activity title'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<int?>(
                key: const Key('activity-contact'),
                initialValue: _contactId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Contact'),
                items: [
                  const DropdownMenuItem<int?>(value: null, child: Text('No contact')),
                  for (final c in widget.contacts)
                    DropdownMenuItem<int?>(
                      value: c['id'] as int,
                      child: Text(c['name'] as String, overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _contactId = v),
              ),
              const SizedBox(height: 10),
              TextFormField(
                key: const Key('activity-notes'),
                controller: _notes,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Notes'),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickDate,
                    icon: const Icon(Icons.calendar_month),
                    label: Text(_due == null ? 'Set due date (optional)' : DateFormat.yMMMd().format(_due!)),
                  ),
                ),
                if (_due != null)
                  IconButton(
                    tooltip: 'Clear due date',
                    onPressed: () => setState(() => _due = null),
                    icon: const Icon(Icons.close),
                  ),
              ]),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: _save, child: const Text('Save')),
        ],
      );
}
