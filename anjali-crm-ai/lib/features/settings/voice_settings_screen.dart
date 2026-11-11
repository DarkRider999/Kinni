import 'package:flutter/material.dart';

import '../../core/services/tts_service.dart';
import '../tts/speak_button.dart';
import 'settings_widgets.dart';

/// Settings → Voice & Speech: language, voice and speed for the free,
/// offline Android text-to-speech engine.
class VoiceSettingsScreen extends StatefulWidget {
  const VoiceSettingsScreen({super.key});

  @override
  State<VoiceSettingsScreen> createState() => _VoiceSettingsScreenState();
}

class _VoiceSettingsScreenState extends State<VoiceSettingsScreen> {
  final _tts = TtsService.instance;
  List<String> _languages = const [];
  List<Map<String, String>> _voices = const [];
  static const _sample = 'Hello Anjali. You have three followups today. Never miss a lead again!';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final langs = await _tts.languages();
      final voices = await _tts.voices(lang: _tts.language);
      if (mounted) {
        setState(() {
          _languages = langs;
          _voices = voices;
        });
      }
    } catch (_) {
      // No TTS engine installed: the screen explains this below.
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: _tts,
        builder: (context, _) => SettingsPage(
          title: 'Voice & Speech',
          children: [
            SettingsGroup(title: 'Reading speed', icon: Icons.speed_rounded, children: [
              Slider(
                value: _tts.rate,
                min: .1,
                max: 1,
                divisions: 9,
                label: '${(_tts.rate * 2).toStringAsFixed(1)}×',
                onChanged: _tts.setRate,
              ),
            ]),
            SettingsGroup(title: 'Language', icon: Icons.language_rounded, children: [
              if (_languages.isEmpty)
                const SettingsNote('No text-to-speech languages found. Install "Speech Services by Google" from the Play Store (free).')
              else
                ListTile(
                  title: DropdownButton<String>(
                    isExpanded: true,
                    value: _languages.contains(_tts.language) ? _tts.language : null,
                    hint: const Text('Device default'),
                    items: [for (final l in _languages) DropdownMenuItem(value: l, child: Text(l))],
                    onChanged: (l) async {
                      if (l == null) return;
                      await _tts.setLanguage(l);
                      await _load();
                    },
                  ),
                ),
            ]),
            SettingsGroup(title: 'Voice', icon: Icons.record_voice_over_rounded, children: [
              if (_voices.isEmpty)
                const ListTile(title: Text('Default voice'))
              else
                for (final v in _voices.take(40))
                  ListTile(
                    onTap: () => _tts.setVoice(v),
                    leading: Icon(_tts.voice?['name'] == v['name'] ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded),
                    title: Text(v['name']!),
                    subtitle: Text(v['locale']!),
                  ),
            ]),
            SettingsGroup(title: 'Test', icon: Icons.play_circle_rounded, children: [
              ListTile(title: const Text(_sample), trailing: SpeakButton(textBuilder: () => _sample)),
            ]),
          ],
        ),
      );
}
