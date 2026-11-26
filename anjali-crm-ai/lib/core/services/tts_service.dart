import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Free, offline text-to-speech on Android's native engine (flutter_tts).
/// Supports play / pause / resume / stop, speed, voice and language.
class TtsService extends ChangeNotifier {
  TtsService._() {
    _tts.setStartHandler(() => _set(TtsState.playing));
    _tts.setCompletionHandler(() {
      _offset = 0;
      _set(TtsState.stopped);
    });
    _tts.setCancelHandler(() => _set(TtsState.stopped));
    _tts.setPauseHandler(() => _set(TtsState.paused));
    _tts.setContinueHandler(() => _set(TtsState.playing));
    _tts.setProgressHandler((text, start, end, word) => _offset = start);
  }
  static final TtsService instance = TtsService._();

  final _tts = FlutterTts();
  TtsState state = TtsState.stopped;
  String _text = '';
  int _offset = 0;
  double rate = 0.5;
  String? language;
  Map<String, String>? voice;

  /// Text currently loaded (for UI "now reading").
  String get text => _text;

  void _set(TtsState s) {
    state = s;
    notifyListeners();
  }

  Future<void> speak(String text) async {
    if (text.trim().isEmpty) return;
    await _tts.stop();
    _text = text;
    _offset = 0;
    await _tts.setSpeechRate(rate);
    if (language != null) await _tts.setLanguage(language!);
    if (voice != null) await _tts.setVoice(voice!);
    await _tts.speak(text);
    _set(TtsState.playing);
  }

  /// Native pause (API 26+). Falls back to stop-and-remember on engines that
  /// don't support it; [resume] then continues from the last spoken word.
  Future<void> pause() async {
    try {
      await _tts.pause();
    } catch (e) {
      debugPrint('tts pause unsupported: $e');
      await _tts.stop();
    }
    _set(TtsState.paused);
  }

  Future<void> resume() async {
    if (_text.isEmpty) return;
    final rest = _offset > 0 && _offset < _text.length ? _text.substring(_offset) : _text;
    await _tts.setSpeechRate(rate);
    await _tts.speak(rest);
    _set(TtsState.playing);
  }

  Future<void> stop() async {
    await _tts.stop();
    _offset = 0;
    _set(TtsState.stopped);
  }

  Future<void> setRate(double r) async {
    rate = r.clamp(0.1, 1.0);
    await _tts.setSpeechRate(rate);
    notifyListeners();
  }

  Future<List<String>> languages() async => [for (final l in (await _tts.getLanguages) as List? ?? const []) '$l']..sort();

  /// Voices for [lang] (or all), each as {name, locale}.
  Future<List<Map<String, String>>> voices({String? lang}) async {
    final raw = (await _tts.getVoices) as List? ?? const [];
    final list = [
      for (final v in raw)
        if (v is Map) {'name': '${v['name']}', 'locale': '${v['locale']}'},
    ];
    return lang == null ? list : list.where((v) => v['locale']!.toLowerCase().startsWith(lang.toLowerCase().split('-').first)).toList();
  }

  Future<void> setLanguage(String lang) async {
    language = lang;
    voice = null;
    await _tts.setLanguage(lang);
    notifyListeners();
  }

  Future<void> setVoice(Map<String, String> v) async {
    voice = v;
    await _tts.setVoice(v);
    notifyListeners();
  }
}

enum TtsState { playing, paused, stopped }
