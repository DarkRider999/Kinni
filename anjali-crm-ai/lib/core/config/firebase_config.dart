import 'package:firebase_core/firebase_core.dart';

/// Firebase options injected at build time with
/// `--dart-define-from-file=config/firebase.json` (docs/06-api-design.md §4.1).
/// When the values are empty the app runs in offline-only mode.
abstract final class FirebaseConfig {
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _senderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _bucket = String.fromEnvironment('FIREBASE_STORAGE_BUCKET');

  static bool get isConfigured => _apiKey.isNotEmpty && _appId.isNotEmpty && _projectId.isNotEmpty;

  static FirebaseOptions get options => const FirebaseOptions(
        apiKey: _apiKey,
        appId: _appId,
        messagingSenderId: _senderId,
        projectId: _projectId,
        storageBucket: _bucket == '' ? null : _bucket,
      );

  /// True once [Firebase.initializeApp] succeeded in this isolate.
  static bool initialised = false;

  static Future<bool> ensureInitialised() async {
    if (initialised) return true;
    if (!isConfigured) return false;
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: options);
      initialised = true;
    } catch (_) {
      initialised = false;
    }
    return initialised;
  }
}
