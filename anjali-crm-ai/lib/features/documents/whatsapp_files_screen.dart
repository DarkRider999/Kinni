import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:permission_handler/permission_handler.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../whatsapp/whatsapp_button.dart';

/// One WhatsApp media folder the vault looks in.
class WhatsAppFolder {
  const WhatsAppFolder(this.label, this.paths);
  final String label;

  /// Android 11+ location first, then the pre-Android-11 one.
  final List<String> paths;
}

/// A file found in a WhatsApp folder.
class WhatsAppFile {
  const WhatsAppFile(this.file, this.folder, this.modified, this.size);
  final File file;
  final String folder;
  final DateTime modified;
  final int size;

  String get extension => p.extension(file.path).replaceFirst('.', '').toLowerCase();
  bool get isImage => extension != 'pdf';
}

/// Lists recent documents received on WhatsApp and WhatsApp Business so
/// they can be attached to a client's vault in a few taps.
///
/// Pops with the chosen paths, with an empty list when the user prefers the
/// system file picker, or with null when cancelled.
class WhatsAppFilesScreen extends StatefulWidget {
  const WhatsAppFilesScreen({super.key, required this.extensions});

  /// Allowed lower-case extensions (the vault's supported formats).
  final List<String> extensions;

  static Future<List<String>?> pick(BuildContext context, {required List<String> extensions}) =>
      Navigator.of(context).push<List<String>>(MaterialPageRoute(builder: (_) => WhatsAppFilesScreen(extensions: extensions)));

  static const _media = '/storage/emulated/0/Android/media';
  static const _legacy = '/storage/emulated/0';

  static const folders = [
    WhatsAppFolder('WhatsApp Images', ['$_media/com.whatsapp/WhatsApp/Media/WhatsApp Images', '$_legacy/WhatsApp/Media/WhatsApp Images']),
    WhatsAppFolder('WhatsApp Documents', ['$_media/com.whatsapp/WhatsApp/Media/WhatsApp Documents', '$_legacy/WhatsApp/Media/WhatsApp Documents']),
    WhatsAppFolder('WhatsApp Business Images', [
      '$_media/com.whatsapp.w4b/WhatsApp Business/Media/WhatsApp Business Images',
      '$_legacy/WhatsApp Business/Media/WhatsApp Business Images',
    ]),
    WhatsAppFolder('WhatsApp Business Documents', [
      '$_media/com.whatsapp.w4b/WhatsApp Business/Media/WhatsApp Business Documents',
      '$_legacy/WhatsApp Business/Media/WhatsApp Business Documents',
    ]),
  ];

  /// Most files listed at once (newest first).
  static const maxFiles = 300;

  /// Scans [folders] (received files only: WhatsApp's `Sent` and `Private`
  /// sub-folders are skipped) and returns supported files, newest first.
  /// Folders that do not exist or cannot be read are skipped.
  static List<WhatsAppFile> scan(List<String> extensions, {List<WhatsAppFolder> from = folders}) {
    final out = <WhatsAppFile>[];
    final seen = <String>{};
    for (final folder in from) {
      for (final path in folder.paths) {
        final dir = Directory(path);
        try {
          if (!dir.existsSync()) continue;
          for (final e in dir.listSync(followLinks: false)) {
            if (e is! File) continue;
            final name = p.basename(e.path);
            if (name.startsWith('.')) continue;
            if (!extensions.contains(p.extension(name).replaceFirst('.', '').toLowerCase())) continue;
            if (!seen.add(e.path)) continue;
            final stat = e.statSync();
            out.add(WhatsAppFile(e, folder.label, stat.modified, stat.size));
          }
        } on FileSystemException {
          // No access to this folder on this Android version: skip it.
        }
      }
    }
    out.sort((a, b) => b.modified.compareTo(a.modified));
    return out.take(maxFiles).toList();
  }

  @override
  State<WhatsAppFilesScreen> createState() => _WhatsAppFilesScreenState();
}

class _WhatsAppFilesScreenState extends State<WhatsAppFilesScreen> {
  List<WhatsAppFile>? _files;
  final _selected = <String>{};
  String? _folder;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    // Android 13+: photos permission (WhatsApp images); Android 12 and
    // older: storage permission (images and documents). Each request is a
    // no-op on the Android versions it does not apply to.
    try {
      await [Permission.photos, Permission.storage].request();
    } catch (e) {
      // Permission plugin unavailable (tests, desktop): scan whatever is
      // readable; the empty state offers the file picker.
      debugPrint('WhatsApp import: permission request failed: $e');
    }
    final files = WhatsAppFilesScreen.scan(widget.extensions);
    if (mounted) setState(() => _files = files);
  }

  void _browse() => Navigator.pop(context, const <String>[]);

  @override
  Widget build(BuildContext context) {
    final files = _files;
    final shown = files == null ? const <WhatsAppFile>[] : [for (final f in files) if (_folder == null || f.folder == _folder) f];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Import from WhatsApp'),
        actions: [TextButton.icon(onPressed: _browse, icon: const Icon(Icons.folder_open_rounded), label: const Text('Browse'))],
      ),
      body: files == null
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SizedBox(
                height: 52,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(label: Text('All (${files.length})'), selected: _folder == null, onSelected: (_) => setState(() => _folder = null)),
                    ),
                    for (final f in WhatsAppFilesScreen.folders)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text('${f.label} (${files.where((x) => x.folder == f.label).length})'),
                          selected: _folder == f.label,
                          onSelected: (_) => setState(() => _folder = f.label),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: shown.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const EmptyState(
                            icon: Icons.chat_rounded,
                            title: 'No WhatsApp files found here',
                            message: 'Newer Android versions only let apps see WhatsApp images, not PDFs. '
                                'Tap Browse to pick the file from WhatsApp\'s folder, or use Share → Anjali CRM inside WhatsApp.',
                          ),
                          const SizedBox(height: 12),
                          FilledButton.icon(onPressed: _browse, icon: const Icon(Icons.folder_open_rounded), label: const Text('Browse files')),
                        ]),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.only(bottom: 96),
                        itemCount: shown.length,
                        itemBuilder: (_, i) {
                          final f = shown[i];
                          final on = _selected.contains(f.file.path);
                          return CheckboxListTile(
                            value: on,
                            onChanged: (v) => setState(() => v == true ? _selected.add(f.file.path) : _selected.remove(f.file.path)),
                            secondary: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SizedBox(
                                width: 48,
                                height: 48,
                                child: f.isImage
                                    ? Image.file(f.file, fit: BoxFit.cover, cacheWidth: 144, errorBuilder: (_, _, _) => const Icon(Icons.image_rounded))
                                    : const ColoredBox(color: Color(0x14DC2626), child: Icon(Icons.picture_as_pdf_rounded, color: AppColors.danger)),
                              ),
                            ),
                            title: Text(p.basename(f.file.path), maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${f.folder} · ${Fmt.dateTime(f.modified)} · ${(f.size / 1024).ceil()} KB'),
                          );
                        },
                      ),
              ),
            ]),
      floatingActionButton: _selected.isEmpty
          ? null
          : FloatingActionButton.extended(
              backgroundColor: whatsappGreen,
              foregroundColor: Colors.white,
              onPressed: () => Navigator.pop(context, _selected.toList()),
              icon: const Icon(Icons.attach_file_rounded),
              label: Text('Attach ${_selected.length}'),
            ),
    );
  }
}
