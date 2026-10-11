import 'dart:io';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;

import '../core/constants/motivation_messages.dart';
import '../core/security/file_vault.dart';
import '../core/services/analytics_service.dart';
import '../core/services/file_storage_service.dart';
import '../core/services/notification_service.dart';
import '../core/utils/date_utils.dart';
import '../core/utils/formatters.dart';
import '../core/utils/id.dart';
import '../data/repositories/repositories.dart';
import '../data/seed/defaults.dart';
import '../data/seed/sample_data.dart';
import '../domain/entities/activity.dart';
import '../domain/entities/call_log.dart';
import '../domain/entities/client.dart';
import '../domain/entities/client_document.dart';
import '../domain/entities/document_category.dart';
import '../domain/entities/message_template.dart';
import '../domain/entities/enums.dart';
import '../domain/entities/followup.dart';
import '../domain/entities/product.dart';
import '../domain/entities/voice_note.dart';
import '../domain/services/document_checklist.dart';
import '../domain/services/duplicate_detector.dart';
import '../domain/services/motivation_picker.dart';
import '../domain/services/status_automation.dart';
import '../domain/services/template_renderer.dart';
import 'app_providers.dart';

/// Application use-cases. Every UI mutation goes through here so the
/// timeline, reminders, denormalised fields and sync stay consistent.
class CrmActions {
  CrmActions(this.ref);
  final Ref ref;

  ClientRepository get _clients => ref.read(clientRepoProvider);
  FollowupRepository get _followups => ref.read(followupRepoProvider);
  ActivityRepository get _activities => ref.read(activityRepoProvider);
  DocumentRepository get _docs => ref.read(documentRepoProvider);
  NotificationService get _notifications => NotificationService.instance;

  DateTime get _now => DateTime.now();

  void _sync() => ref.read(syncServiceProvider).requestSync();

  Future<void> _log(String? clientId, ActivityType type, String title, {String? detail, LeadStatus? from, LeadStatus? to}) {
    final now = _now;
    return _activities.upsert(Activity(
      id: newId(),
      createdAt: now,
      updatedAt: now,
      clientId: clientId,
      type: type,
      title: title,
      detail: detail,
      fromStatus: from,
      toStatus: to,
      at: now,
    ));
  }

  // ── Clients ──────────────────────────────────────────────────────────────

  DuplicateMatch? findDuplicate(Client candidate) => DuplicateDetector.find(candidate, _clients.getAll());

  /// Creates or updates a client. When [followupAt] is given a pending
  /// followup is created / moved and its reminders scheduled.
  Future<Client> saveClient(Client client, {DateTime? followupAt, String? followupNote}) async {
    final existing = _clients.getById(client.id);
    var c = client;
    if (existing != null && existing.status != client.status) {
      c = c.copyWith(statusChangedAt: _now);
    }
    await _clients.upsert(c);
    if (existing == null) {
      await _log(c.id, ActivityType.created, 'Lead created', detail: '${c.leadSource.label} · ${c.status.label}');
      Telemetry.event('lead_created', {'source': c.leadSource.name});
    } else if (existing.status != c.status) {
      await _log(c.id, ActivityType.statusChanged, 'Status → ${c.status.label}', from: existing.status, to: c.status);
    } else {
      await _log(c.id, ActivityType.updated, 'Details updated');
    }
    if (followupAt != null) {
      final next = _followups.nextPendingFor(c.id);
      if (next == null) {
        await scheduleFollowup(c.id, followupAt, note: followupNote);
      } else if (next.dueAt != followupAt) {
        await rescheduleFollowup(next, followupAt);
      }
    }
    _sync();
    return _clients.getById(c.id)!;
  }

  Future<void> changeStatus(Client c, LeadStatus status, {double? amount}) async {
    if (c.status == status && amount == null) return;
    final updated = c.copyWith(
      status: status,
      statusChangedAt: _now,
      approvedAmount: status == LeadStatus.approved ? (amount ?? c.approvedAmount ?? c.requestedAmount) : c.approvedAmount,
      disbursedAmount: status == LeadStatus.disbursed ? (amount ?? c.disbursedAmount ?? c.approvedAmount) : c.disbursedAmount,
    );
    await _clients.upsert(updated);
    await _log(c.id, ActivityType.statusChanged, _statusTitle(status),
        from: c.status, to: status, detail: amount == null ? null : Fmt.aed(amount));
    if (status.isConverted) Telemetry.event('lead_converted', {'status': status.name});
    if (status == LeadStatus.documentsRequested) await requestChecklistDocuments(updated);
    if (!status.isOpen) {
      // Closed leads need no more reminders.
      for (final f in _followups.forClient(c.id).where((f) => f.isPending)) {
        await _notifications.cancelFollowup(f);
      }
    }
    _sync();
  }

  /// Timeline wording for a status change.
  static String _statusTitle(LeadStatus s) => switch (s) {
        LeadStatus.applicationSubmitted => 'Application submitted',
        LeadStatus.approved => 'Application approved',
        LeadStatus.disbursed => 'Loan disbursed',
        LeadStatus.rejected => 'Application rejected',
        _ => 'Status → ${s.label}',
      };

  Future<void> deleteClient(Client c) async {
    await _clients.softDelete(c.id);
    for (final f in _followups.forClient(c.id)) {
      await _notifications.cancelFollowup(f);
      await _followups.softDelete(f.id);
    }
    _sync();
  }

  Future<void> restoreClient(Client c) async {
    await _clients.upsert(c.copyWith(deleted: false));
    for (final f in _followups.getAll(includeDeleted: true).where((f) => f.clientId == c.id)) {
      final restored = f.copyWith(deleted: false);
      await _followups.upsert(restored);
      if (restored.isPending) await _notifications.scheduleFollowup(restored, c, offsetsMinutes: ref.read(settingsStoreProvider).reminderOffsets);
    }
    _sync();
  }

  /// Merges [duplicate] into [primary]: fields, then every related record.
  Future<Client> mergeClients(Client primary, Client duplicate) async {
    final merged = DuplicateDetector.merge(primary, duplicate);
    await _clients.upsert(merged);
    Future<void> move<T>(List<T> items, Future<void> Function(T) put) async {
      for (final i in items) {
        await put(i);
      }
    }

    final fus = _followups.getAll().where((f) => f.clientId == duplicate.id).toList();
    await move(fus, (f) => _followups.upsert(Followup.fromMap({...f.toMap(), 'clientId': primary.id})));
    final calls = ref.read(callLogRepoProvider);
    await move(calls.getAll().where((x) => x.clientId == duplicate.id).toList(),
        (x) => calls.upsert(CallLog.fromMap({...x.toMap(), 'clientId': primary.id})));
    final notes = ref.read(voiceNoteRepoProvider);
    await move(notes.getAll().where((x) => x.clientId == duplicate.id).toList(),
        (x) => notes.upsert(VoiceNote.fromMap({...x.toMap(), 'clientId': primary.id})));
    for (final d in _docs.forClient(duplicate.id)) {
      if (!d.hasFile && _docs.inCategory(primary.id, d.categoryId).isNotEmpty) {
        await _docs.softDelete(d.id);
      } else {
        // Files stay where they are; only ownership changes.
        await _docs.upsert(ClientDocument.fromMap({...d.toMap(), 'clientId': primary.id}));
      }
    }
    await move(_activities.getAll().where((x) => x.clientId == duplicate.id).toList(),
        (x) => _activities.upsert(Activity.fromMap({...x.toMap(), 'clientId': primary.id})));
    await _clients.softDelete(duplicate.id);
    await _log(primary.id, ActivityType.merged, 'Merged duplicate', detail: duplicate.name);
    await _refreshNextFollowup(primary.id);
    _sync();
    return _clients.getById(primary.id)!;
  }

  // ── Followups ────────────────────────────────────────────────────────────

  Future<void> _refreshNextFollowup(String clientId) async {
    final c = _clients.getById(clientId);
    if (c == null) return;
    final next = _followups.nextPendingFor(clientId);
    if (c.nextFollowupAt != next?.dueAt) await _clients.upsert(c.copyWith(nextFollowupAt: next?.dueAt));
  }

  Future<Followup> scheduleFollowup(String clientId, DateTime dueAt, {String? note}) async {
    final now = _now;
    final f = Followup(id: newId(), createdAt: now, updatedAt: now, clientId: clientId, dueAt: dueAt, note: note);
    await _followups.upsert(f);
    final c = _clients.getById(clientId);
    if (c != null) await _notifications.scheduleFollowup(f, c, offsetsMinutes: ref.read(settingsStoreProvider).reminderOffsets);
    await _log(clientId, ActivityType.followupScheduled, 'Followup scheduled', detail: Fmt.dateTime(dueAt));
    await _refreshNextFollowup(clientId);
    _sync();
    return f;
  }

  Future<void> rescheduleFollowup(Followup f, DateTime dueAt) async {
    final updated = f.copyWith(dueAt: dueAt, missedNotified: false);
    await _followups.upsert(updated);
    final c = _clients.getById(f.clientId);
    if (c != null) await _notifications.scheduleFollowup(updated, c, offsetsMinutes: ref.read(settingsStoreProvider).reminderOffsets);
    await _log(f.clientId, ActivityType.followupScheduled, 'Followup rescheduled', detail: Fmt.dateTime(dueAt));
    await _refreshNextFollowup(f.clientId);
    _sync();
  }

  Future<void> completeFollowup(Followup f, {String? outcomeNote}) async {
    await _followups.upsert(f.copyWith(status: FollowupStatus.completed, completedAt: _now, note: outcomeNote ?? f.note));
    await _notifications.cancelFollowup(f);
    await _log(f.clientId, ActivityType.followupCompleted, 'Followup completed', detail: outcomeNote ?? f.note);
    await _refreshNextFollowup(f.clientId);
    Telemetry.event('followup_completed');
    _sync();
  }

  Future<void> deleteFollowup(Followup f) async {
    await _notifications.cancelFollowup(f);
    await _followups.softDelete(f.id);
    await _refreshNextFollowup(f.clientId);
    _sync();
  }

  /// Re-arms every pending reminder (after restore, offset change or boot).
  Future<void> rescheduleAllReminders() async {
    final offsets = ref.read(settingsStoreProvider).reminderOffsets;
    await _notifications.cancelAll();
    for (final f in _followups.pending()) {
      final c = _clients.getById(f.clientId);
      if (c != null && c.status.isOpen) await _notifications.scheduleFollowup(f, c, offsetsMinutes: offsets);
    }
  }

  /// Sends a "missed followup" notification once per overdue followup.
  Future<int> notifyMissed() async {
    var n = 0;
    final now = _now;
    for (final f in _followups.pending().where((f) => f.isOverdue(now) && !f.missedNotified)) {
      final c = _clients.getById(f.clientId);
      if (c == null || !c.status.isOpen) continue;
      await _notifications.showMissed(f, c);
      await _followups.upsert(f.copyWith(missedNotified: true));
      n++;
    }
    return n;
  }

  // ── Calls ────────────────────────────────────────────────────────────────

  /// Applies a call outcome (FR CALL-03). Returns the suggested followup
  /// time when the UI should offer to schedule one.
  Future<OutcomeEffect> logCall(Client c, CallOutcome outcome, {String? note, DateTime? followupAt}) async {
    final now = _now;
    await ref.read(callLogRepoProvider).upsert(CallLog(
          id: newId(),
          createdAt: now,
          updatedAt: now,
          clientId: c.id,
          calledAt: now,
          outcome: outcome,
          note: note,
        ));
    await _log(c.id, ActivityType.call, 'Call · ${outcome.label}', detail: note);
    final effect = StatusAutomation.forOutcome(outcome, c.status, now);
    var current = _clients.getById(c.id) ?? c;
    if (effect.markWrongNumber || effect.newPriority != null) {
      current = current.copyWith(wrongNumber: effect.markWrongNumber ? true : null, priority: effect.newPriority);
      await _clients.upsert(current);
    }
    if (effect.newStatus != null && effect.newStatus != current.status) {
      await changeStatus(current, effect.newStatus!);
    }
    final when = followupAt ?? (effect.askForFollowup ? null : effect.suggestFollowupAt);
    if (when != null) await scheduleFollowup(c.id, when, note: 'After call: ${outcome.label}');
    Telemetry.event('call_logged', {'outcome': outcome.name});
    _sync();
    return effect;
  }

  Future<void> setPendingCall(String? clientId) => ref.read(settingsStoreProvider).setPendingCall(clientId);

  // ── WhatsApp & message templates ─────────────────────────────────────────

  /// Logs a WhatsApp action ("Chat opened", template name, "Client details shared").
  Future<void> logWhatsApp(Client c, {String what = 'Chat opened'}) async {
    await _log(c.id, ActivityType.whatsapp, 'WhatsApp sent · $what');
    _sync();
  }

  /// Fills a template's tags with this client's values.
  String renderTemplate(MessageTemplate t, Client c) =>
      TemplateRenderer.render(t.body, TemplateRenderer.valuesFor(c, productName: ref.read(productNamesProvider)[c.productId]));

  String clientSummary(Client c) => TemplateRenderer.clientSummary(c, productName: ref.read(productNamesProvider)[c.productId]);

  TemplateRepository get _templates => ref.read(templateRepoProvider);

  Future<void> saveTemplate(MessageTemplate t) async {
    await _templates.upsert(t);
    if (t.isDefault) await setDefaultTemplate(t);
    _sync();
  }

  Future<MessageTemplate> createTemplate(String name, String body) async {
    final now = _now;
    final all = _templates.getAll();
    final t = MessageTemplate(
      id: newId(),
      createdAt: now,
      updatedAt: now,
      name: name,
      body: body,
      isDefault: all.isEmpty,
      sortOrder: all.fold<int>(-1, (m, x) => x.sortOrder > m ? x.sortOrder : m) + 1,
    );
    await _templates.upsert(t);
    _sync();
    return t;
  }

  Future<MessageTemplate> duplicateTemplate(MessageTemplate t) => createTemplate('${t.name} (copy)', t.body);

  /// Makes [t] the only default template.
  Future<void> setDefaultTemplate(MessageTemplate t) async {
    final changed = [
      for (final x in _templates.getAll())
        if (x.isDefault != (x.id == t.id)) x.copyWith(isDefault: x.id == t.id),
    ];
    if (changed.isNotEmpty) await _templates.upsertAll(changed);
    _sync();
  }

  Future<void> deleteTemplate(MessageTemplate t) async {
    await _templates.softDelete(t.id);
    if (t.isDefault) {
      final rest = _templates.getAll()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      if (rest.isNotEmpty) await setDefaultTemplate(rest.first);
    }
    _sync();
  }

  Future<void> reorderTemplates(List<MessageTemplate> ordered) async {
    await _templates.upsertAll([for (var i = 0; i < ordered.length; i++) ordered[i].copyWith(sortOrder: i)]);
    _sync();
  }

  // ── Document vault ───────────────────────────────────────────────────────

  String _categoryName(String id) => ref.read(categoryNamesProvider)[id] ?? 'Document';

  /// Display name of a document (custom title or its category).
  String documentName(ClientDocument d) => d.title ?? _categoryName(d.categoryId);

  /// Requests every checklist document the client hasn't provided yet.
  Future<void> requestChecklistDocuments(Client c) async {
    final product = ref.read(productRepoProvider).getById(c.productId ?? '');
    final list = DocumentChecklist.build(product, _docs.forClient(c.id));
    final missing = [for (final i in list.items) if (!i.done && i.status != DocumentStatus.requested) i.categoryId];
    if (missing.isNotEmpty) await requestDocuments(c.id, missing);
  }

  /// Marks checklist documents as Requested (creating placeholders).
  Future<void> requestDocuments(String clientId, Iterable<String> categoryIds) async {
    final now = _now;
    for (final cat in categoryIds) {
      final inCat = _docs.inCategory(clientId, cat);
      if (inCat.any((d) => d.status.isCollected)) continue;
      final placeholder = inCat.where((d) => !d.hasFile).firstOrNull;
      await _docs.upsert(placeholder?.copyWith(status: DocumentStatus.requested) ??
          ClientDocument(id: newId(), createdAt: now, updatedAt: now, clientId: clientId, categoryId: cat, status: DocumentStatus.requested));
    }
    await _log(clientId, ActivityType.document, 'Documents requested', detail: categoryIds.map(_categoryName).join(', '));
    _sync();
  }

  Future<String> _storeEncrypted(String clientId, String docId, String sourcePath) async {
    final dir = await FileStore.vaultDir(clientId);
    final dest = p.join(dir.path, '$docId.enc');
    await FileVault.instance.encryptFile(sourcePath, dest);
    return dest;
  }

  /// Adds files to a client's vault category (each file = one document).
  /// A Pending/Requested placeholder in that category is filled first.
  Future<List<ClientDocument>> addDocumentFiles(
    String clientId,
    String categoryId,
    List<String> sourcePaths, {
    String? title,
    DateTime? expiryDate,
    String source = 'Uploaded',
  }) async {
    final out = <ClientDocument>[];
    var placeholder = _docs.inCategory(clientId, categoryId).where((d) => !d.hasFile).firstOrNull;
    for (final src in sourcePaths) {
      final now = _now;
      final id = placeholder?.id ?? newId();
      final stored = await _storeEncrypted(clientId, id, src);
      final base = placeholder ?? ClientDocument(id: id, createdAt: now, updatedAt: now, clientId: clientId, categoryId: categoryId);
      final doc = base.copyWith(
        title: title ?? (sourcePaths.length > 1 ? p.basenameWithoutExtension(src) : null),
        filePath: stored,
        mimeType: FileStore.mimeFor(src),
        remotePath: null,
        status: DocumentStatus.received,
        expiryDate: expiryDate ?? base.expiryDate,
        encrypted: true,
      );
      await _docs.upsert(doc);
      await _scheduleExpiry(doc);
      out.add(doc);
      placeholder = null;
    }
    await _log(clientId, ActivityType.document, '$source: ${_categoryName(categoryId)}',
        detail: sourcePaths.length == 1 ? null : '${sourcePaths.length} files');
    await _advanceIfDocumentsComplete(clientId);
    _sync();
    return out;
  }

  Future<void> replaceDocumentFile(ClientDocument d, String sourcePath) async {
    await FileStore.deleteQuietly(d.filePath);
    final stored = await _storeEncrypted(d.clientId, d.id, sourcePath);
    await _docs.upsert(d.copyWith(filePath: stored, mimeType: FileStore.mimeFor(sourcePath), remotePath: null, status: DocumentStatus.received, encrypted: true));
    await _log(d.clientId, ActivityType.document, 'Document replaced: ${documentName(d)}');
    _sync();
  }

  Future<void> renameDocument(ClientDocument d, String title) async {
    await _docs.upsert(d.copyWith(title: title.trim().isEmpty ? null : title.trim()));
    _sync();
  }

  Future<void> moveDocument(ClientDocument d, String categoryId) async {
    await _docs.upsert(d.copyWith(categoryId: categoryId));
    await _log(d.clientId, ActivityType.document, 'Document moved: ${documentName(d)}', detail: '${_categoryName(d.categoryId)} → ${_categoryName(categoryId)}');
    await _advanceIfDocumentsComplete(d.clientId);
    _sync();
  }

  Future<void> setDocumentNote(ClientDocument d, String note) async {
    await _docs.upsert(d.copyWith(note: note.trim().isEmpty ? null : note.trim()));
    _sync();
  }

  Future<void> setDocumentStatus(ClientDocument d, DocumentStatus s, {String? note}) async {
    await _docs.upsert(d.copyWith(status: s, note: note ?? d.note));
    await _log(d.clientId, ActivityType.document, 'Document ${s.label.toLowerCase()}: ${documentName(d)}', detail: note);
    await _advanceIfDocumentsComplete(d.clientId);
    _sync();
  }

  Future<void> setDocumentExpiry(ClientDocument d, DateTime? expiry) async {
    final updated = d.copyWith(expiryDate: expiry, status: d.status == DocumentStatus.expired && expiry != null && expiry.isAfter(_now) ? DocumentStatus.received : null);
    await _docs.upsert(updated);
    await _scheduleExpiry(updated);
    _sync();
  }

  Future<void> deleteDocument(ClientDocument d) async {
    await FileStore.deleteQuietly(d.filePath);
    await _notifications.cancelDocumentExpiry(d);
    await _docs.softDelete(d.id);
    await _log(d.clientId, ActivityType.document, 'Document deleted: ${documentName(d)}');
    _sync();
  }

  Future<void> logDocumentShared(ClientDocument d) => _log(d.clientId, ActivityType.document, 'Document shared: ${documentName(d)}');

  /// Decrypted bytes for in-app preview (never written to disk).
  Future<List<int>> readDocument(ClientDocument d) => FileVault.instance.readFile(d.filePath!, encrypted: d.encrypted);

  /// Decrypted temporary copy for sharing / saving.
  Future<File> exportDocument(ClientDocument d) {
    final ext = FileStore.extensionForMime(d.mimeType);
    final safe = '${ref.read(clientRepoProvider).getById(d.clientId)?.name ?? 'Client'} ${documentName(d)}'.replaceAll(RegExp(r'[^A-Za-z0-9 _-]'), '').trim().replaceAll(' ', '_');
    return FileVault.instance.exportTemp(d.filePath!, encrypted: d.encrypted, fileName: '$safe$ext');
  }

  Future<void> _scheduleExpiry(ClientDocument d) async {
    final c = _clients.getById(d.clientId);
    if (c == null) return;
    await _notifications.scheduleDocumentExpiry(d, c, documentName(d));
  }

  /// Marks documents past their expiry date as Expired (once) and logs it.
  Future<int> expireDocuments() async {
    final now = _now;
    var n = 0;
    for (final d in _docs.getAll().where((d) => d.expiryDate != null && d.status != DocumentStatus.expired && DocumentExpiry.isExpired(d, now))) {
      await _docs.upsert(d.copyWith(status: DocumentStatus.expired));
      await _log(d.clientId, ActivityType.document, 'Document expired: ${documentName(d)}', detail: Fmt.date(d.expiryDate!));
      n++;
    }
    if (n > 0) _sync();
    return n;
  }

  /// When every checklist document is collected while the lead sits in
  /// "Documents Requested", advance it to "Documents Received".
  Future<void> _advanceIfDocumentsComplete(String clientId) async {
    final c = _clients.getById(clientId);
    if (c == null || c.status != LeadStatus.documentsRequested) return;
    final product = ref.read(productRepoProvider).getById(c.productId ?? '');
    if (DocumentChecklist.build(product, _docs.forClient(clientId)).isComplete) {
      await changeStatus(c, LeadStatus.documentsReceived);
    }
  }

  /// Saves OCR text as a note on the client (notes section).
  Future<void> saveOcrNote(String clientId, String text, {String? source}) =>
      addVoiceNote(clientId, transcript: source == null ? text : 'OCR · $source\n$text');

  // ── Document categories ──────────────────────────────────────────────────

  CategoryRepository get _categories => ref.read(categoryRepoProvider);

  Future<void> addCategory(String name) async {
    final now = _now;
    final all = _categories.getAll();
    await _categories.upsert(DocumentCategory(
      id: newId(),
      createdAt: now,
      updatedAt: now,
      name: name.trim(),
      sortOrder: all.fold<int>(-1, (m, x) => x.sortOrder > m ? x.sortOrder : m) + 1,
    ));
    _sync();
  }

  Future<void> saveCategory(DocumentCategory c) async {
    await _categories.upsert(c);
    _sync();
  }

  Future<void> reorderCategories(List<DocumentCategory> ordered) async {
    await _categories.upsertAll([for (var i = 0; i < ordered.length; i++) ordered[i].copyWith(sortOrder: i)]);
    _sync();
  }

  /// Deletes a category; its documents move to "Other Documents".
  Future<void> deleteCategory(DocumentCategory c) async {
    if (c.id == DocumentCategory.other) return;
    for (final d in _docs.getAll().where((d) => d.categoryId == c.id)) {
      await _docs.upsert(d.copyWith(categoryId: DocumentCategory.other));
    }
    await _categories.softDelete(c.id);
    _sync();
  }

  // ── Voice notes ──────────────────────────────────────────────────────────

  Future<void> addVoiceNote(String clientId, {String? filePath, int durationMs = 0, String? transcript}) async {
    final now = _now;
    await ref.read(voiceNoteRepoProvider).upsert(VoiceNote(
          id: newId(),
          createdAt: now,
          updatedAt: now,
          clientId: clientId,
          filePath: filePath,
          durationMs: durationMs,
          transcript: transcript,
        ));
    await _log(clientId, ActivityType.voiceNote, filePath == null ? 'Dictated note' : 'Voice note recorded',
        detail: transcript == null ? Fmt.duration(durationMs) : (transcript.length > 80 ? '${transcript.substring(0, 80)}…' : transcript));
    _sync();
  }

  Future<void> updateVoiceTranscript(VoiceNote v, String transcript) async {
    await ref.read(voiceNoteRepoProvider).upsert(v.copyWith(transcript: transcript));
    _sync();
  }

  Future<void> deleteVoiceNote(VoiceNote v) async {
    await FileStore.deleteQuietly(v.filePath);
    await ref.read(voiceNoteRepoProvider).softDelete(v.id);
    _sync();
  }

  Future<void> logReport(String clientId, String fileName) => _log(clientId, ActivityType.report, 'Report generated', detail: fileName);

  // ── Products ─────────────────────────────────────────────────────────────

  Future<void> saveProduct(Product p) async {
    await ref.read(productRepoProvider).upsert(p);
    _sync();
  }

  Future<void> deleteProduct(Product p) async {
    await ref.read(productRepoProvider).softDelete(p.id);
    _sync();
  }

  // ── Onboarding & sample data ─────────────────────────────────────────────

  Future<void> seedDefaults(Iterable<String> productNames) async {
    final repo = ref.read(productRepoProvider);
    if (repo.getAll().isEmpty) await repo.upsertAll(Defaults.products(productNames));
    final cats = ref.read(categoryRepoProvider);
    if (cats.getAll(includeDeleted: true).isEmpty) await cats.upsertAll(Defaults.categories());
    final t = ref.read(templateRepoProvider);
    if (t.getAll(includeDeleted: true).isEmpty) await t.upsertAll(Defaults.templates(agent: ref.read(profileProvider).firstName));
  }

  Future<int> loadSampleData() async {
    final products = ref.read(productRepoProvider).active();
    final b = SampleData.generate(products);
    await _clients.upsertAll(b.clients);
    await _followups.upsertAll(b.followups);
    await ref.read(callLogRepoProvider).upsertAll(b.calls);
    await _docs.upsertAll(b.documents);
    await _activities.upsertAll(b.activities);
    final offsets = ref.read(settingsStoreProvider).reminderOffsets;
    final byId = {for (final c in b.clients) c.id: c};
    for (final f in b.followups.where((f) => f.isPending && f.dueAt.isAfter(_now))) {
      await _notifications.scheduleFollowup(f, byId[f.clientId]!, offsetsMinutes: offsets);
    }
    _sync();
    return b.clients.length;
  }

  Future<int> clearSampleData() async {
    final ids = _clients.getAll().where((c) => (c.remarks ?? '').startsWith(SampleData.marker)).map((c) => c.id).toSet();
    for (final id in ids) {
      for (final f in _followups.forClient(id)) {
        await _notifications.cancelFollowup(f);
        await _followups.softDelete(f.id);
      }
      for (final d in _docs.forClient(id)) {
        await _docs.softDelete(d.id);
      }
      final calls = ref.read(callLogRepoProvider);
      for (final x in calls.getAll().where((x) => x.clientId == id)) {
        await calls.softDelete(x.id);
      }
      for (final a in _activities.getAll().where((a) => a.clientId == id)) {
        await _activities.softDelete(a.id);
      }
      await _clients.softDelete(id);
    }
    _sync();
    return ids.length;
  }

  // ── Motivation ───────────────────────────────────────────────────────────

  /// Picks today's motivation (no repeat within the last 30) or null if
  /// the user turned motivation off.
  Future<MotivationMessage?> nextMotivation({Random? rng}) async {
    final s = ref.read(settingsStoreProvider);
    if (!s.motivationEnabled) return null;
    final r = MotivationPicker.pick(total: kMotivationMessages.length, history: s.motivationHistory, rng: rng ?? Random());
    await s.setMotivationHistory(r.history);
    return kMotivationMessages[r.index];
  }

  /// Clients needing attention today, for widgets.
  bool isToday(DateTime d) => DateX.sameDay(d, _now);
}

final crmActionsProvider = Provider<CrmActions>((ref) => CrmActions(ref));
