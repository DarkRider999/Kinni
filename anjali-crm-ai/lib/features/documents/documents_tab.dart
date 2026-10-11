import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/enums.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';

/// Document checklist for one client (FR DOC-01..05): the six required
/// documents plus custom ones, each with a file and a status.
class DocumentsTab extends ConsumerStatefulWidget {
  const DocumentsTab({super.key, required this.clientId});
  final String clientId;

  @override
  ConsumerState<DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends ConsumerState<DocumentsTab> {
  @override
  void initState() {
    super.initState();
    // Make sure the six required rows exist the first time the tab opens.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(crmActionsProvider).ensureRequiredDocuments(widget.clientId);
    });
  }

  CrmActions get _actions => ref.read(crmActionsProvider);

  Future<void> _attach(ClientDocument d, _Source source) async {
    String? path;
    try {
      switch (source) {
        case _Source.camera:
          path = (await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2400, imageQuality: 85))?.path;
        case _Source.gallery:
          path = (await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2400, imageQuality: 85))?.path;
        case _Source.pdf:
          final files = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
          path = files.isEmpty ? null : files.first.path;
      }
      if (path == null) return;
      await _actions.attachDocumentFile(d, path);
      if (mounted) showSnack(context, '${d.displayName} attached');
    } catch (e) {
      if (mounted) showSnack(context, 'Could not attach the file', error: true);
    }
  }

  Future<void> _setStatus(ClientDocument d) async {
    final s = await showModalBottomSheet<DocumentStatus>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(title: Text('${d.displayName} status', style: Theme.of(c).textTheme.titleMedium)),
            for (final s in DocumentStatus.values)
              ListTile(
                leading: Icon(Icons.circle, size: 14, color: AppColors.document(s)),
                title: Text(s.label),
                trailing: s == d.status ? const Icon(Icons.check_rounded) : null,
                onTap: () => Navigator.pop(c, s),
              ),
          ],
        ),
      ),
    );
    if (s == null || !mounted) return;
    final note = await _askText(
      title: 'Note (optional)',
      hint: s == DocumentStatus.rejected ? 'Why was it rejected?' : 'Add a note',
      initial: d.note,
      allowEmpty: true,
    );
    if (note == null) return;
    await _actions.setDocumentStatus(d, s, note: note.isEmpty ? null : note);
  }

  Future<void> _view(ClientDocument d) async {
    final path = d.filePath!;
    if (!File(path).existsSync()) {
      showSnack(context, 'File is missing on this device', error: true);
      return;
    }
    final mime = d.mimeType ?? '';
    if (mime.startsWith('image/')) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => _ImageViewer(path: path, title: d.displayName)));
    } else {
      await SharePlus.instance.share(ShareParams(files: [XFile(path)], subject: d.displayName));
    }
  }

  Future<void> _deleteFile(ClientDocument d) async {
    final custom = d.type == DocumentType.custom;
    final ok = await confirm(
      context,
      title: custom ? 'Delete document?' : 'Remove file?',
      message: custom ? 'The ${d.displayName} entry and its file will be deleted.' : 'The file is removed and the status resets to Pending.',
      ok: 'Delete',
      destructive: true,
    );
    if (ok) await _actions.deleteDocument(d);
  }

  Future<void> _addCustom() async {
    final name = await _askText(title: 'Custom document', hint: 'e.g. Trade licence');
    if (name == null || name.isEmpty) return;
    await _actions.addCustomDocument(widget.clientId, name);
  }

  /// Text prompt; returns null when cancelled.
  Future<String?> _askText({required String title, String? hint, String? initial, bool allowEmpty = false}) async {
    final c = TextEditingController(text: initial);
    final r = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, autofocus: true, decoration: InputDecoration(hintText: hint)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final t = c.text.trim();
              if (t.isEmpty && !allowEmpty) return;
              Navigator.pop(ctx, t);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    c.dispose();
    return r;
  }

  @override
  Widget build(BuildContext context) {
    final docs = ref.watch(clientDocumentsProvider(widget.clientId));
    final required = docs.where((d) => d.type != DocumentType.custom).toList();
    final collected = required.where((d) => d.status.isCollected).length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Row(
            children: [
              Expanded(
                child: Text('$collected of ${DocumentType.required.length} required collected',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              ),
              TextButton.icon(onPressed: _addCustom, icon: const Icon(Icons.add_rounded), label: const Text('Custom')),
            ],
          ),
        ),
        LinearProgressIndicator(
          value: DocumentType.required.isEmpty ? 0 : collected / DocumentType.required.length,
          minHeight: 6,
          borderRadius: BorderRadius.circular(6),
          color: AppColors.success,
        ),
        const SizedBox(height: 8),
        for (final d in docs)
          _DocumentCard(
            doc: d,
            onAttach: (s) => _attach(d, s),
            onStatus: () => _setStatus(d),
            onView: d.hasFile ? () => _view(d) : null,
            onDelete: (d.hasFile || d.type == DocumentType.custom) ? () => _deleteFile(d) : null,
          ),
        const SizedBox(height: 8),
        OutlinedButton.icon(onPressed: _addCustom, icon: const Icon(Icons.note_add_rounded), label: const Text('Add custom document')),
      ],
    );
  }
}

enum _Source { camera, gallery, pdf }

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({required this.doc, required this.onAttach, required this.onStatus, this.onView, this.onDelete});
  final ClientDocument doc;
  final ValueChanged<_Source> onAttach;
  final VoidCallback onStatus;
  final VoidCallback? onView;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.document(doc.status);
    final t = Theme.of(context).textTheme;
    return GlassCard(
      margin: const EdgeInsets.symmetric(vertical: 5),
      padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
      onTap: onView,
      child: Row(
        children: [
          Icon(
            doc.hasFile ? (doc.isPdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded) : Icons.description_outlined,
            color: color,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doc.displayName, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    InkWell(onTap: onStatus, child: Pill(label: doc.status.label, color: color, dense: true, icon: Icons.expand_more_rounded)),
                    if (doc.hasFile) Text(doc.isPdf ? 'PDF' : 'Image', style: t.bodySmall),
                  ],
                ),
                if (doc.note != null && doc.note!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(doc.note!, style: t.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                  ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Document actions',
            onSelected: (v) => switch (v) {
              'camera' => onAttach(_Source.camera),
              'gallery' => onAttach(_Source.gallery),
              'pdf' => onAttach(_Source.pdf),
              'status' => onStatus(),
              'view' => onView?.call(),
              'delete' => onDelete?.call(),
              _ => null,
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'camera', child: ListTile(leading: Icon(Icons.document_scanner_rounded), title: Text('Scan with camera'))),
              const PopupMenuItem(value: 'gallery', child: ListTile(leading: Icon(Icons.photo_library_rounded), title: Text('Gallery image'))),
              const PopupMenuItem(value: 'pdf', child: ListTile(leading: Icon(Icons.picture_as_pdf_rounded), title: Text('PDF file'))),
              const PopupMenuItem(value: 'status', child: ListTile(leading: Icon(Icons.flag_rounded), title: Text('Set status'))),
              if (onView != null) const PopupMenuItem(value: 'view', child: ListTile(leading: Icon(Icons.visibility_rounded), title: Text('View'))),
              if (onDelete != null)
                PopupMenuItem(
                  value: 'delete',
                  child: ListTile(
                    leading: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
                    title: Text(doc.type == DocumentType.custom ? 'Delete document' : 'Remove file'),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Full-screen zoomable image.
class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.path, required this.title});
  final String path;
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          title: Text(title),
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              tooltip: 'Share',
              onPressed: () => SharePlus.instance.share(ShareParams(files: [XFile(path)], subject: title)),
              icon: const Icon(Icons.share_rounded),
            ),
          ],
        ),
        body: InteractiveViewer(maxScale: 6, child: Center(child: Image.file(File(path)))),
      );
}
