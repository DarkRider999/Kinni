import 'dart:io';

import 'package:cunning_document_scanner/cunning_document_scanner.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

import '../../core/services/file_storage_service.dart';
import '../../core/services/ocr_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../data/export/scan_pdf.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/document_category.dart';
import '../../domain/entities/enums.dart';
import '../../domain/services/document_checklist.dart';
import '../../domain/services/document_text_parser.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../common/file_actions.dart';
import '../whatsapp/whatsapp_button.dart';
import 'document_preview_screen.dart';
import 'whatsapp_files_screen.dart';

/// Formats accepted by every import path.
const vaultExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

/// The client's Document Vault: checklist, quick add actions and one
/// folder per category. Documents are linked to this client's id only.
class DocumentsTab extends ConsumerWidget {
  const DocumentsTab({super.key, required this.clientId});
  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(clientByIdProvider(clientId));
    if (client == null) return const SizedBox.shrink();
    final docs = ref.watch(clientDocumentsProvider(clientId));
    final categories = ref.watch(categoriesProvider).value ?? const <DocumentCategory>[];
    final checklist = ref.watch(clientChecklistProvider(clientId));
    final names = ref.watch(categoryNamesProvider);
    final now = ref.watch(nowProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: [
        if (checklist != null) _ChecklistCard(client: client, checklist: checklist, names: names),
        const SizedBox(height: 12),
        VaultAddActions(clientId: clientId),
        const SizedBox(height: 8),
        for (final cat in categories)
          _CategoryFolder(
            category: cat,
            docs: docs.where((d) => d.categoryId == cat.id).toList(),
            now: now,
            clientId: clientId,
          ),
        // Documents whose category was removed elsewhere still show up.
        if (docs.any((d) => !categories.any((c) => c.id == d.categoryId)))
          _CategoryFolder(
            category: DocumentCategory(id: '_orphan', createdAt: now, updatedAt: now, name: 'Uncategorised'),
            docs: docs.where((d) => !categories.any((c) => c.id == d.categoryId)).toList(),
            now: now,
            clientId: clientId,
          ),
      ],
    );
  }
}

class _ChecklistCard extends ConsumerWidget {
  const _ChecklistCard({required this.client, required this.checklist, required this.names});
  final Client client;
  final DocumentChecklist checklist;
  final Map<String, String> names;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context).textTheme;
    final product = ref.watch(productNamesProvider)[client.productId];
    final pct = checklist.completion;
    final color = pct >= 1 ? AppColors.success : pct >= .5 ? AppColors.primary : AppColors.warning;
    return GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.fact_check_rounded, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text('${product ?? 'Application'} checklist', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
          Text('${(pct * 100).round()}%', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: color)),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: pct, minHeight: 8, color: color, backgroundColor: color.withValues(alpha: .15)),
        ),
        const SizedBox(height: 10),
        for (final i in checklist.items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              Icon(i.done ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded, size: 20, color: AppColors.document(i.status)),
              const SizedBox(width: 8),
              Expanded(child: Text(names[i.categoryId] ?? i.categoryId)),
              Pill(label: i.status.label, color: AppColors.document(i.status), dense: true),
            ]),
          ),
        if (!checklist.isComplete) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 4, children: [
            OutlinedButton.icon(
              icon: const Icon(Icons.mark_email_unread_outlined, size: 18),
              label: const Text('Mark missing as requested'),
              onPressed: () async {
                await ref.read(crmActionsProvider).requestChecklistDocuments(client);
                if (context.mounted) showSnack(context, 'Missing documents marked as requested');
              },
            ),
            FilledButton.tonalIcon(
              style: FilledButton.styleFrom(foregroundColor: whatsappGreen),
              icon: const Icon(Icons.chat_rounded, size: 18),
              label: const Text('Request on WhatsApp'),
              onPressed: () async {
                await ref.read(crmActionsProvider).requestChecklistDocuments(client);
                if (context.mounted) await showWhatsAppSheet(context, ref, client, templateName: 'Documents Required');
              },
            ),
          ]),
        ],
      ]),
    );
  }
}

/// Scan · Gallery · PDF/Files · WhatsApp import buttons.
class VaultAddActions extends ConsumerWidget {
  const VaultAddActions({super.key, required this.clientId, this.categoryId});
  final String clientId;
  final String? categoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget action(IconData icon, String label, Color color, VoidCallback onTap) => Expanded(
          child: GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
            onTap: onTap,
            child: Column(children: [
              Icon(icon, color: color),
              const SizedBox(height: 4),
              Text(label, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
            ]),
          ),
        );
    return Row(children: [
      action(Icons.document_scanner_rounded, 'Scan', AppColors.primary, () => scanIntoVault(context, ref, clientId, categoryId: categoryId)),
      const SizedBox(width: 8),
      action(Icons.photo_library_rounded, 'Gallery', AppColors.secondary, () => uploadFromGallery(context, ref, clientId, categoryId: categoryId)),
      const SizedBox(width: 8),
      action(Icons.upload_file_rounded, 'PDF / Files', AppColors.info, () => importFiles(context, ref, clientId, categoryId: categoryId)),
      const SizedBox(width: 8),
      action(Icons.chat_rounded, 'From WhatsApp', whatsappGreen, () => importFiles(context, ref, clientId, categoryId: categoryId, fromWhatsApp: true)),
    ]);
  }
}

// ── Add flows ────────────────────────────────────────────────────────────────

/// Picks a vault category (bottom sheet).
Future<DocumentCategory?> pickCategory(BuildContext context, WidgetRef ref, {String title = 'Save to which folder?'}) {
  final cats = ref.read(categoriesProvider).value ?? const <DocumentCategory>[];
  return showModalBottomSheet<DocumentCategory>(
    context: context,
    isScrollControlled: true,
    builder: (c) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(c).height * .7),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(title, style: Theme.of(c).textTheme.titleMedium)),
          Flexible(
            child: ListView(shrinkWrap: true, children: [
              for (final cat in cats)
                ListTile(leading: const Icon(Icons.folder_rounded, color: AppColors.primary), title: Text(cat.name), onTap: () => Navigator.pop(c, cat)),
            ]),
          ),
        ]),
      ),
    ),
  );
}

Future<DateTime?> _askExpiry(BuildContext context, DocumentCategory cat, {DateTime? initial}) async {
  if (!cat.supportsExpiry) return null;
  final now = DateTime.now();
  return showDatePicker(
    context: context,
    helpText: '${cat.name} expiry date (optional)',
    cancelText: 'Skip',
    initialDate: initial ?? DateTime(now.year + 1, now.month, now.day),
    firstDate: DateTime(now.year - 5),
    lastDate: DateTime(now.year + 15),
  );
}

Future<void> _save(BuildContext context, WidgetRef ref, String clientId, List<String> paths, {String? categoryId, required String source}) async {
  if (paths.isEmpty) return;
  final unsupported = paths.where((x) => !vaultExtensions.contains(p.extension(x).replaceFirst('.', '').toLowerCase())).toList();
  if (unsupported.isNotEmpty) {
    showSnack(context, 'Unsupported file type. Use PDF, JPG, PNG or WEBP.', error: true);
    return;
  }
  final cats = ref.read(categoriesProvider).value ?? const <DocumentCategory>[];
  final cat = categoryId == null ? await pickCategory(context, ref) : cats.where((c) => c.id == categoryId).firstOrNull;
  if (cat == null || !context.mounted) return;
  final expiry = await _askExpiry(context, cat);
  if (!context.mounted) return;
  try {
    await ref.read(crmActionsProvider).addDocumentFiles(clientId, cat.id, paths, expiryDate: expiry, source: source);
    if (context.mounted) showSnack(context, '${paths.length} document${paths.length == 1 ? '' : 's'} saved to ${cat.name}');
  } catch (e) {
    if (context.mounted) showSnack(context, 'Could not save: $e', error: true);
  }
}

/// Camera scan with auto edge detection, crop and enhancement (ML Kit
/// Document Scanner), saved as one PDF or as separate images.
Future<void> scanIntoVault(BuildContext context, WidgetRef ref, String clientId, {String? categoryId}) async {
  List<String>? pages;
  try {
    pages = await CunningDocumentScanner.getPictures(noOfPages: 20);
  } catch (e) {
    if (context.mounted) showSnack(context, 'Scanner unavailable: $e', error: true);
    return;
  }
  if (pages == null || pages.isEmpty || !context.mounted) return;
  final asPdf = await showModalBottomSheet<bool>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(title: Text('${pages!.length} page${pages.length == 1 ? '' : 's'} scanned')),
        ListTile(leading: const Icon(Icons.picture_as_pdf_rounded, color: AppColors.danger), title: const Text('Save as one PDF'), onTap: () => Navigator.pop(c, true)),
        ListTile(leading: const Icon(Icons.image_rounded, color: AppColors.info), title: const Text('Save as images'), onTap: () => Navigator.pop(c, false)),
      ]),
    ),
  );
  if (asPdf == null || !context.mounted) return;
  var files = pages;
  if (asPdf) {
    try {
      files = [(await ScanPdf.fromImages(pages, name: 'scan')).path];
    } catch (e) {
      if (context.mounted) showSnack(context, 'Could not create PDF: $e', error: true);
      return;
    }
  }
  if (!context.mounted) return;
  await _save(context, ref, clientId, files, categoryId: categoryId, source: 'Scanned');
  if (context.mounted) await offerOcr(context, ref, clientId, pages.first);
}

Future<void> uploadFromGallery(BuildContext context, WidgetRef ref, String clientId, {String? categoryId}) async {
  List<XFile> picked;
  try {
    picked = await ImagePicker().pickMultiImage(imageQuality: 90);
  } catch (e) {
    if (context.mounted) showSnack(context, 'Could not open the gallery: $e', error: true);
    return;
  }
  if (picked.isEmpty || !context.mounted) return;
  await _save(context, ref, clientId, [for (final x in picked) x.path], categoryId: categoryId, source: 'Uploaded');
}

/// PDF / any supported file from storage. [fromWhatsApp] opens the
/// picker in WhatsApp's media folder when Android allows it.
Future<void> importFiles(BuildContext context, WidgetRef ref, String clientId, {String? categoryId, bool fromWhatsApp = false}) async {
  if (fromWhatsApp) {
    // Files found in WhatsApp / WhatsApp Business folders; an empty result
    // means "use the system picker instead".
    final found = await WhatsAppFilesScreen.pick(context, extensions: vaultExtensions);
    if (found == null || !context.mounted) return;
    if (found.isNotEmpty) {
      await _save(context, ref, clientId, found, categoryId: categoryId, source: 'Imported from WhatsApp');
      return;
    }
  }
  List<PlatformFile> picked;
  try {
    picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: vaultExtensions,
      dialogTitle: fromWhatsApp ? 'Choose a document received on WhatsApp' : 'Choose documents',
      initialDirectory: fromWhatsApp ? '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media' : null,
    );
  } catch (e) {
    if (context.mounted) showSnack(context, 'Could not open files: $e', error: true);
    return;
  }
  final paths = [for (final f in picked) if (f.path != null) f.path!];
  if (paths.isEmpty || !context.mounted) return;
  await _save(context, ref, clientId, paths, categoryId: categoryId, source: fromWhatsApp ? 'Imported from WhatsApp' : 'Uploaded');
}

/// OCR an image and let the user edit the extracted text before saving it
/// to the client's notes.
Future<void> offerOcr(BuildContext context, WidgetRef ref, String clientId, String imagePath, {String? source}) async {
  final go = await confirm(context, title: 'Extract text?', message: 'Read the name, ID number, passport number and salary from this document (on-device, free).', ok: 'Extract');
  if (!go || !context.mounted) return;
  String text;
  try {
    text = await OcrService.recognize(imagePath);
  } catch (e) {
    if (context.mounted) showSnack(context, 'Text recognition failed: $e', error: true);
    return;
  }
  if (!context.mounted) return;
  if (text.trim().isEmpty) {
    showSnack(context, 'No text found on this page');
    return;
  }
  final ctrl = TextEditingController(text: DocumentTextParser.parse(text).toNote());
  final save = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: const Text('Review extracted text'),
      content: SizedBox(
        width: double.maxFinite,
        child: TextField(controller: ctrl, maxLines: 14, minLines: 6, decoration: const InputDecoration(helperText: 'Edit before saving to notes')),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Discard')),
        FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save to notes')),
      ],
    ),
  );
  if (save == true) {
    await ref.read(crmActionsProvider).saveOcrNote(clientId, ctrl.text.trim(), source: source);
    if (context.mounted) showSnack(context, 'Saved to notes');
  }
}

// ── Category folder & document actions ──────────────────────────────────────

class _CategoryFolder extends StatelessWidget {
  const _CategoryFolder({required this.category, required this.docs, required this.now, required this.clientId});
  final DocumentCategory category;
  final List<ClientDocument> docs;
  final DateTime now;
  final String clientId;

  @override
  Widget build(BuildContext context) {
    final files = docs.where((d) => d.hasFile).length;
    final status = docs.isEmpty ? null : (docs.toList()..sort((a, b) => b.status.index.compareTo(a.status.index))).first.status;
    return GlassCard(
      margin: const EdgeInsets.only(top: 10),
      padding: EdgeInsets.zero,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: docs.isNotEmpty,
          leading: Icon(docs.isEmpty ? Icons.folder_open_rounded : Icons.folder_rounded, color: AppColors.primary),
          title: Text(category.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(files == 0 ? 'No files' : '$files file${files == 1 ? '' : 's'}'),
          trailing: status == null ? null : Pill(label: status.label, color: AppColors.document(status), dense: true),
          childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
          children: [
            for (final d in docs) _DocumentTile(document: d, now: now),
            if (category.id != '_orphan') Padding(padding: const EdgeInsets.only(top: 6), child: VaultAddActions(clientId: clientId, categoryId: category.id)),
          ],
        ),
      ),
    );
  }
}

class _DocumentTile extends ConsumerWidget {
  const _DocumentTile({required this.document, required this.now});
  final ClientDocument document;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = document;
    final actions = ref.read(crmActionsProvider);
    final days = d.daysToExpiry(now);
    final expiryColor = days == null ? null : days < 0 ? AppColors.danger : days <= 30 ? AppColors.warning : AppColors.success;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
      leading: CircleAvatar(
        backgroundColor: AppColors.document(d.status).withValues(alpha: .14),
        child: Icon(
          !d.hasFile ? Icons.hourglass_empty_rounded : d.isPdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded,
          color: AppColors.document(d.status),
        ),
      ),
      title: Text(actions.documentName(d), maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Wrap(spacing: 6, runSpacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
        Pill(label: d.status.label, color: AppColors.document(d.status), dense: true),
        if (days != null)
          Pill(
            label: days < 0 ? 'Expired ${Fmt.date(d.expiryDate!)}' : 'Expires ${Fmt.date(d.expiryDate!)}',
            color: expiryColor!,
            dense: true,
            icon: Icons.event_rounded,
          ),
        if (d.note != null) Text(d.note!, maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
      onTap: d.hasFile ? () => DocumentPreviewScreen.open(context, d) : null,
      trailing: PopupMenuButton<String>(
        onSelected: (v) => _onAction(context, ref, v),
        itemBuilder: (_) => [
          if (d.hasFile) const PopupMenuItem(value: 'view', child: Text('View')),
          const PopupMenuItem(value: 'rename', child: Text('Rename')),
          PopupMenuItem(value: 'replace', child: Text(d.hasFile ? 'Replace file' : 'Attach file')),
          if (d.hasFile) const PopupMenuItem(value: 'download', child: Text('Download')),
          if (d.hasFile) const PopupMenuItem(value: 'share', child: Text('Share')),
          if (d.hasFile && d.isImage) const PopupMenuItem(value: 'ocr', child: Text('Extract text (OCR)')),
          const PopupMenuItem(value: 'move', child: Text('Move to another category')),
          const PopupMenuItem(value: 'note', child: Text('Add note')),
          const PopupMenuItem(value: 'verify', child: Text('Mark as verified')),
          const PopupMenuItem(value: 'status', child: Text('Change status…')),
          const PopupMenuItem(value: 'expiry', child: Text('Set expiry date')),
          const PopupMenuItem(value: 'delete', child: Text('Delete')),
        ],
      ),
    );
  }

  Future<String?> _text(BuildContext context, String title, {String? initial, int lines = 1}) {
    final c = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, autofocus: true, maxLines: lines),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('Save')),
        ],
      ),
    );
  }

  Future<void> _onAction(BuildContext context, WidgetRef ref, String action) async {
    final d = document;
    final actions = ref.read(crmActionsProvider);
    try {
      switch (action) {
        case 'view':
          await DocumentPreviewScreen.open(context, d);
        case 'rename':
          final t = await _text(context, 'Rename document', initial: actions.documentName(d));
          if (t != null) await actions.renameDocument(d, t);
        case 'replace':
          final r = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: vaultExtensions);
          final path = r.isEmpty ? null : r.first.path;
          if (path != null) {
            d.hasFile ? await actions.replaceDocumentFile(d, path) : await actions.addDocumentFiles(d.clientId, d.categoryId, [path]);
          }
        case 'download':
          final f = await actions.exportDocument(d);
          if (context.mounted && await safeSaveCopy(context, f) && context.mounted) showSnack(context, 'Saved ${p.basename(f.path)}');
        case 'share':
          final f = await actions.exportDocument(d);
          if (!context.mounted) return;
          await safeShare(context, [f.path], subject: actions.documentName(d));
          await actions.logDocumentShared(d);
        case 'ocr':
          final f = await actions.exportDocument(d);
          if (context.mounted) await offerOcr(context, ref, d.clientId, f.path, source: actions.documentName(d));
          await FileStore.deleteQuietly(f.path);
        case 'move':
          final cat = await pickCategory(context, ref, title: 'Move to…');
          if (cat != null && cat.id != d.categoryId) await actions.moveDocument(d, cat.id);
        case 'note':
          final t = await _text(context, 'Document note', initial: d.note, lines: 3);
          if (t != null) await actions.setDocumentNote(d, t);
        case 'verify':
          await actions.setDocumentStatus(d, DocumentStatus.verified);
        case 'status':
          final s = await showModalBottomSheet<DocumentStatus>(
            context: context,
            builder: (c) => SafeArea(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                for (final s in DocumentStatus.values)
                  ListTile(
                    leading: Icon(Icons.circle, color: AppColors.document(s), size: 14),
                    title: Text(s.label),
                    selected: s == d.status,
                    onTap: () => Navigator.pop(c, s),
                  ),
              ]),
            ),
          );
          if (s == null || !context.mounted) return;
          String? note;
          if (s == DocumentStatus.rejected) note = await _text(context, 'Why was it rejected?', lines: 2);
          await actions.setDocumentStatus(d, s, note: note);
        case 'expiry':
          final now = DateTime.now();
          final picked = await showDatePicker(
            context: context,
            helpText: 'Expiry date',
            initialDate: d.expiryDate ?? DateTime(now.year + 1, now.month, now.day),
            firstDate: DateTime(now.year - 5),
            lastDate: DateTime(now.year + 15),
          );
          if (picked != null) await actions.setDocumentExpiry(d, picked);
        case 'delete':
          if (await confirm(context, title: 'Delete document?', message: actions.documentName(d), ok: 'Delete', destructive: true)) {
            await actions.deleteDocument(d);
          }
      }
    } catch (e) {
      if (context.mounted) showSnack(context, 'Action failed: $e', error: true);
    }
  }
}

/// Opens [File] import for a shared file path (share target) after asking
/// which client and category.
Future<void> attachSharedFile(BuildContext context, WidgetRef ref, String clientId, String path) =>
    _save(context, ref, clientId, [File(path).path], source: 'Shared to Anjali CRM');
