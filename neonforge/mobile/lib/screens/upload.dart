import 'dart:io';

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../picker.dart';
import '../recipe.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';
import 'batch_builder.dart';
import 'editor.dart';

/// Injected picker (tests override it).
MediaPicker mediaPicker = DeviceMediaPicker();

class _Item {
  _Item(this.file);
  final File file;
  double progress = 0;
  String status = 'running';
  String? error;
  MediaFile? result;
}

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key, required this.batch, this.tool});
  final bool batch;
  final String? tool;
  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  final _items = <_Item>[];

  Future<void> _pick({bool folder = false}) async {
    final files = folder ? await mediaPicker.pickFolder() : await mediaPicker.pickFiles(multiple: widget.batch);
    if (files.isEmpty || !mounted) return;
    final session = SessionScope.of(context);
    final limit = widget.batch ? session.me!.plan.maxBatchFiles : 1;
    if (files.length > limit && mounted) showError(context, 'Your plan allows $limit files per batch — extra files skipped');
    final fresh = files.take(limit).map(_Item.new).toList();
    setState(() => _items.addAll(fresh));

    // three uploads in flight at a time
    var next = 0;
    Future<void> worker() async {
      while (next < fresh.length) {
        final it = fresh[next++];
        try {
          it.result = await session.api.upload(it.file, onProgress: (p) => mounted ? setState(() => it.progress = p) : null);
          it.status = 'succeeded';
        } catch (e) {
          it.status = 'failed';
          it.error = '$e';
        }
        if (mounted) setState(() {});
      }
    }

    await Future.wait(List.generate(fresh.length < 3 ? fresh.length : 3, (_) => worker()));
    if (!widget.batch && mounted && fresh.first.result != null) {
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => EditorScreen(fileId: fresh.first.result!.id, tool: widget.tool)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _items.where((i) => i.result != null).toList();
    final uploading = _items.any((i) => i.status == 'running');
    final plan = SessionScope.of(context).me!.plan;
    return Scaffold(
      appBar: AppBar(title: Text(widget.batch ? 'Batch Edit' : 'Single Edit')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: NF.borderStrong, width: 1.5),
          ),
          child: Column(children: [
            const Icon(Icons.add_photo_alternate_outlined, size: 40, color: NF.cyan),
            const SizedBox(height: 8),
            Text(widget.batch ? 'Photos & videos' : 'A photo or video', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('JPG · PNG · WEBP · GIF · MP4 · MOV · AVI — up to ${plan.maxUploadMb} MB',
                textAlign: TextAlign.center, style: const TextStyle(color: NF.text2, fontSize: 12)),
            const SizedBox(height: 16),
            Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
              FilledButton.icon(
                key: const Key('choose-files'),
                onPressed: () => _pick(),
                icon: const Icon(Icons.photo_library_outlined),
                label: Text(widget.batch ? 'Choose files' : 'Choose file'),
              ),
              if (widget.batch)
                OutlinedButton.icon(
                  onPressed: () => _pick(folder: true),
                  icon: const Icon(Icons.folder_open),
                  label: const Text('Folder'),
                ),
            ]),
          ]),
        ),
        const SizedBox(height: 16),
        for (final it in _items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: it.result?.thumbUrl != null
                      ? Image.network(it.result!.thumbUrl!, fit: BoxFit.cover)
                      : Container(color: NF.elevated),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(it.file.uri.pathSegments.last, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  if (it.error != null)
                    Text(it.error!, style: const TextStyle(color: NF.red, fontSize: 12))
                  else
                    NeonProgress(value: it.progress, status: it.status),
                ]),
              ),
              const SizedBox(width: 12),
              Text(formatBytes(it.file.lengthSync()), style: const TextStyle(color: NF.text2, fontSize: 12)),
            ]),
          ),
      ]),
      bottomNavigationBar: widget.batch && done.isNotEmpty
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton(
                  key: const Key('build-recipe'),
                  onPressed: uploading
                      ? null
                      : () => Navigator.of(context).pushReplacement(MaterialPageRoute(
                          builder: (_) => BatchBuilderScreen(files: done.map((d) => d.result!).toList()))),
                  child: Text('Build recipe for ${done.length} file${done.length == 1 ? '' : 's'} →'),
                ),
              ),
            )
          : null,
    );
  }
}
