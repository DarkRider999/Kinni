import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/services/file_storage_service.dart';
import '../../core/services/permission_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../domain/entities/voice_note.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';

enum _Mode { idle, recording, dictating }

/// Voice notes for one client (FR VOICE-01..04): unlimited audio
/// recordings, speech-to-text dictation, playback and editable transcripts.
class VoiceNotesTab extends ConsumerStatefulWidget {
  const VoiceNotesTab({super.key, required this.clientId});
  final String clientId;

  @override
  ConsumerState<VoiceNotesTab> createState() => _VoiceNotesTabState();
}

class _VoiceNotesTabState extends ConsumerState<VoiceNotesTab> {
  final _recorder = AudioRecorder();
  final _speech = SpeechToText();
  final _player = AudioPlayer();

  _Mode _mode = _Mode.idle;
  String? _recordPath;
  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;
  Timer? _ticker;
  String _words = '';
  String? _playingId;

  @override
  void initState() {
    super.initState();
    _player.playerStateStream.listen((s) {
      if (s.processingState == ProcessingState.completed) {
        _player.stop();
        _player.seek(Duration.zero);
        if (mounted) setState(() => _playingId = null);
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    if (_mode == _Mode.recording) _recorder.stop();
    if (_mode == _Mode.dictating) _speech.cancel();
    _recorder.dispose();
    _player.dispose();
    super.dispose();
  }

  CrmActions get _actions => ref.read(crmActionsProvider);

  void _startTicker() {
    _startedAt = DateTime.now();
    _elapsed = Duration.zero;
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsed = DateTime.now().difference(_startedAt!));
    });
  }

  Future<bool> _ensureMic() =>
      Permissions.ensure(context, Permission.microphone, rationale: 'The microphone is used to record voice notes about your clients.');

  // ── Recording ─────────────────────────────────────────────────────────────

  Future<void> _startRecording() async {
    if (!await _ensureMic() || !mounted) return;
    try {
      await _player.stop();
      final path = await FileStore.newClientFilePath(widget.clientId, 'voice', '.m4a');
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
      setState(() {
        _mode = _Mode.recording;
        _recordPath = path;
        _playingId = null;
      });
      _startTicker();
    } catch (_) {
      if (mounted) showSnack(context, 'Could not start recording', error: true);
    }
  }

  Future<void> _stopRecording({bool save = true}) async {
    _ticker?.cancel();
    final duration = DateTime.now().difference(_startedAt ?? DateTime.now());
    final path = await _recorder.stop() ?? _recordPath;
    setState(() => _mode = _Mode.idle);
    if (path == null) return;
    if (!save || duration.inMilliseconds < 500) {
      await FileStore.deleteQuietly(path);
      return;
    }
    await _actions.addVoiceNote(widget.clientId, filePath: path, durationMs: duration.inMilliseconds);
    if (mounted) showSnack(context, 'Voice note saved (${Fmt.duration(duration.inMilliseconds)})');
  }

  // ── Dictation ─────────────────────────────────────────────────────────────

  Future<void> _startDictation() async {
    if (!await _ensureMic() || !mounted) return;
    final ok = await _speech.initialize(
      onError: (e) {
        if (mounted && _mode == _Mode.dictating) showSnack(context, 'Speech error: ${e.errorMsg}', error: true);
      },
      onStatus: (s) {
        // The engine stops on silence; keep what was heard so far.
        if ((s == SpeechToText.doneStatus || s == SpeechToText.notListeningStatus) && mounted && _mode == _Mode.dictating) {
          _ticker?.cancel();
          setState(() {});
        }
      },
    );
    if (!mounted) return;
    if (!ok) {
      showSnack(context, 'Speech recognition is not available on this device', error: true);
      return;
    }
    await _player.stop();
    setState(() {
      _mode = _Mode.dictating;
      _words = '';
      _playingId = null;
    });
    _startTicker();
    await _speech.listen(
      onResult: (r) {
        if (mounted) setState(() => _words = r.recognizedWords);
      },
      listenOptions: SpeechListenOptions(
        partialResults: true,
        listenMode: ListenMode.dictation,
        listenFor: const Duration(minutes: 5),
        pauseFor: const Duration(seconds: 8),
      ),
    );
  }

  Future<void> _stopDictation({bool save = true}) async {
    _ticker?.cancel();
    await _speech.stop();
    final text = _words.trim();
    setState(() {
      _mode = _Mode.idle;
      _words = '';
    });
    if (!save) return;
    if (text.isEmpty) {
      if (mounted) showSnack(context, 'Nothing was heard');
      return;
    }
    await _actions.addVoiceNote(widget.clientId, transcript: text);
    if (mounted) showSnack(context, 'Dictated note saved');
  }

  // ── Playback & editing ────────────────────────────────────────────────────

  Future<void> _togglePlay(VoiceNote v) async {
    if (_playingId == v.id) {
      if (_player.playing) {
        await _player.pause();
      } else {
        await _player.play();
      }
      setState(() {});
      return;
    }
    if (!File(v.filePath!).existsSync()) {
      showSnack(context, 'Audio file is missing on this device', error: true);
      return;
    }
    try {
      await _player.stop();
      await _player.setFilePath(v.filePath!);
      setState(() => _playingId = v.id);
      unawaited(_player.play());
    } catch (_) {
      if (mounted) showSnack(context, 'Could not play this note', error: true);
    }
  }

  Future<void> _editTranscript(VoiceNote v) async {
    final c = TextEditingController(text: v.transcript);
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Transcript'),
        content: TextField(controller: c, autofocus: true, maxLines: 6, minLines: 3, decoration: const InputDecoration(hintText: 'What was said…')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    c.dispose();
    if (text != null) await _actions.updateVoiceTranscript(v, text);
  }

  Future<void> _delete(VoiceNote v) async {
    final ok = await confirm(context, title: 'Delete note?', message: 'This voice note will be removed.', ok: 'Delete', destructive: true);
    if (!ok) return;
    if (_playingId == v.id) {
      await _player.stop();
      setState(() => _playingId = null);
    }
    await _actions.deleteVoiceNote(v);
  }

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(clientVoiceNotesProvider(widget.clientId));
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
      children: [
        _Recorder(
          mode: _mode,
          elapsed: _elapsed,
          words: _words,
          onRecord: _startRecording,
          onDictate: _startDictation,
          onStop: () => _mode == _Mode.recording ? _stopRecording() : _stopDictation(),
          onCancel: () => _mode == _Mode.recording ? _stopRecording(save: false) : _stopDictation(save: false),
        ),
        if (notes.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 24),
            child: EmptyState(icon: Icons.mic_none_rounded, title: 'No voice notes yet', message: 'Record or dictate what the client said.'),
          ),
        for (final v in notes)
          _NoteCard(
            note: v,
            player: _playingId == v.id ? _player : null,
            onPlay: v.hasAudio ? () => _togglePlay(v) : null,
            onEdit: () => _editTranscript(v),
            onDelete: () => _delete(v),
          ),
      ],
    );
  }
}

/// Record / dictate controls with a live timer.
class _Recorder extends StatelessWidget {
  const _Recorder({
    required this.mode,
    required this.elapsed,
    required this.words,
    required this.onRecord,
    required this.onDictate,
    required this.onStop,
    required this.onCancel,
  });
  final _Mode mode;
  final Duration elapsed;
  final String words;
  final VoidCallback onRecord;
  final VoidCallback onDictate;
  final VoidCallback onStop;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    if (mode == _Mode.idle) {
      return GlassCard(
        child: Row(
          children: [
            Expanded(child: FilledButton.icon(onPressed: onRecord, icon: const Icon(Icons.mic_rounded), label: const Text('Record'))),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.tonalIcon(onPressed: onDictate, icon: const Icon(Icons.record_voice_over_rounded), label: const Text('Dictate')),
            ),
          ],
        ),
      );
    }
    final recording = mode == _Mode.recording;
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.fiber_manual_record_rounded, color: AppColors.danger, size: 16),
              const SizedBox(width: 8),
              Expanded(child: Text(recording ? 'Recording…' : 'Listening…', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
              Text(Fmt.duration(elapsed.inMilliseconds), style: t.titleMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
          if (!recording) ...[
            const SizedBox(height: 10),
            Text(words.isEmpty ? 'Start speaking…' : words, style: t.bodyMedium),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: OutlinedButton(onPressed: onCancel, child: const Text('Discard'))),
              const SizedBox(width: 10),
              Expanded(child: FilledButton.icon(onPressed: onStop, icon: const Icon(Icons.stop_rounded), label: const Text('Save'))),
            ],
          ),
        ],
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({required this.note, required this.player, required this.onPlay, required this.onEdit, required this.onDelete});
  final VoiceNote note;

  /// The shared player when this note is the active one.
  final AudioPlayer? player;
  final VoidCallback? onPlay;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final p = player;
    return GlassCard(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (onPlay != null)
                StreamBuilder<bool>(
                  stream: p?.playingStream,
                  builder: (_, s) => IconButton.filledTonal(
                    tooltip: (s.data ?? false) ? 'Pause' : 'Play',
                    onPressed: onPlay,
                    icon: Icon((s.data ?? false) ? Icons.pause_rounded : Icons.play_arrow_rounded),
                  ),
                )
              else
                const Padding(padding: EdgeInsets.all(8), child: Icon(Icons.notes_rounded, color: AppColors.primary)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(Fmt.dateTime(note.createdAt), style: t.bodySmall),
                    Text(note.hasAudio ? 'Voice note · ${Fmt.duration(note.durationMs)}' : 'Dictated note',
                        style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              IconButton(tooltip: 'Edit transcript', onPressed: onEdit, icon: const Icon(Icons.edit_note_rounded)),
              IconButton(tooltip: 'Delete', onPressed: onDelete, icon: const Icon(Icons.delete_outline_rounded)),
            ],
          ),
          if (p != null)
            StreamBuilder<Duration>(
              stream: p.positionStream,
              builder: (_, s) {
                final total = p.duration ?? Duration(milliseconds: note.durationMs);
                final pos = s.data ?? Duration.zero;
                final max = total.inMilliseconds <= 0 ? 1.0 : total.inMilliseconds.toDouble();
                return Row(
                  children: [
                    Expanded(
                      child: Slider(
                        value: pos.inMilliseconds.clamp(0, max).toDouble(),
                        max: max,
                        onChanged: (v) => p.seek(Duration(milliseconds: v.round())),
                      ),
                    ),
                    Text('${Fmt.duration(pos.inMilliseconds)} / ${Fmt.duration(total.inMilliseconds)}', style: t.bodySmall),
                    const SizedBox(width: 8),
                  ],
                );
              },
            ),
          if (note.transcript != null && note.transcript!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 6, 8, 0),
              child: InkWell(onTap: onEdit, child: Text(note.transcript!, style: t.bodyMedium)),
            ),
        ],
      ),
    );
  }
}
