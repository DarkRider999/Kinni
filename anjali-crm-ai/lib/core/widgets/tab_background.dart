import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Soft personal background for a tab: Anjali's photo at low opacity under
/// a theme-tinted gradient so foreground content stays readable.
class TabBackground extends StatelessWidget {
  const TabBackground({super.key, required this.image, required this.child, this.opacity});

  final String image;
  final Widget child;

  /// Override the image opacity (defaults: 0.16 light, 0.12 dark).
  final double? opacity;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = dark ? AppColors.backgroundDark : AppColors.background;
    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: base),
        Opacity(
          opacity: opacity ?? (dark ? .12 : .16),
          child: Image.asset(image, fit: BoxFit.cover, alignment: Alignment.topCenter, gaplessPlayback: true),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                base.withValues(alpha: .35),
                base.withValues(alpha: .70),
                base.withValues(alpha: .90),
              ],
            ),
          ),
        ),
        child,
      ],
    );
  }
}
