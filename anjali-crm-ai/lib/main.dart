import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'bootstrap.dart';
import 'providers/app_providers.dart';

/// Anjali CRM AI: Never Miss A Lead Again.
Future<void> main() async {
  final prefs = await bootstrap();
  runApp(ProviderScope(
    overrides: [prefsBoxProvider.overrideWithValue(prefs)],
    child: const AnjaliApp(),
  ));
}
