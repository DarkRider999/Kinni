import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

import '../../core/constants/app_assets.dart';
import '../../core/services/file_storage_service.dart';
import '../../core/services/permission_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/id.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../domain/services/duplicate_detector.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../card_scanner/card_scanner_screen.dart';
import '../common/date_time_picker.dart';
import '../maps/location_picker_screen.dart';
import 'client_profile_screen.dart';

enum _DupChoice { open, merge, saveAnyway }

/// Add / edit client form.
class ClientFormScreen extends ConsumerStatefulWidget {
  const ClientFormScreen({super.key, this.existing, this.embedded = false});

  final Client? existing;

  /// True when shown inside the Add Lead tab (no back button; form resets after save).
  final bool embedded;

  @override
  ConsumerState<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends ConsumerState<ClientFormScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _whatsapp = TextEditingController();
  final _email = TextEditingController();
  final _location = TextEditingController();
  final _company = TextEditingController();
  final _jobTitle = TextEditingController();
  final _nationality = TextEditingController();
  final _salary = TextEditingController();
  final _requested = TextEditingController();
  final _remarks = TextEditingController();

  /// Id of the record being edited, or a fresh id for a new lead (so files
  /// can be stored in the client's folder on save).
  late String _id;
  bool _sameAsPhone = true;
  double? _lat;
  double? _lng;
  String? _productId;
  LeadSource _source = LeadSource.other;
  LeadStatus _status = LeadStatus.newLead;
  Priority _priority = Priority.medium;
  int _rating = 0;
  DateTime? _followupAt;

  /// Stored photo of the client (already inside the client folder).
  String? _photoPath;

  /// Newly chosen photo not yet copied into the client folder.
  String? _pendingPhotoPath;
  Uint8List? _pendingPhotoBytes;

  bool _saving = false;

  /// Bumped on reset so every field rebuilds from the fresh values.
  int _generation = 0;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _load(widget.existing);
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  List<TextEditingController> get _controllers =>
      [_name, _phone, _whatsapp, _email, _location, _company, _jobTitle, _nationality, _salary, _requested, _remarks];

  /// Fills the form from [c], or clears it for a new lead.
  void _load(Client? c) {
    String num(double? v) => v == null ? '' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : '$v');
    _id = c?.id ?? newId();
    _name.text = c?.name ?? '';
    _phone.text = c?.phone ?? '';
    _sameAsPhone = c == null || c.whatsapp == null || c.whatsapp!.trim().isEmpty || c.whatsapp == c.phone;
    _whatsapp.text = _sameAsPhone ? '' : c!.whatsapp!;
    _email.text = c?.email ?? '';
    _location.text = c?.location ?? '';
    _company.text = c?.company ?? '';
    _jobTitle.text = c?.jobTitle ?? '';
    _nationality.text = c?.nationality ?? '';
    _salary.text = num(c?.monthlySalary);
    _requested.text = num(c?.requestedAmount);
    _remarks.text = c?.remarks ?? '';
    _lat = c?.latitude;
    _lng = c?.longitude;
    _productId = c?.productId;
    _source = c?.leadSource ?? LeadSource.other;
    _status = c?.status ?? LeadStatus.newLead;
    _priority = c?.priority ?? Priority.medium;
    _rating = c?.rating ?? 0;
    _followupAt = c?.nextFollowupAt;
    _photoPath = c?.photoPath;
    _pendingPhotoPath = null;
    _pendingPhotoBytes = null;
  }

  /// Clears the form for the next lead (Add Lead tab).
  void _reset() => setState(() {
        _load(null);
        _generation++;
      });

  String? _t(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  // ── Quick fill ────────────────────────────────────────────────────────────

  /// Lets the user choose the primary and WhatsApp numbers among [phones].
  Future<(String, String?)?> _choosePhones(List<String> phones) async {
    if (phones.length == 1) return (phones.first, null);
    var primary = 0;
    var wa = 0;
    return showDialog<(String, String?)>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: const Text('Choose numbers'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Primary phone', style: Theme.of(c).textTheme.labelLarge),
                RadioGroup<int>(
                  groupValue: primary,
                  onChanged: (v) => set(() => primary = v ?? 0),
                  child: Column(children: [for (var i = 0; i < phones.length; i++) RadioListTile<int>(value: i, title: Text(phones[i]), dense: true)]),
                ),
                const SizedBox(height: 8),
                Text('WhatsApp number', style: Theme.of(c).textTheme.labelLarge),
                RadioGroup<int>(
                  groupValue: wa,
                  onChanged: (v) => set(() => wa = v ?? 0),
                  child: Column(children: [for (var i = 0; i < phones.length; i++) RadioListTile<int>(value: i, title: Text(phones[i]), dense: true)]),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(c, (phones[primary], wa == primary ? null : phones[wa])),
              child: const Text('Use'),
            ),
          ],
        ),
      ),
    );
  }

  void _setPhones((String, String?) chosen) {
    _phone.text = chosen.$1;
    _sameAsPhone = chosen.$2 == null;
    _whatsapp.text = chosen.$2 ?? '';
  }

  Future<void> _importContact() async {
    final ok = await Permissions.ensure(context, ph.Permission.contacts, rationale: 'Contacts access lets you import a lead from your phone book.');
    if (!ok || !mounted) return;
    try {
      final picked = await FlutterContacts.native.showPicker();
      if (picked?.id == null || !mounted) return;
      final contact = await FlutterContacts.get(
        picked!.id!,
        properties: {
          ContactProperty.name,
          ContactProperty.phone,
          ContactProperty.email,
          ContactProperty.organization,
          ContactProperty.photoFullRes,
          ContactProperty.photoThumbnail,
        },
      );
      if (contact == null || !mounted) return;
      final phones = <String>{for (final p in contact.phones) if (p.number.trim().isNotEmpty) p.number.trim()}.toList();
      (String, String?)? chosen;
      if (phones.isNotEmpty) {
        chosen = await _choosePhones(phones);
        if (chosen == null || !mounted) return;
      }
      final org = contact.organizations.isEmpty ? null : contact.organizations.first;
      final photo = contact.photo?.fullSize ?? contact.photo?.thumbnail;
      setState(() {
        if ((contact.displayName ?? '').trim().isNotEmpty) _name.text = contact.displayName!.trim();
        if (chosen != null) _setPhones(chosen);
        if (contact.emails.isNotEmpty) _email.text = contact.emails.first.address;
        if ((org?.name ?? '').isNotEmpty) _company.text = org!.name!;
        if ((org?.jobTitle ?? '').isNotEmpty) _jobTitle.text = org!.jobTitle!;
        if (photo != null && photo.isNotEmpty) {
          _pendingPhotoBytes = photo;
          _pendingPhotoPath = null;
        }
      });
      showSnack(context, 'Contact imported');
    } catch (_) {
      if (mounted) showSnack(context, 'Could not import the contact', error: true);
    }
  }

  Future<void> _scanCard() async {
    final card = await CardScannerScreen.scan(context);
    if (card == null || !mounted) return;
    (String, String?)? chosen;
    if (card.phones.isNotEmpty) chosen = await _choosePhones(card.phones);
    if (!mounted) return;
    setState(() {
      if (card.name != null) _name.text = card.name!;
      if (chosen != null) _setPhones(chosen);
      if (card.email != null) _email.text = card.email!;
      if (card.company != null) _company.text = card.company!;
      if (card.jobTitle != null) _jobTitle.text = card.jobTitle!;
      if (!_isEdit) _source = LeadSource.businessCard;
    });
  }

  // ── Photo, map, followup ──────────────────────────────────────────────────

  Future<void> _pickPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(leading: const Icon(Icons.photo_camera_rounded), title: const Text('Camera'), onTap: () => Navigator.pop(c, ImageSource.camera)),
            ListTile(leading: const Icon(Icons.photo_library_rounded), title: const Text('Gallery'), onTap: () => Navigator.pop(c, ImageSource.gallery)),
          ],
        ),
      ),
    );
    if (source == null) return;
    try {
      final img = await ImagePicker().pickImage(source: source, maxWidth: 800, imageQuality: 85);
      if (img == null || !mounted) return;
      setState(() {
        _pendingPhotoPath = img.path;
        _pendingPhotoBytes = null;
      });
    } catch (_) {
      if (mounted) showSnack(context, 'Could not open the camera or gallery', error: true);
    }
  }

  Future<void> _pickOnMap() async {
    final p = await LocationPickerScreen.pick(context, initial: (_lat != null && _lng != null) ? LatLng(_lat!, _lng!) : null);
    if (p == null || !mounted) return;
    setState(() {
      _lat = p.latitude;
      _lng = p.longitude;
    });
  }

  Future<void> _pickFollowup() async {
    final d = await pickDateTime(context, initial: _followupAt);
    if (d != null && mounted) setState(() => _followupAt = d);
  }

  /// Copies a newly chosen photo into the client's folder.
  Future<String?> _storePhoto() async {
    if (_pendingPhotoPath != null) return FileStore.importForClient(_id, _pendingPhotoPath!, prefix: 'photo');
    if (_pendingPhotoBytes != null) {
      final path = await FileStore.newClientFilePath(_id, 'photo', '.jpg');
      await File(path).writeAsBytes(_pendingPhotoBytes!, flush: true);
      return path;
    }
    return _photoPath;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  Client _build(String? photoPath) {
    final now = DateTime.now();
    final e = widget.existing;
    final base = Client(
      id: _id,
      createdAt: e?.createdAt ?? now,
      updatedAt: now,
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      leadSource: _source,
      status: _status,
      priority: _priority,
      rating: _rating,
      statusChangedAt: e?.statusChangedAt,
      wrongNumber: e != null && e.wrongNumber && e.phone == _phone.text.trim(),
    );
    return base.copyWith(
      whatsapp: _sameAsPhone ? null : _t(_whatsapp),
      email: _t(_email),
      photoPath: photoPath,
      location: _t(_location),
      latitude: _lat,
      longitude: _lng,
      company: _t(_company),
      jobTitle: _t(_jobTitle),
      nationality: _t(_nationality),
      monthlySalary: Validators.parseAmount(_salary.text),
      requestedAmount: Validators.parseAmount(_requested.text),
      productId: _productId,
      remarks: _t(_remarks),
      nextFollowupAt: e?.nextFollowupAt,
      approvedAmount: e?.approvedAmount,
      disbursedAmount: e?.disbursedAmount,
    );
  }

  Future<_DupChoice?> _askDuplicate(DuplicateMatch m) => showDialog<_DupChoice>(
        context: context,
        builder: (c) => AlertDialog(
          icon: const Icon(Icons.people_alt_rounded, color: AppColors.warning),
          title: const Text('Possible duplicate'),
          content: Text('${m.description}.\n\n${m.existing.name} · ${m.existing.phone} · ${m.existing.status.label}'),
          actionsOverflowDirection: VerticalDirection.down,
          actionsOverflowButtonSpacing: 4,
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, _DupChoice.open), child: const Text('Open existing')),
            TextButton(onPressed: () => Navigator.pop(c, _DupChoice.merge), child: const Text('Merge')),
            FilledButton(onPressed: () => Navigator.pop(c, _DupChoice.saveAnyway), child: const Text('Save anyway')),
          ],
        ),
      );

  Future<void> _save() async {
    if (_saving) return;
    if (!(_form.currentState?.validate() ?? false)) {
      showSnack(context, 'Please fix the highlighted fields', error: true);
      return;
    }
    final actions = ref.read(crmActionsProvider);
    final nav = Navigator.of(context);
    final draft = _build(_photoPath);
    final match = actions.findDuplicate(draft);
    var choice = _DupChoice.saveAnyway;
    if (match != null && match.existing.id != draft.id) {
      choice = await _askDuplicate(match) ?? _DupChoice.saveAnyway;
      if (!mounted) return;
      if (choice == _DupChoice.open) {
        if (!widget.embedded) nav.pop();
        await ClientProfileScreen.open(widget.embedded ? context : nav.context, match.existing.id);
        return;
      }
    }
    setState(() => _saving = true);
    try {
      final photo = await _storePhoto();
      final followupChanged = _followupAt != null && _followupAt != widget.existing?.nextFollowupAt;
      var saved = await actions.saveClient(
        _build(photo),
        followupAt: followupChanged ? _followupAt : null,
        followupNote: followupChanged && !_isEdit ? 'First followup' : null,
      );
      if (!_isEdit && saved.status.isDocumentStage) await actions.requestChecklistDocuments(saved);
      if (match != null && choice == _DupChoice.merge) {
        final primary = ref.read(clientByIdProvider(match.existing.id)) ?? match.existing;
        saved = await actions.mergeClients(primary, saved);
      }
      if (!mounted) return;
      showSnack(context, choice == _DupChoice.merge ? 'Merged into ${saved.name}' : (_isEdit ? 'Changes saved' : '${saved.name} added'));
      if (widget.embedded) {
        _reset();
        await ClientProfileScreen.open(context, saved.id);
      } else if (_isEdit && choice != _DupChoice.merge) {
        nav.pop();
      } else {
        await nav.pushReplacement(MaterialPageRoute(builder: (_) => ClientProfileScreen(clientId: saved.id)));
      }
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save: $e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final products = (ref.watch(productsProvider).value ?? const []).where((p) => p.active || p.id == _productId).toList();
    if (_productId != null && !products.any((p) => p.id == _productId)) _productId = null;
    const gap = SizedBox(height: 12);

    final form = Form(
      key: _form,
      child: ListView(
        key: ValueKey(_generation),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          if (!_isEdit)
            Row(
              children: [
                Expanded(child: OutlinedButton.icon(onPressed: _importContact, icon: const Icon(Icons.contacts_rounded), label: const Text('Import contact'))),
                const SizedBox(width: 10),
                Expanded(child: OutlinedButton.icon(onPressed: _scanCard, icon: const Icon(Icons.document_scanner_rounded), label: const Text('Scan card'))),
              ],
            ),
          gap,
          Center(child: _PhotoPicker(photoPath: _pendingPhotoPath ?? _photoPath, bytes: _pendingPhotoBytes, initials: _initials, onTap: _pickPhoto)),
          gap,
          _Section(
            title: 'Contact',
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Full name *', prefixIcon: Icon(Icons.person_rounded)),
                validator: Validators.name,
                onChanged: (_) => setState(() {}),
              ),
              gap,
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone *', prefixIcon: Icon(Icons.phone_rounded)),
                validator: Validators.phone,
              ),
              CheckboxListTile(
                value: _sameAsPhone,
                onChanged: (v) => setState(() => _sameAsPhone = v ?? true),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text('WhatsApp same as phone'),
              ),
              if (!_sameAsPhone) ...[
                TextFormField(
                  controller: _whatsapp,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'WhatsApp number', prefixIcon: Icon(Icons.chat_rounded)),
                  validator: Validators.optionalPhone,
                ),
                gap,
              ],
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_rounded)),
                validator: Validators.optionalEmail,
              ),
              gap,
              TextFormField(
                controller: _location,
                decoration: const InputDecoration(labelText: 'Location / area', prefixIcon: Icon(Icons.place_rounded)),
              ),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                children: [
                  TextButton.icon(onPressed: _pickOnMap, icon: const Icon(Icons.map_rounded), label: Text(_lat == null ? 'Pick on map' : 'Change pin')),
                  if (_lat != null && _lng != null) ...[
                    Text('${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}', style: Theme.of(context).textTheme.bodySmall),
                    IconButton(
                      tooltip: 'Remove pin',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => setState(() => _lat = _lng = null),
                      icon: const Icon(Icons.close_rounded, size: 18),
                    ),
                  ],
                ],
              ),
            ],
          ),
          _Section(
            title: 'Work & finance',
            children: [
              TextFormField(controller: _company, decoration: const InputDecoration(labelText: 'Company', prefixIcon: Icon(Icons.business_rounded))),
              gap,
              TextFormField(controller: _jobTitle, decoration: const InputDecoration(labelText: 'Job title', prefixIcon: Icon(Icons.badge_rounded))),
              gap,
              TextFormField(controller: _nationality, decoration: const InputDecoration(labelText: 'Nationality', prefixIcon: Icon(Icons.flag_rounded))),
              gap,
              TextFormField(
                controller: _salary,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Monthly salary (AED)', prefixIcon: Icon(Icons.payments_rounded)),
                validator: Validators.optionalAmount,
              ),
              gap,
              TextFormField(
                controller: _requested,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Requested amount (AED)', prefixIcon: Icon(Icons.request_quote_rounded)),
                validator: Validators.optionalAmount,
              ),
            ],
          ),
          _Section(
            title: 'Lead',
            children: [
              DropdownButtonFormField<String?>(
                initialValue: _productId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Product', prefixIcon: Icon(Icons.category_rounded)),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Not decided')),
                  for (final p in products) DropdownMenuItem(value: p.id, child: Text(p.name, overflow: TextOverflow.ellipsis)),
                ],
                onChanged: (v) => setState(() => _productId = v),
              ),
              gap,
              DropdownButtonFormField<LeadSource>(
                initialValue: _source,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Lead source', prefixIcon: Icon(Icons.call_split_rounded)),
                items: [for (final s in LeadSource.values) DropdownMenuItem(value: s, child: Text(s.label))],
                onChanged: (v) => setState(() => _source = v ?? _source),
              ),
              gap,
              DropdownButtonFormField<LeadStatus>(
                initialValue: _status,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Status', prefixIcon: Icon(Icons.flag_circle_rounded)),
                items: [
                  for (final s in LeadStatus.values)
                    DropdownMenuItem(
                      value: s,
                      child: Row(children: [Icon(Icons.circle, size: 10, color: AppColors.status(s)), const SizedBox(width: 8), Text(s.label)]),
                    ),
                ],
                onChanged: (v) => setState(() => _status = v ?? _status),
              ),
              gap,
              Text('Priority', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<Priority>(
                  showSelectedIcon: false,
                  segments: [for (final p in Priority.values) ButtonSegment(value: p, label: FittedBox(child: Text(p.label)))],
                  selected: {_priority},
                  onSelectionChanged: (s) => setState(() => _priority = s.first),
                ),
              ),
              gap,
              Row(
                children: [
                  Text('Rating', style: Theme.of(context).textTheme.labelLarge),
                  const Spacer(),
                  RatingStars(value: _rating, size: 26, onChanged: (v) => setState(() => _rating = v)),
                ],
              ),
              gap,
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event_rounded, color: AppColors.primary),
                title: Text(_followupAt == null ? 'Schedule followup' : Fmt.dateTime(_followupAt!)),
                subtitle: Text(_followupAt == null ? 'Optional' : 'Next followup'),
                trailing: _followupAt == null || (_isEdit && widget.existing!.nextFollowupAt == _followupAt)
                    ? const Icon(Icons.chevron_right_rounded)
                    : IconButton(tooltip: 'Clear', onPressed: () => setState(() => _followupAt = null), icon: const Icon(Icons.close_rounded)),
                onTap: _pickFollowup,
              ),
              gap,
              TextFormField(
                controller: _remarks,
                minLines: 2,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Remarks', alignLabelWithHint: true, prefixIcon: Icon(Icons.notes_rounded)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GradientButton(label: _isEdit ? 'Save changes' : 'Save lead', icon: Icons.check_rounded, loading: _saving, onPressed: _save),
        ],
      ),
    );

    final scaffold = Scaffold(
      backgroundColor: widget.embedded ? Colors.transparent : null,
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        backgroundColor: widget.embedded ? Colors.transparent : null,
        title: Text(widget.embedded ? 'Add Lead' : (_isEdit ? 'Edit client' : 'New lead')),
        actions: [
          if (widget.embedded)
            IconButton(
              tooltip: 'Clear form',
              onPressed: _reset,
              icon: const Icon(Icons.refresh_rounded),
            ),
          TextButton(onPressed: _saving ? null : _save, child: const Text('Save')),
        ],
      ),
      body: form,
    );
    return widget.embedded ? TabBackground(image: AppAssets.tabBackgrounds[2], child: scaffold) : scaffold;
  }

  String get _initials {
    final parts = _name.text.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '+';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }
}

/// Titled glass group of form fields.
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => GlassCard(
        margin: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.primary)),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      );
}

/// Round photo with a camera badge.
class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker({required this.photoPath, required this.bytes, required this.initials, required this.onTap});
  final String? photoPath;
  final Uint8List? bytes;
  final String initials;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Stack(
          children: [
            bytes != null
                ? CircleAvatar(radius: 44, backgroundImage: MemoryImage(bytes!))
                : PersonAvatar(photoPath: photoPath, initials: initials, size: 88),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                child: const Icon(Icons.photo_camera_rounded, size: 16, color: Colors.white),
              ),
            ),
          ],
        ),
      );
}
