import 'package:flutter/material.dart';

import '../../core/services/tts_service.dart';
import '../../core/theme/app_colors.dart';

/// Read-aloud button: play / pause / resume, long-press to stop.
/// [textBuilder] is read lazily so it always speaks the current text.
class SpeakButton extends StatelessWidget {
  const SpeakButton({super.key, required this.textBuilder, this.size = 22});
  final String Function() textBuilder;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tts = TtsService.instance;
    return ListenableBuilder(
      listenable: tts,
      builder: (context, _) {
        final mine = tts.text == textBuilder() && tts.text.isNotEmpty;
        final state = mine ? tts.state : TtsState.stopped;
        return GestureDetector(
          onLongPress: mine ? tts.stop : null,
          child: IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: switch (state) { TtsState.playing => 'Pause', TtsState.paused => 'Resume', _ => 'Read aloud' },
            icon: Icon(
              switch (state) { TtsState.playing => Icons.pause_circle_rounded, TtsState.paused => Icons.play_circle_rounded, _ => Icons.volume_up_rounded },
              color: AppColors.primary,
              size: size,
            ),
            onPressed: () => switch (state) {
              TtsState.playing => tts.pause(),
              TtsState.paused => tts.resume(),
              TtsState.stopped => tts.speak(textBuilder()),
            },
          ),
        );
      },
    );
  }
}

/// Global mini player shown while something is being read aloud:
/// pause/resume, stop and speed.
class TtsMiniPlayer extends StatelessWidget {
  const TtsMiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final tts = TtsService.instance;
    return ListenableBuilder(
      listenable: tts,
      builder: (context, _) {
        if (tts.state == TtsState.stopped) return const SizedBox.shrink();
        return Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(16),
          color: Theme.of(context).colorScheme.surface,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(children: [
              const Icon(Icons.record_voice_over_rounded, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(child: Text(tts.text, maxLines: 1, overflow: TextOverflow.ellipsis)),
              PopupMenuButton<double>(
                tooltip: 'Speed',
                icon: Text('${(tts.rate * 2).toStringAsFixed(1)}×', style: const TextStyle(fontWeight: FontWeight.w700)),
                onSelected: tts.setRate,
                itemBuilder: (_) => [for (final r in const [.25, .4, .5, .65, .8, 1.0]) PopupMenuItem(value: r, child: Text('${(r * 2).toStringAsFixed(1)}×'))],
              ),
              IconButton(
                icon: Icon(tts.state == TtsState.playing ? Icons.pause_rounded : Icons.play_arrow_rounded),
                onPressed: tts.state == TtsState.playing ? tts.pause : tts.resume,
              ),
              IconButton(icon: const Icon(Icons.stop_rounded), onPressed: tts.stop),
            ]),
          ),
        );
      },
    );
  }
}
