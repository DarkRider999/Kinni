import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../constants/app_assets.dart';

/// Full-screen Lottie burst shown when a lead is approved or disbursed.
Future<void> showCelebration(BuildContext context, {required String message}) async {
  final overlay = Overlay.maybeOf(context);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (ctx) => IgnorePointer(
      child: Material(
        color: Colors.black.withValues(alpha: .25),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Lottie.asset(AppAssets.lottieCelebration, width: 240, height: 240, repeat: false),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                child: Text(message, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1E1B2E))),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  await Future<void>.delayed(const Duration(milliseconds: 2600));
  entry.remove();
}
