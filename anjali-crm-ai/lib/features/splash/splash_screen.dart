import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/common.dart';

/// Animated brand splash (FR SEC-01): logo scale + glow, title fade.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.onDone});
  final VoidCallback onDone;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1700))..forward();

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) widget.onDone();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(const AssetImage(AppAssets.logo), context);
    for (final b in AppAssets.tabBackgrounds.toSet()) {
      precacheImage(AssetImage(b), context);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scale = Tween(begin: .78, end: 1.0).animate(CurvedAnimation(parent: _c, curve: const Interval(0, .6, curve: Curves.easeOutBack)));
    final fade = CurvedAnimation(parent: _c, curve: const Interval(.35, .85, curve: Curves.easeOut));
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1E1B2E), Color(0xFF3B2F6B), AppColors.primary],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Opacity(opacity: .12, child: Image.asset(AppAssets.bgGold, fit: BoxFit.cover)),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ScaleTransition(scale: scale, child: const AppLogo(size: 168)),
                  const SizedBox(height: 28),
                  FadeTransition(
                    opacity: fade,
                    child: Column(
                      children: [
                        Text(AppInfo.name,
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: .5)),
                        const SizedBox(height: 6),
                        Text(AppInfo.tagline,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(color: const Color(0xFFFFC2D6), letterSpacing: 1.2)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 36),
                  FadeTransition(
                    opacity: fade,
                    child: const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white70)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
