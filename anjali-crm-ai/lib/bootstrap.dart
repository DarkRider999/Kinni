import 'dart:async';
import 'dart:ui';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:hive_ce/hive_ce.dart';
import 'package:workmanager/workmanager.dart';

import 'background/background_tasks.dart';
import 'core/config/firebase_config.dart';
import 'core/services/analytics_service.dart';
import 'core/services/notification_service.dart';
import 'data/local/hive_service.dart';

/// Platform initialisation before `runApp` (docs/02 §4.1). Returns the
/// plain prefs box used to override `prefsBoxProvider`.
Future<Box> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (await FirebaseConfig.ensureInitialised()) {
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
    await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(!kDebugMode);
  } else {
    PlatformDispatcher.instance.onError = (error, stack) {
      Telemetry.recordError(error, stack, fatal: true);
      return true;
    };
  }

  final prefs = await HiveService.instance.openPrefs();
  await NotificationService.instance.init();

  try {
    await Workmanager().initialize(callbackDispatcher);
    await registerBackgroundTasks();
  } catch (e) {
    debugPrint('Workmanager unavailable: $e');
  }
  return prefs;
}
