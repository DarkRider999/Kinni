import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/models.dart';
import '../data/validators.dart';
import '../ui/dialogs.dart';
import '../ui/format.dart';
import '../ui/widgets.dart';
import '../widgets/async_body.dart';
import 'client_profile_screen.dart';

/// Add or edit a lead (guide §7).
///
/// Shown either as the Add Lead tab ([embedded], new leads only: after saving
/// it clears and opens the new client's profile) or pushed as a page (pops
/// with the saved client's id).
class LeadFormScreen extends StatefulWidget {
  const LeadFormScreen({super.key, this.clientId, this.embedded = false});
  final int? clientId;
  final bool embedded;

  @override
  State<LeadFormScreen> createState() => _LeadFormScreenState();
}

class _LeadFormData {
  _LeadFormData(this.products, this.client);
  final List<Product> products;
  final Client? client;
}

class _LeadFormScreenState extends State<LeadFormScreen> {
  late Future<_LeadFormData> _future;
  int _formGeneration = 0;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_LeadFormData> _load() async {
    final db = CrmDatabase.instance;
    final client = widget.clientId == null ? null : await db.client(widget.clientId!);
    if (widget.clientId != null && client == null) throw StateError('This client no longer exists.');
    return _LeadFormData(await db.products(), client);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  /// Called after a successful save.
  Future<void> _saved(int id) async {
    if (!widget.embedded) {
      Navigator.pop(context, id);
      return;
    }
    setState(() => _formGeneration++); // fresh, empty form
    showSnack(context, 'Lead saved.');
    await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ClientProfileScreen(clientId: id)));
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.clientId != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(editing ? 'Edit lead' : 'Add lead', style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          if (!editing)
            IconButton(
              tooltip: 'Clear form',
              icon: const Icon(Icons.cleaning_services_outlined),
              onPressed: () => setState(() => _formGeneration++),
            ),
        ],
      ),
      body: AsyncBody<_LeadFormData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) => _LeadForm(
          key: ValueKey(_formGeneration),
          products: data.products,
          initial: data.client,
          onSaved: _saved,
        ),
      ),
    );
  }
}

class _LeadForm extends StatefulWidget {
  const _LeadForm({super.key, required this.products, required this.initial, required this.onSaved});
  final List<Product> products;
  final Client? initial;
  final Future<void> Function(int id) onSaved;

  @override
  State<_LeadForm> createState() => _LeadFormState();
}

class _LeadFormState extends State<_LeadForm> {
  final _form = GlobalKey<FormState>();
  late final Client? _c = widget.initial;

  late final _name = TextEditingController(text: _c?.name);
  late final _phone = TextEditingController(text: _c?.phone);
  late final _whatsapp = TextEditingController(text: _c?.whatsapp);
  late final _email = TextEditingController(text: _c?.email);
  late final _location = TextEditingController(text: _c?.location);
  late final _company = TextEditingController(text: _c?.company);
  late final _jobTitle = TextEditingController(text: _c?.jobTitle);
  late final _nationality = TextEditingController(text: _c?.nationality);
  late final _salary = TextEditingController(text: _amountText(_c?.salary));
  late final _requested = TextEditingController(text: _amountText(_c?.requestedAmount));
  late final _remarks = TextEditingController(text: _c?.remarks);

  late bool _whatsappSame = (_c?.whatsapp ?? '').trim().isEmpty;
  late int? _productId = _c?.productId;
  late String _source = _c?.source ?? '';
  late LeadStatus _status = _c?.status ?? LeadStatus.newLead;
  late Priority _priority = _c?.priority ?? Priority.medium;
  late int _rating = _c?.rating ?? 0;
  DateTime? _followupAt;
  bool _saving = false;

  static String _amountText(double? v) => v == null ? '' : v.toStringAsFixed(v.truncateToDouble() == v ? 0 : 2);

  @override
  void dispose() {
    for (final c in [_name, _phone, _whatsapp, _email, _location, _company, _jobTitle, _nationality, _salary, _requested, _remarks]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _amountValidator(String? v) {
    try {
      parseAmount(v ?? '');
      return null;
    } on FormatException catch (e) {
      return e.message;
    }
  }

  /// Products offered: active ones, plus the client's current product even if
  /// it was made inactive (guide §22: inactive products stay on existing clients).
  List<Product> get _productChoices =>
      widget.products.where((p) => p.active || p.id == _productId).toList();

  Future<void> _save() async {
    if (_saving) return;
    if (!_form.currentState!.validate()) {
      _revealFirstError();
      showSnack(context, 'Please fix the highlighted fields.');
      return;
    }
    final db = CrmDatabase.instance;
    try {
      // Ask about duplicates before showing the saving spinner: nothing is
      // being saved while the question is open.
      final dupes = await db.clientsWithPhone(_phone.text, excludeId: _c?.id);
      if (dupes.isNotEmpty && mounted) {
        final choice = await _askDuplicate(dupes.first);
        if (choice == _DupChoice.cancel || !mounted) return;
        if (choice == _DupChoice.viewExisting) {
          await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ClientProfileScreen(clientId: dupes.first.id!)));
          return;
        }
      }
      if (!mounted) return;
      setState(() => _saving = true);
      final client = Client(
        id: _c?.id,
        name: _name.text,
        phone: _phone.text,
        whatsapp: _whatsappSame ? '' : _whatsapp.text,
        email: _email.text,
        location: _location.text,
        company: _company.text,
        jobTitle: _jobTitle.text,
        nationality: _nationality.text,
        salary: parseAmount(_salary.text),
        requestedAmount: parseAmount(_requested.text),
        approvedAmount: _c?.approvedAmount,
        disbursedAmount: _c?.disbursedAmount,
        productId: _productId,
        productName: widget.products.where((p) => p.id == _productId).firstOrNull?.name,
        source: _source,
        status: _status,
        priority: _priority,
        rating: _rating,
        remarks: _remarks.text,
        isSample: _c?.isSample ?? false,
      );
      final id = await db.saveClient(client);
      if (_followupAt != null) await db.addFollowup(id, _followupAt!);
      if (mounted) await widget.onSaved(id);
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save the lead: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Scrolls the first field with a validation error into view.
  void _revealFirstError() {
    FormFieldState<Object?>? first;
    void visit(Element e) {
      if (first != null) return;
      if (e is StatefulElement && e.state is FormFieldState && (e.state as FormFieldState).hasError) {
        first = e.state as FormFieldState<Object?>;
        return;
      }
      e.visitChildElements(visit);
    }

    _form.currentContext?.visitChildElements(visit);
    final ctx = first?.context;
    if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 250), alignment: 0.1);
  }

  Future<_DupChoice> _askDuplicate(Client existing) async =>
      await showDialog<_DupChoice>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Potential duplicate customer found'),
          content: Text('${existing.name} already has this number (${existing.phone}).'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, _DupChoice.cancel), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, _DupChoice.viewExisting), child: const Text('View existing record')),
            FilledButton(onPressed: () => Navigator.pop(ctx, _DupChoice.continueAnyway), child: const Text('Continue anyway')),
          ],
        ),
      ) ??
      _DupChoice.cancel;

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 20, 0, 8),
        child: Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: brandPurple, fontWeight: FontWeight.w800)),
      );

  Widget _field(TextEditingController c, String label,
          {String? key, TextInputType? type, String? Function(String?)? validator, int maxLines = 1, TextCapitalization caps = TextCapitalization.none}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextFormField(
          key: key == null ? null : Key(key),
          controller: c,
          keyboardType: type,
          maxLines: maxLines,
          textCapitalization: caps,
          validator: validator,
          decoration: InputDecoration(labelText: label),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final isNew = _c == null;
    return Form(
      key: _form,
      // Every field is built (no lazy ListView): Form.validate() only checks
      // fields that exist, so a lazily built list would skip off-screen ones.
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _section('Contact'),
        _field(_name, 'Full name *', key: 'lead-name', caps: TextCapitalization.words, validator: (v) => Validators.required(v, 'Full name')),
        _field(_phone, 'Phone *', key: 'lead-phone', type: TextInputType.phone,
            validator: (v) => Validators.required(v, 'Phone') ?? Validators.phone(v)),
        SwitchListTile(
          key: const Key('lead-whatsapp-same'),
          contentPadding: EdgeInsets.zero,
          title: const Text('WhatsApp same as phone'),
          value: _whatsappSame,
          onChanged: (v) => setState(() => _whatsappSame = v),
        ),
        if (!_whatsappSame)
          _field(_whatsapp, 'WhatsApp number', key: 'lead-whatsapp', type: TextInputType.phone,
              validator: (v) => Validators.required(v, 'WhatsApp number') ?? Validators.phone(v)),
        _field(_email, 'Email', key: 'lead-email', type: TextInputType.emailAddress, validator: Validators.email),
        _field(_location, 'Location / area', key: 'lead-location', caps: TextCapitalization.words),
        _section('Work & finance'),
        _field(_company, 'Company', key: 'lead-company', caps: TextCapitalization.words),
        _field(_jobTitle, 'Job title', key: 'lead-job', caps: TextCapitalization.words),
        _field(_nationality, 'Nationality', key: 'lead-nationality', caps: TextCapitalization.words),
        _field(_salary, 'Monthly salary (AED)', key: 'lead-salary', type: const TextInputType.numberWithOptions(decimal: true), validator: _amountValidator),
        _field(_requested, 'Requested amount (AED)', key: 'lead-requested', type: const TextInputType.numberWithOptions(decimal: true), validator: _amountValidator),
        _section('Lead'),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: DropdownButtonFormField<int?>(
            key: const Key('lead-product'),
            initialValue: _productId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Product'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Not chosen')),
              for (final p in _productChoices)
                DropdownMenuItem<int?>(value: p.id, child: Text(p.active ? p.name : '${p.name} (inactive)')),
            ],
            onChanged: (v) => setState(() => _productId = v),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: DropdownButtonFormField<String>(
            key: const Key('lead-source'),
            initialValue: _source,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Lead source'),
            items: [
              const DropdownMenuItem(value: '', child: Text('Not chosen')),
              for (final s in {...leadSources, if (_source.isNotEmpty) _source}) DropdownMenuItem(value: s, child: Text(s)),
            ],
            onChanged: (v) => setState(() => _source = v ?? ''),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: DropdownButtonFormField<LeadStatus>(
            key: const Key('lead-status'),
            initialValue: _status,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Status'),
            items: [for (final s in LeadStatus.values) DropdownMenuItem(value: s, child: Text(s.label))],
            onChanged: (v) => setState(() => _status = v!),
            validator: (v) {
              // Approved/Disbursed need an amount: use Change status on the
              // profile, which asks for it, unless one is already stored.
              if (v == LeadStatus.approved && (_c?.approvedAmount == null)) return 'Use "Change status" on the profile to enter the approved amount';
              if (v == LeadStatus.disbursed && (_c?.disbursedAmount == null)) return 'Use "Change status" on the profile to enter the disbursed amount';
              return null;
            },
          ),
        ),
        const Text('Priority'),
        const SizedBox(height: 6),
        SegmentedButton<Priority>(
          key: const Key('lead-priority'),
          segments: [for (final p in Priority.values) ButtonSegment(value: p, label: Text(p.label))],
          selected: {_priority},
          onSelectionChanged: (s) => setState(() => _priority = s.single),
        ),
        const SizedBox(height: 10),
        Row(children: [
          const Text('Rating'),
          const SizedBox(width: 8),
          StarRating(rating: _rating, onChanged: (v) => setState(() => _rating = v), size: 26),
        ]),
        if (isNew)
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 10),
            child: Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('lead-followup'),
                  onPressed: () async {
                    final d = await pickDateTime(context, initial: _followupAt);
                    if (d != null && mounted) setState(() => _followupAt = d);
                  },
                  icon: const Icon(Icons.event),
                  label: Text(_followupAt == null ? 'Schedule followup' : 'Followup ${dateTimeLabel(_followupAt!)}'),
                ),
              ),
              if (_followupAt != null)
                IconButton(tooltip: 'Remove followup', onPressed: () => setState(() => _followupAt = null), icon: const Icon(Icons.close)),
            ]),
          ),
        _field(_remarks, 'Remarks', key: 'lead-remarks', maxLines: 3),
        const SizedBox(height: 8),
        FilledButton.icon(
          key: const Key('lead-save'),
          onPressed: _saving ? null : _save,
          icon: _saving
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.check),
          label: Text(isNew ? 'Save lead' : 'Save changes'),
        ),
      ])),
    );
  }
}

enum _DupChoice { cancel, viewExisting, continueAnyway }
