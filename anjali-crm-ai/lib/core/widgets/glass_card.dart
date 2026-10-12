import 'dart:ui';

import 'package:flutter/material.dart';

/// Frosted-glass container: blur + translucent surface + hairline border.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin,
    this.radius = 20,
    this.onTap,
    this.color,
    this.blur = 18,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final VoidCallback? onTap;
  final Color? color;
  final double blur;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fill = color ?? (dark ? const Color(0xFF1A1826).withValues(alpha: .62) : Colors.white.withValues(alpha: .70));
    final border = dark ? Colors.white.withValues(alpha: .08) : Colors.white.withValues(alpha: .9);
    final r = BorderRadius.circular(radius);
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: r,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Material(
            color: fill,
            shape: RoundedRectangleBorder(borderRadius: r, side: BorderSide(color: border)),
            child: InkWell(
              onTap: onTap,
              borderRadius: r,
              child: Padding(padding: padding, child: child),
            ),
          ),
        ),
      ),
    );
  }
}
