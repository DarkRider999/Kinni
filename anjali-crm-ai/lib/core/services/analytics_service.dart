import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

import '../config/firebase_config.dart';

/// Thin, PII-free wrapper over Firebase Analytics + Crashlytics.
/// Every call is a no-op when Firebase is not configured.
abstract final class Telemetry {
  static Future<void> event(String name, [Map<String, Object>? params]) async {
    if (!FirebaseConfig.initialised) return;
    try {
      await FirebaseAnalytics.instance.logEvent(name: name, parameters: params);
    } catch (e) {
      debugPrint('analytics: $e');
    }
  }

  static Future<void> screen(String name) async {
    if (!FirebaseConfig.initialised) return;
    try {
      await FirebaseAnalytics.instance.logScreenView(screenName: name);
    } catch (_) {}
  }

  static void recordError(Object error, StackTrace stack, {bool fatal = false}) {
    debugPrint('error: $error');
    if (!FirebaseConfig.initialised) return;
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: fatal);
  }
}
