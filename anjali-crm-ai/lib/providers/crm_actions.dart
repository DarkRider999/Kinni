import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/motivation_messages.dart';
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
import '../domain/entities/enums.dart';
import '../domain/entities/followup.dart';
import '../domain/entities/product.dart';
import '../domain/entities/voice_note.dart';
import '../domain/entities/whatsapp_template.dart';
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
    await _log(c.id, ActivityType.statusChanged, 'Status → ${status.label}',
        from: c.status, to: status, detail: amount == null ? null : Fmt.aed(amount));
    if (status.isConverted) Telemetry.event('lead_converted', {'status': status.name});
    if (status == LeadStatus.documentsRequested) await ensureRequiredDocuments(c.id);
    if (!status.isOpen) {
      // Closed leads need no more reminders.
      for (final f in _followups.forClient(c.id).where((f) => f.isPending)) {
        await _notifications.cancelFollowup(f);
      }
    }
    _sync();
  }

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
    final existingTypes = _docs.forClient(primary.id).map((d) => d.type).toSet();
    for (final d in _docs.forClient(duplicate.id)) {
      if (d.type != DocumentType.custom && existingTypes.contains(d.type) && !d.hasFile) {
        await _docs.softDelete(d.id);
      } else {
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

  // ── WhatsApp ─────────────────────────────────────────────────────────────

  String renderTemplate(WhatsAppTemplate t, Client c) {
    final productName = ref.read(productNamesProvider)[c.productId] ?? 'loan';
    final pending = _docs.pendingRequiredFor(c.id).map((d) => '• ${d.displayName}').toList();
    final docs = pending.isNotEmpty ? pending.join('\n') : DocumentType.required.map((d) => '• ${d.label}').join('\n');
    final next = _followups.nextPendingFor(c.id);
    return TemplateRenderer.render(t.body, {
      'name': c.name.split(' ').first,
      'product': productName,
      'agent': ref.read(profileProvider).name,
      'date': next == null ? Fmt.date(_now) : Fmt.dateTime(next.dueAt),
      'documents': docs,
    });
  }

  Future<void> logWhatsApp(Client c, String templateName) async {
    await _log(c.id, ActivityType.whatsapp, 'WhatsApp · $templateName');
    _sync();
  }

  Future<void> saveTemplate(WhatsAppTemplate t) async {
    await ref.read(templateRepoProvider).upsert(t);
    _sync();
  }

  Future<void> deleteTemplate(WhatsAppTemplate t) async {
    await ref.read(templateRepoProvider).softDelete(t.id);
    _sync();
  }

  // ── Documents ────────────────────────────────────────────────────────────

  /// Creates the six required document rows for a client if missing.
  Future<void> ensureRequiredDocuments(String clientId) async {
    final have = _docs.forClient(clientId).map((d) => d.type).toSet();
    final now = _now;
    final missing = [
      for (final t in DocumentType.required)
        if (!have.contains(t)) ClientDocument(id: newId(), createdAt: now, updatedAt: now, clientId: clientId, type: t),
    ];
    if (missing.isNotEmpty) await _docs.upsertAll(missing);
  }

  Future<ClientDocument> addCustomDocument(String clientId, String name) async {
    final now = _now;
    final d = ClientDocument(id: newId(), createdAt: now, updatedAt: now, clientId: clientId, type: DocumentType.custom, customName: name);
    await _docs.upsert(d);
    _sync();
    return d;
  }

  /// Attaches a file and marks the document Received.
  Future<void> attachDocumentFile(ClientDocument d, String sourcePath) async {
    final stored = await FileStore.importForClient(d.clientId, sourcePath, prefix: d.type.name);
    if (d.filePath != null && d.filePath != stored) await FileStore.deleteQuietly(d.filePath);
    await _docs.upsert(d.copyWith(
      filePath: stored,
      mimeType: FileStore.mimeFor(stored),
      remotePath: null,
      status: d.status == DocumentStatus.verified ? DocumentStatus.verified : DocumentStatus.received,
    ));
    await _log(d.clientId, ActivityType.document, '${d.displayName} received');
    await _suggestDocumentsReceived(d.clientId);
    _sync();
  }

  Future<void> setDocumentStatus(ClientDocument d, DocumentStatus s, {String? note}) async {
    await _docs.upsert(d.copyWith(status: s, note: note ?? d.note));
    await _log(d.clientId, ActivityType.document, '${d.displayName} → ${s.label}', detail: note);
    await _suggestDocumentsReceived(d.clientId);
    _sync();
  }

  Future<void> deleteDocument(ClientDocument d) async {
    if (d.type == DocumentType.custom) {
      await FileStore.deleteQuietly(d.filePath);
      await _docs.softDelete(d.id);
    } else {
      await FileStore.deleteQuietly(d.filePath);
      await _docs.upsert(d.copyWith(filePath: null, mimeType: null, remotePath: null, status: DocumentStatus.pending));
    }
    _sync();
  }

  /// When every required document is collected while the lead sits in
  /// "Documents Requested", advance it to "Documents Received".
  Future<void> _suggestDocumentsReceived(String clientId) async {
    final c = _clients.getById(clientId);
    if (c == null || c.status != LeadStatus.documentsRequested) return;
    final req = _docs.forClient(clientId).where((d) => d.type != DocumentType.custom).toList();
    if (req.length >= DocumentType.required.length && req.every((d) => d.status.isCollected)) {
      await changeStatus(c, LeadStatus.documentsReceived);
    }
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
    final t = ref.read(templateRepoProvider);
    if (t.getAll().isEmpty) await t.upsertAll(Defaults.templates());
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
