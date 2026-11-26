
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfx/pdfx.dart';

import '../../core/widgets/common.dart';
import '../../domain/entities/client_document.dart';
import '../../providers/crm_actions.dart';
import '../common/file_actions.dart';

/// Instant in-app preview of a vault document (decrypted in memory only):
/// images with pinch-zoom and rotate; PDFs with zoom, rotate and page navigation.
class DocumentPreviewScreen extends ConsumerStatefulWidget {
  const DocumentPreviewScreen({super.key, required this.document});
  final ClientDocument document;

  static Future<void> open(BuildContext context, ClientDocument d) =>
      Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => DocumentPreviewScreen(document: d)));

  @override
  ConsumerState<DocumentPreviewScreen> createState() => _DocumentPreviewScreenState();
}

class _DocumentPreviewScreenState extends ConsumerState<DocumentPreviewScreen> {
  late final Future<Uint8List> _bytes = ref.read(crmActionsProvider).readDocument(widget.document).then(Uint8List.fromList);
  PdfControllerPinch? _pdf;
  int _turns = 0;
  int _page = 1;
  int _pages = 0;
  final _zoom = TransformationController();

  /// Fullscreen hides the app bar and the system bars.
  bool _full = false;

  void _setFullscreen(bool on) {
    setState(() => _full = on);
    SystemChrome.setEnabledSystemUIMode(on ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge);
  }

  @override
  void dispose() {
    if (_full) SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _pdf?.dispose();
    _zoom.dispose();
    super.dispose();
  }

  Future<void> _share() async {
    final actions = ref.read(crmActionsProvider);
    try {
      final f = await actions.exportDocument(widget.document);
      if (!mounted) return;
      await safeShare(context, [f.path], subject: actions.documentName(widget.document));
      await actions.logDocumentShared(widget.document);
    } catch (e) {
      if (mounted) showSnack(context, 'Could not prepare the file: $e', error: true);
    }
  }

  /// Zoom buttons work for images and PDFs (both are pinch-zoomable too).
  void _zoomBy(double factor) {
    final ValueNotifier<Matrix4>? c = widget.document.isPdf ? _pdf : _zoom;
    if (c == null) return;
    c.value = c.value.clone()..scaleByDouble(factor, factor, 1, 1);
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.document;
    final name = ref.read(crmActionsProvider).documentName(d);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: _full ? null : AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(name, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(tooltip: 'Rotate', icon: const Icon(Icons.rotate_right_rounded), onPressed: () => setState(() => _turns = (_turns + 1) % 4)),
          if (d.isImage || d.isPdf) ...[
            IconButton(tooltip: 'Zoom in', icon: const Icon(Icons.zoom_in_rounded), onPressed: () => _zoomBy(1.25)),
            IconButton(tooltip: 'Zoom out', icon: const Icon(Icons.zoom_out_rounded), onPressed: () => _zoomBy(.8)),
          ],
          IconButton(tooltip: 'Fullscreen', icon: const Icon(Icons.fullscreen_rounded), onPressed: () => _setFullscreen(true)),
          IconButton(tooltip: 'Share', icon: const Icon(Icons.share_rounded), onPressed: _share),
        ],
      ),
      floatingActionButton: _full
          ? FloatingActionButton.small(
              tooltip: 'Exit fullscreen',
              backgroundColor: Colors.black54,
              foregroundColor: Colors.white,
              onPressed: () => _setFullscreen(false),
              child: const Icon(Icons.fullscreen_exit_rounded),
            )
          : null,
      body: FutureBuilder<Uint8List>(
        future: _bytes,
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(child: Text('Could not open this document.\n${snap.error}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)));
          }
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final bytes = snap.data!;
          if (d.isPdf) {
            _pdf ??= PdfControllerPinch(document: PdfDocument.openData(bytes));
            return Column(children: [
              Expanded(
                child: RotatedBox(
                  quarterTurns: _turns,
                  child: PdfViewPinch(
                    controller: _pdf!,
                    onDocumentLoaded: (doc) => setState(() => _pages = doc.pagesCount),
                    onPageChanged: (p) => setState(() => _page = p),
                  ),
                ),
              ),
              if (_pages > 1)
                SafeArea(
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    IconButton(
                      color: Colors.white,
                      icon: const Icon(Icons.chevron_left_rounded),
                      onPressed: _page > 1 ? () => _pdf!.previousPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut) : null,
                    ),
                    Text('Page $_page of $_pages', style: const TextStyle(color: Colors.white)),
                    IconButton(
                      color: Colors.white,
                      icon: const Icon(Icons.chevron_right_rounded),
                      onPressed: _page < _pages ? () => _pdf!.nextPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut) : null,
                    ),
                  ]),
                ),
            ]);
          }
          if (d.isImage) {
            return InteractiveViewer(
              transformationController: _zoom,
              minScale: .5,
              maxScale: 6,
              child: Center(child: RotatedBox(quarterTurns: _turns, child: Image.memory(bytes, fit: BoxFit.contain))),
            );
          }
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.insert_drive_file_rounded, size: 64, color: Colors.white54),
              const SizedBox(height: 12),
              const Text('No preview for this file type', style: TextStyle(color: Colors.white70)),
              TextButton(onPressed: _share, child: const Text('Open with another app')),
            ]),
          );
        },
      ),
    );
  }
}
