import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/validators.dart';
import '../widgets/async_body.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});
  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final search = TextEditingController();
  late Future<List<Map<String, Object?>>> future;

  @override
  void initState() {
    super.initState();
    future = CrmDatabase.instance.contacts();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  void refresh() {
    if (!mounted) return;
    setState(() {
      future = CrmDatabase.instance.contacts(search: search.text);
    });
  }

  void _snack(String message) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> edit([Map<String, Object?>? item]) async {
    final values = await showDialog<Map<String, Object?>>(
      context: context,
      builder: (_) => ContactFormDialog(initial: item),
    );
    if (values == null) return;
    try {
      await CrmDatabase.instance.saveContact({
        if (item != null) 'id': item['id'],
        ...values,
        'created_at': item?['created_at'] ?? DateTime.now().toIso8601String(),
      });
      _snack(item == null ? 'Contact added.' : 'Contact updated.');
    } catch (e) {
      _snack('Could not save contact: $e');
    }
    refresh();
  }

  Future<void> remove(Map<String, Object?> item) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete contact?'),
        content: Text('Delete ${item['name']} from this device? Their activities are kept but unlinked.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (yes != true) return;
    try {
      await CrmDatabase.instance.deleteContact(item['id'] as int);
      _snack('Contact deleted.');
    } catch (e) {
      _snack('Could not delete contact: $e');
    }
    refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Contacts', style: TextStyle(fontWeight: FontWeight.bold))),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => edit(),
          icon: const Icon(Icons.person_add_alt_1),
          label: const Text('Add contact'),
        ),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: TextField(
              controller: search,
              onChanged: (_) => refresh(),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search name, company, phone or email',
              ),
            ),
          ),
          Expanded(
            child: AsyncBody<List<Map<String, Object?>>>(
              future: future,
              onRetry: refresh,
              builder: (context, rows) {
                if (rows.isEmpty) {
                  final searching = search.text.trim().isNotEmpty;
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.people_outline, size: 54, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text(searching ? 'No matching contacts' : 'No contacts yet',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        Text(searching ? 'Try a different search.' : 'Add a contact to start building your CRM.',
                            textAlign: TextAlign.center),
                      ]),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final c = rows[i];
                    final name = c['name'] as String;
                    final details = [c['company'], c['phone'], c['email']]
                        .whereType<String>()
                        .where((s) => s.isNotEmpty)
                        .join(' · ');
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(child: Text(name.isEmpty ? '?' : name.characters.first.toUpperCase())),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: details.isEmpty ? null : Text(details),
                        onTap: () => edit(c),
                        trailing: PopupMenuButton<String>(
                          tooltip: 'Contact actions',
                          onSelected: (v) => v == 'edit' ? edit(c) : remove(c),
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
          ),
        ]),
      );
}

/// Add/edit form. Pops with the trimmed field values, or null on Cancel.
/// The dialog owns its controllers, so they are disposed only after the
/// dialog's closing animation has finished.
class ContactFormDialog extends StatefulWidget {
  const ContactFormDialog({super.key, this.initial});
  final Map<String, Object?>? initial;
  @override
  State<ContactFormDialog> createState() => _ContactFormDialogState();
}

class _ContactFormDialogState extends State<ContactFormDialog> {
  final _form = GlobalKey<FormState>();
  late final _name = _ctrl('name');
  late final _company = _ctrl('company');
  late final _phone = _ctrl('phone');
  late final _email = _ctrl('email');
  late final _notes = _ctrl('notes');

  TextEditingController _ctrl(String key) =>
      TextEditingController(text: widget.initial?[key] as String? ?? '');

  @override
  void dispose() {
    for (final c in [_name, _company, _phone, _email, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  void _save() {
    if (!_form.currentState!.validate()) return;
    Navigator.pop<Map<String, Object?>>(context, {
      'name': _name.text.trim(),
      'company': _company.text.trim(),
      'phone': _phone.text.trim(),
      'email': _email.text.trim(),
      'notes': _notes.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.initial == null ? 'New contact' : 'Edit contact'),
        content: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                key: const Key('contact-name'),
                controller: _name,
                autofocus: true,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Full name *'),
                validator: (v) => Validators.required(v, 'Name'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                key: const Key('contact-company'),
                controller: _company,
                decoration: const InputDecoration(labelText: 'Company'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                key: const Key('contact-phone'),
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone'),
                validator: Validators.phone,
              ),
              const SizedBox(height: 10),
              TextFormField(
                key: const Key('contact-email'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: Validators.email,
              ),
              const SizedBox(height: 10),
              TextFormField(
                key: const Key('contact-notes'),
                controller: _notes,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Notes'),
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: _save, child: const Text('Save')),
        ],
      );
}
