import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design/components/mascot_view.dart';
import '../../design/tokens.dart';

/// Splash (SPEC §10.01). Phase-0 always routes to Age Selection after the
/// minimum display time; returning-session resolution lands in Phase 1.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(SbDurations.splashMin, () {
      if (mounted) {
        context.go('/age');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SbColors.background,
      body: Semantics(
        label: 'Smart Beginning, loading',
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                'Smart Beginning',
                style: TextStyle(
                  fontFamily: SbFonts.display,
                  fontSize: 34,
                  fontWeight: FontWeight.w700,
                  color: SbColors.primary,
                ),
              ),
              SizedBox(height: SbSpacing.xxl),
              MascotView(),
              SizedBox(height: SbSpacing.xxl),
              CircularProgressIndicator(color: SbColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}
