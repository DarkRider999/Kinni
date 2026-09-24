import 'dart:async';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

import '../api/models.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets.dart';

class BatchesScreen extends StatefulWidget {
  const BatchesScreen({super.key});
  @override
  State<BatchesScreen> createState() => _BatchesScreenState();
}

class _BatchesScreenState extends State<BatchesScreen> {
  List<Batch>? _items;
  StreamSubscription<ServerEvent>? _sub;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_sub == null) {
      final s = SessionScope.of(context);
      _load();
      _sub = s.events.where((e) => e.type == 'batch.progress').listen((_) => _load());
    }
  }

  Future<void> _load() async {
    final items = await SessionScope.of(context).api.batches();
    if (mounted) setState(() => _items = items);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Batch manager', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),
        if (items == null) const Center(child: CircularProgressIndicator()),
        if (items != null && items.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No batches yet', style: TextStyle(color: NF.text2))))),
        for (final b in items ?? <Batch>[])
          Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BatchDetailScreen(batchId: b.id))),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [Expanded(child: Text(b.name, style: const TextStyle(fontWeight: FontWeight.w700))), StatusPill(b.status)]),
                  const SizedBox(height: 10),
                  NeonProgress(value: b.progress, status: b.status),
                  const SizedBox(height: 6),
                  Text('${b.doneFiles}/${b.totalFiles} done${b.failedFiles > 0 ? ' · ${b.failedFiles} failed' : ''}',
                      style: const TextStyle(color: NF.text2, fontSize: 12)),
                ]),
              ),
            ),
          ),
      ]),
    );
  }
}

class BatchDetailScreen extends StatefulWidget {
  const BatchDetailScreen({super.key, required this.batchId});
  final String batchId;
  @override
  State<BatchDetailScreen> createState() => _BatchDetailScreenState();
}

class _BatchDetailScreenState extends State<BatchDetailScreen> {
  Batch? _batch;
  List<Job> _jobs = [];
  final _live = <String, ServerEvent>{};
  StreamSubscription<ServerEvent>? _sub;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_sub == null) {
      _load();
      _sub = SessionScope.of(context).events.where((e) => e.batchId == widget.batchId).listen((e) {
        if (e.type == 'job.progress') {
          setState(() => _live[e.jobId!] = e);
          if (e.status == 'succeeded') _load();
        } else {
          _load();
        }
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final api = SessionScope.of(context).api;
    final (b, jobs) = (await api.batch(widget.batchId), await api.batchJobs(widget.batchId));
    if (mounted) {
      setState(() {
        _batch = b;
        _jobs = jobs;
      });
    }
  }

  Future<void> _action(String action) async {
    try {
      await SessionScope.of(context).api.batchAction(widget.batchId, action);
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _shareZip() async {
    try {
      final api = SessionScope.of(context).api;
      final bytes = await api.download(await api.batchZipUrl(widget.batchId));
      final f = File('${(await getTemporaryDirectory()).path}/batch_${widget.batchId.substring(0, 8)}.zip');
      await f.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(f.path)]));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = _batch;
    return Scaffold(
      appBar: AppBar(title: Text(b?.name ?? 'Batch')),
      body: b == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Row(children: [
                  Text('${b.doneFiles}/${b.totalFiles}', key: const Key('batch-progress'), style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(width: 12),
                  StatusPill(b.status),
                  const Spacer(),
                  Text('${b.creditsSpent}/${b.creditsReserved} credits', style: const TextStyle(color: NF.text2)),
                ]),
                const SizedBox(height: 10),
                NeonProgress(value: b.progress, status: b.status),
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  if (b.status == 'paused')
                    OutlinedButton.icon(onPressed: () => _action('resume'), icon: const Icon(Icons.play_arrow), label: const Text('Resume'))
                  else if (b.status == 'queued' || b.status == 'running')
                    OutlinedButton.icon(onPressed: () => _action('pause'), icon: const Icon(Icons.pause), label: const Text('Pause')),
                  if (const {'queued', 'running', 'paused'}.contains(b.status))
                    OutlinedButton.icon(onPressed: () => _action('cancel'), icon: const Icon(Icons.cancel_outlined), label: const Text('Cancel')),
                  if (b.failedFiles > 0)
                    OutlinedButton.icon(onPressed: () => _action('retry-failed'), icon: const Icon(Icons.replay), label: const Text('Retry failed')),
                  if (b.doneFiles > 0)
                    FilledButton.icon(onPressed: _shareZip, icon: const Icon(Icons.archive_outlined), label: const Text('ZIP')),
                ]),
                const SizedBox(height: 12),
                for (final j in _jobs)
                  Builder(builder: (context) {
                    final ev = _live[j.id];
                    final status = ev?.status ?? j.status;
                    return ListTile(
                      key: const Key('batch-row'),
                      contentPadding: EdgeInsets.zero,
                      leading: j.outputs.isNotEmpty && j.outputs.first.mimeType.startsWith('image/')
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(j.outputs.first.url, width: 44, height: 44, fit: BoxFit.cover))
                          : const SizedBox(width: 44, height: 44, child: Icon(Icons.hourglass_empty, color: NF.text2)),
                      title: Text(j.errorMessage ?? ev?.stage ?? j.stage ?? (status == 'pending' ? 'Waiting for a slot' : status),
                          style: const TextStyle(fontSize: 13)),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: NeonProgress(value: ev?.progress ?? j.progress, status: status),
                      ),
                      trailing: StatusPill(status),
                    );
                  }),
              ]),
            ),
    );
  }
}
