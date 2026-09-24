import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../api/models.dart';
import '../recipe.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';
import 'export_sheet.dart';

class EditorScreen extends StatefulWidget {
  const EditorScreen({super.key, required this.fileId, this.tool});
  final String fileId;
  final String? tool;
  @override
  State<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  MediaFile? _file;
  final _steps = <EditStep>[];
  late String _panel = widget.tool ?? 'enhance';
  Output? _preview;
  String? _stage;
  double _progress = 0;
  bool _busy = false;
  Timer? _debounce;
  int _seq = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_file == null) {
      SessionScope.of(context).api.file(widget.fileId).then((f) {
        if (!mounted) return;
        setState(() => _file = f);
        final seed = kPanels.firstWhere((p) => p.$1 == widget.tool, orElse: () => ('', '', <String>[])).$3;
        if (seed.isNotEmpty) _addOp(seed.first);
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _changed() {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 700), _runPreview);
  }

  void _addOp(String op) {
    _steps.add(EditStep.create(op));
    _changed();
  }

  Future<void> _runPreview() async {
    final file = _file;
    if (file == null) return;
    final active = _steps.where((s) => s.enabled && appliesTo(s.op, file.kind)).toList();
    if (active.isEmpty) {
      setState(() => _preview = null);
      return;
    }
    final session = SessionScope.of(context);
    final mySeq = ++_seq;
    setState(() {
      _busy = true;
      _stage = 'Queued';
      _progress = 0;
    });
    try {
      final job = await session.api.preview(file.id, buildRecipe(_steps));
      final done = await session.watchJob(job.id, (status, progress, stage) {
        if (mounted && mySeq == _seq) {
          setState(() {
            _progress = progress;
            _stage = stage;
          });
        }
      });
      if (!mounted || mySeq != _seq) return;
      setState(() {
        if (done.outputs.isNotEmpty) _preview = done.outputs.first;
        _busy = false;
      });
      if (done.errorMessage != null && mounted) showError(context, done.errorMessage!);
    } catch (e) {
      if (mounted && mySeq == _seq) {
        setState(() => _busy = false);
        showError(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final file = _file;
    if (file == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final me = SessionScope.of(context).me!;
    final panel = kPanels.firstWhere((p) => p.$1 == _panel);
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(file.originalName, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16)),
          Text('${file.width}×${file.height} · ${file.faceCount} face${file.faceCount == 1 ? '' : 's'}',
              style: const TextStyle(fontSize: 12, color: NF.text2)),
        ]),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton(
              key: const Key('export'),
              onPressed: _steps.isEmpty
                  ? null
                  : () => showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: NF.surface,
                        builder: (_) => ExportSheet(file: file, steps: _steps),
                      ),
              child: const Text('Export'),
            ),
          ),
        ],
      ),
      body: Column(children: [
        Expanded(
          flex: 5,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
                color: const Color(0xFF0C0E13), borderRadius: BorderRadius.circular(16), border: Border.all(color: NF.border)),
            clipBehavior: Clip.antiAlias,
            child: Stack(children: [
              Positioned.fill(child: _canvas(file)),
              if (_busy)
                Positioned(
                  left: 10,
                  top: 10,
                  child: Container(
                    key: const Key('preview-status'),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(99)),
                    child: Text('${_stage ?? 'Queued'} · ${(_progress * 100).round()}%', style: const TextStyle(fontSize: 12)),
                  ),
                ),
            ]),
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), children: [
            for (var i = 0; i < _steps.length; i++)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: InputChip(
                  label: Text(_steps[i].summary,
                      style: TextStyle(decoration: _steps[i].enabled ? null : TextDecoration.lineThrough)),
                  selected: _steps[i].enabled,
                  showCheckmark: false,
                  onSelected: (v) {
                    _steps[i].enabled = v;
                    _changed();
                  },
                  onDeleted: () {
                    _steps.removeAt(i);
                    _changed();
                  },
                ),
              ),
          ]),
        ),
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
            for (final (id, label, _) in kPanels)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  key: Key('panel-$id'),
                  label: Text(label),
                  selected: _panel == id,
                  onSelected: (_) => setState(() => _panel = id),
                ),
              ),
          ]),
        ),
        Expanded(
          flex: 4,
          child: ListView(padding: const EdgeInsets.all(12), children: [
            if (panel.$3.isEmpty) _PlannedCard(panel.$1),
            for (final op in panel.$3)
              if (!appliesTo(op, file.kind))
                Text('${kOps[op]!.label} applies to videos only.', style: const TextStyle(color: NF.text2))
              else if (_steps.every((s) => s.op != op))
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton.icon(
                    key: Key('add-$op'),
                    onPressed: () => _addOp(op),
                    icon: const Icon(Icons.add),
                    label: Text('Add ${kOps[op]!.label}'),
                  ),
                )
              else
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(kOps[op]!.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                      StepEditor(step: _steps.firstWhere((s) => s.op == op), onChanged: _changed, maxUpscale: me.plan.maxUpscale),
                    ]),
                  ),
                ),
          ]),
        ),
      ]),
    );
  }

  Widget _canvas(MediaFile file) {
    if (file.isImage) return CompareSlider(before: file.url, after: _preview?.url);
    final p = _preview;
    if (p != null && p.mimeType.startsWith('video/')) return _VideoView(url: p.url, key: ValueKey(p.url));
    if (p != null) return Image.network(p.url, fit: BoxFit.contain);
    if (file.kind == 'gif') return Image.network(file.url, fit: BoxFit.contain);
    return _VideoView(url: file.url, key: ValueKey(file.url));
  }
}

class _VideoView extends StatefulWidget {
  const _VideoView({super.key, required this.url});
  final String url;
  @override
  State<_VideoView> createState() => _VideoViewState();
}

class _VideoViewState extends State<_VideoView> {
  late final VideoPlayerController _c = VideoPlayerController.networkUrl(Uri.parse(widget.url));

  @override
  void initState() {
    super.initState();
    _c.initialize().then((_) {
      if (!mounted) return;
      _c
        ..setLooping(true)
        ..setVolume(0)
        ..play();
      setState(() {});
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _c.value.isInitialized
      ? Center(child: AspectRatio(aspectRatio: _c.value.aspectRatio, child: VideoPlayer(_c)))
      : const Center(child: CircularProgressIndicator());
}

class _PlannedCard extends StatelessWidget {
  const _PlannedCard(this.id);
  final String id;
  @override
  Widget build(BuildContext context) {
    final (title, body) = id == 'swap'
        ? (
            'Face Swap: coming in milestone M4',
            'Photo and video face swaps with identity locked across frames. Source faces must be your own (selfie liveness '
                'check) or someone who approved it through an in-app consent link. Outputs are labeled as AI-edited.'
          )
        : (
            'Dress Swap: coming in milestone M5',
            'Formal, casual, party, wedding and traditional outfits, or your own garment photo, with lighting and body '
                'proportions preserved. Outfits cannot be made more revealing than swimwear.'
          );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: NF.borderStrong)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(body, style: const TextStyle(color: NF.text2, fontSize: 13)),
      ]),
    );
  }
}
