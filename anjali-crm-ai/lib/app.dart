import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/constants/app_assets.dart';
import 'core/services/error_reporter.dart';
import 'core/theme/app_theme.dart';
import 'features/gate/app_gate.dart';
import 'providers/app_providers.dart';

/// Root navigator key, used to open screens from notification taps.
final rootNavigatorKey = GlobalKey<NavigatorState>();

class AnjaliApp extends ConsumerWidget {
  const AnjaliApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: AppInfo.name,
      debugShowCheckedModeBanner: false,
      navigatorKey: rootNavigatorKey,
      scaffoldMessengerKey: ErrorReporter.messengerKey,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      builder: (context, child) {
        // Keep layouts intact on large accessibility text sizes.
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(textScaler: mq.textScaler.clamp(minScaleFactor: .85, maxScaleFactor: 1.3)),
          child: child!,
        );
      },
      home: const AppGate(),
    );
  }
}
