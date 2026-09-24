import 'dart:io';

import 'package:flutter/material.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api/models.dart';
import '../recipe.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';

class ExportSheet extends StatefulWidget {
  const ExportSheet({super.key, required this.file, required this.steps});
  final MediaFile file;
  final List<EditStep> steps;
  @override
  State<ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<ExportSheet> {
  late String _imageFormat = widget.steps.any((s) => s.op == 'background' && s.params['mode'] == 'remove') ? 'png' : 'jpg';
  late String _videoFormat = widget.file.kind == 'gif' ? 'gif' : 'mp4';
  String _resolution = 'original';
  String _quality = 'balanced';
  int? _cost;
  Job? _job;
  String _status = '';
  double _progress = 0;
  String? _stage;
  String? _error;

  Map<String, dynamic> get _recipe => buildRecipe(widget.steps, output: {
        'image_format': _imageFormat,
        'video_format': _videoFormat,
        'resolution': _resolution,
        'quality': _quality,
      });

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_cost == null && _error == null) {
      SessionScope.of(context).api.estimate(_recipe, [widget.file.id]).then(
            (c) => mounted ? setState(() => _cost = c) : null,
            onError: (Object e) => mounted ? setState(() => _error = '$e') : null,
          );
    }
  }

  Future<void> _start() async {
    final session = SessionScope.of(context);
    setState(() => _error = null);
    try {
      final job = await session.api.render(widget.file.id, _recipe);
      setState(() => _job = job);
      final done = await session.watchJob(job.id, (s, p, st) {
        if (mounted) {
          setState(() {
            _status = s;
            _progress = p;
            _stage = st;
          });
        }
      });
      if (mounted) {
        setState(() {
          _job = done;
          _error = done.errorMessage;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<File> _download(Output out) async {
    final bytes = await SessionScope.of(context).api.download(out.downloadUrl);
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/${out.filename}');
    await f.writeAsBytes(bytes);
    return f;
  }

  Future<void> _saveToDevice(Output out) async {
    try {
      final f = await _download(out);
      if (out.mimeType.startsWith('video/')) {
        await Gal.putVideo(f.path, album: 'NeonForge');
      } else {
        await Gal.putImage(f.path, album: 'NeonForge');
      }
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved to gallery')));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = SessionScope.of(context).me!;
    final isImage = widget.file.isImage;
    final out = (_job?.outputs.isNotEmpty ?? false) ? _job!.outputs.first : null;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('Export', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (_job == null) ...[
            _label('Format'),
            Wrap(spacing: 6, children: [
              for (final f in isImage ? const ['jpg', 'png', 'webp'] : const ['mp4', 'mov', 'gif'])
                ChoiceChip(
                  label: Text(f.toUpperCase()),
                  selected: (isImage ? _imageFormat : _videoFormat) == f,
                  onSelected: (_) => setState(() => isImage ? _imageFormat = f : _videoFormat = f),
                ),
            ]),
            _label('Resolution'),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final (value, label) in kResolutions)
                if (isImage || value != '8k')
                  ChoiceChip(
                    label: Text(label),
                    selected: _resolution == value,
                    onSelected: resolutionAllowed(value, me.plan.maxOutputRes) ? (_) => setState(() => _resolution = value) : null,
                  ),
            ]),
            _label('Quality'),
            Wrap(spacing: 6, children: [
              for (final q in const ['small', 'balanced', 'max'])
                ChoiceChip(label: Text(q), selected: _quality == q, onSelected: (_) => setState(() => _quality = q)),
            ]),
            const SizedBox(height: 12),
            if (me.plan.watermark)
              const Text('Free plan exports carry a small “AI-edited” badge.', style: TextStyle(color: NF.text2, fontSize: 12)),
            const SizedBox(height: 12),
            Row(children: [
              Text('Cost: ${_cost ?? '…'} credits · balance ${me.credits}', style: const TextStyle(color: NF.text2)),
              const Spacer(),
              FilledButton(
                key: const Key('start-export'),
                onPressed: _cost == null || me.credits < _cost! ? null : _start,
                child: const Text('Export'),
              ),
            ]),
          ] else ...[
            Row(children: [
              StatusPill(_status.isEmpty ? _job!.status : _status),
              const SizedBox(width: 8),
              Expanded(child: Text(_stage ?? '', style: const TextStyle(color: NF.text2))),
              Text('${(_progress * 100).round()}%'),
            ]),
            const SizedBox(height: 8),
            NeonProgress(value: _progress, status: _status.isEmpty ? _job!.status : _status),
            if (out != null) ...[
              const SizedBox(height: 16),
              Text('${out.filename} · ${out.width}×${out.height} · ${formatBytes(out.sizeBytes)}'),
              const SizedBox(height: 12),
              FilledButton.icon(
                key: const Key('save'),
                onPressed: () => _saveToDevice(out),
                icon: const Icon(Icons.download),
                label: const Text('Save to device'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async => SharePlus.instance.share(ShareParams(files: [XFile((await _download(out)).path)])),
                icon: const Icon(Icons.ios_share),
                label: const Text('Share'),
              ),
            ],
          ],
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: NF.red))),
        ]),
      ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 6),
        child: Text(t, style: const TextStyle(color: NF.text2, fontSize: 12)),
      );
}
