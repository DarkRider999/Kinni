import 'dart:async';

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../recipe.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';
import 'batches.dart';

class BatchBuilderScreen extends StatefulWidget {
  const BatchBuilderScreen({super.key, required this.files});
  final List<MediaFile> files;
  @override
  State<BatchBuilderScreen> createState() => _BatchBuilderScreenState();
}

class _BatchBuilderScreenState extends State<BatchBuilderScreen> {
  final _steps = <EditStep>[EditStep.create('enhance')];
  int _open = 0;
  String _imageFormat = 'jpg';
  String _videoFormat = 'mp4';
  int? _estimate;
  String? _error;
  bool _submitting = false;
  Timer? _debounce;

  Map<String, dynamic> get _recipe =>
      buildRecipe(_steps, output: {'image_format': _imageFormat, 'video_format': _videoFormat});

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_estimate == null) _reestimate();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _changed() {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _reestimate);
  }

  void _reestimate() {
    if (_steps.isEmpty) return setState(() => _estimate = null);
    SessionScope.of(context).api.estimate(_recipe, widget.files.map((f) => f.id).toList()).then(
          (c) => mounted
              ? setState(() {
                  _estimate = c;
                  _error = null;
                })
              : null,
          onError: (Object e) => mounted ? setState(() => _error = '$e') : null,
        );
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final b = await SessionScope.of(context).api.createBatch(widget.files.map((f) => f.id).toList(), _recipe);
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => BatchDetailScreen(batchId: b.id)));
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = SessionScope.of(context).me!;
    final kinds = widget.files.map((f) => f.kind).toSet();
    return Scaffold(
      appBar: AppBar(title: Text('Recipe · ${widget.files.length} files')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        for (var i = 0; i < _steps.length; i++)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Text('${i + 1}  ', style: const TextStyle(color: NF.text2)),
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _open = _open == i ? -1 : i),
                      child: Text(_steps[i].summary, style: const TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ),
                  IconButton(
                    onPressed: i == 0 ? null : () => setState(() => _steps.insert(i - 1, _steps.removeAt(i))),
                    icon: const Icon(Icons.arrow_upward, size: 18),
                  ),
                  IconButton(
                    onPressed: () {
                      _steps.removeAt(i);
                      _changed();
                    },
                    icon: const Icon(Icons.delete_outline, size: 18),
                  ),
                ]),
                if (_open == i) StepEditor(step: _steps[i], onChanged: _changed, maxUpscale: me.plan.maxUpscale),
              ]),
            ),
          ),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final op in kOps.keys.where((op) => _steps.every((s) => s.op != op)))
            ActionChip(
              key: Key('add-$op'),
              avatar: const Icon(Icons.add, size: 16),
              label: Text(kOps[op]!.label),
              onPressed: () {
                _steps.add(EditStep.create(op));
                _open = _steps.length - 1;
                _changed();
              },
            ),
        ]),
        const SizedBox(height: 16),
        if (kinds.contains('image'))
          Wrap(spacing: 6, children: [
            for (final f in const ['jpg', 'png', 'webp'])
              ChoiceChip(label: Text(f.toUpperCase()), selected: _imageFormat == f, onSelected: (_) => setState(() => _imageFormat = f)),
          ]),
        if (kinds.contains('video') || kinds.contains('gif'))
          Wrap(spacing: 6, children: [
            for (final f in const ['mp4', 'mov', 'gif'])
              ChoiceChip(label: Text(f.toUpperCase()), selected: _videoFormat == f, onSelected: (_) => setState(() => _videoFormat = f)),
          ]),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: NF.red))),
      ]),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Text('≈ ${_estimate ?? '…'} credits', key: const Key('batch-estimate')),
            const Spacer(),
            FilledButton(
              key: const Key('start-batch'),
              onPressed: _submitting || _steps.isEmpty || _estimate == null || me.credits < _estimate! ? null : _submit,
              child: Text(_submitting ? 'Starting…' : 'Process ${widget.files.length}'),
            ),
          ]),
        ),
      ),
    );
  }
}
