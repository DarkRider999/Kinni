import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/theme.dart';
import 'router.dart';

/// Root widget — wires the router and the light/dark themes (SPEC §6.1).
class SmartBeginningApp extends ConsumerWidget {
  const SmartBeginningApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final GoRouter router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Smart Beginning',
      debugShowCheckedModeBanner: false,
      theme: SbTheme.light(),
      darkTheme: SbTheme.dark(),
      routerConfig: router,
    );
  }
}
