import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/constants/motivation_messages.dart';

/// Opening affirmation (FR MOT-01…03): random message on a themed card;
/// the only way to close it is the beating heart.
class MotivationDialog extends StatefulWidget {
  const MotivationDialog({super.key, required this.message, this.name = 'Anjali'});

  final MotivationMessage message;
  final String name;

  static Future<void> show(BuildContext context, MotivationMessage message, {String name = 'Anjali'}) => showGeneralDialog(
        context: context,
        barrierDismissible: false,
        barrierLabel: 'Daily motivation',
        barrierColor: Colors.black.withValues(alpha: .55),
        transitionDuration: const Duration(milliseconds: 420),
        transitionBuilder: (_, a, _, child) => FadeTransition(
          opacity: a,
          child: ScaleTransition(scale: Tween(begin: .88, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutBack)), child: child),
        ),
        pageBuilder: (_, _, _) => MotivationDialog(message: message, name: name),
      );

  @override
  State<MotivationDialog> createState() => _MotivationDialogState();
}

class _ThemeStyle {
  const _ThemeStyle(this.label, this.icon, this.colors);
  final String label;
  final IconData icon;
  final List<Color> colors;
}

class _MotivationDialogState extends State<MotivationDialog> with TickerProviderStateMixin {
  late final _beat = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();
  late final _twinkle = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
  late final _burst = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));
  final _stars = List.generate(26, (i) {
    final r = Random(i * 7919);
    return (Offset(r.nextDouble(), r.nextDouble()), 1.0 + r.nextDouble() * 2.4, r.nextDouble());
  });

  static const _styles = {
    MotivationTheme.universe: _ThemeStyle('UNIVERSE', Icons.auto_awesome_rounded, [Color(0xFF1E1B4B), Color(0xFF4C1D95), Color(0xFF6C63FF)]),
    MotivationTheme.healing: _ThemeStyle('HEALING', Icons.spa_rounded, [Color(0xFF064E3B), Color(0xFF0F766E), Color(0xFF14B8A6)]),
    MotivationTheme.positivity: _ThemeStyle('POSITIVITY', Icons.wb_sunny_rounded, [Color(0xFF9D174D), Color(0xFFDB2777), Color(0xFFFF6B9D)]),
  };

  @override
  void dispose() {
    _beat.dispose();
    _twinkle.dispose();
    _burst.dispose();
    super.dispose();
  }

  /// Heartbeat curve: two quick pulses then rest ("lub-dub").
  double _heartScale(double t) {
    double pulse(double c, double w) => max(0, 1 - ((t - c).abs() / w));
    return 1 + .16 * pulse(.12, .1) + .1 * pulse(.32, .1);
  }

  Future<void> _close() async {
    HapticFeedback.mediumImpact();
    await _burst.forward();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final style = _styles[widget.message.theme]!;
    final t = Theme.of(context).textTheme;
    final width = min(MediaQuery.sizeOf(context).width - 40, 420.0);

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: width,
          margin: const EdgeInsets.symmetric(vertical: 24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: style.colors),
            boxShadow: [BoxShadow(color: style.colors.last.withValues(alpha: .5), blurRadius: 40, spreadRadius: 2)],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(32),
            child: Stack(
              children: [
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: _twinkle,
                    builder: (_, _) => CustomPaint(painter: _StarsPainter(_stars, _twinkle.value)),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(26, 26, 26, 20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(style.icon, color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Text(style.label, style: t.labelLarge?.copyWith(color: Colors.white, letterSpacing: 4, fontWeight: FontWeight.w700)),
                          const SizedBox(width: 8),
                          Icon(style.icon, color: Colors.white, size: 20),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('A message for you, ${widget.name}', style: t.bodySmall?.copyWith(color: Colors.white70)),
                      const SizedBox(height: 22),
                      Text(
                        '“${widget.message.text}”',
                        textAlign: TextAlign.center,
                        style: t.titleLarge?.copyWith(color: Colors.white, height: 1.45, fontWeight: FontWeight.w600, fontStyle: FontStyle.italic),
                      ),
                      const SizedBox(height: 28),
                      Semantics(
                        button: true,
                        label: 'Close',
                        child: GestureDetector(
                          onTap: _close,
                          child: AnimatedBuilder(
                            animation: Listenable.merge([_beat, _burst]),
                            builder: (_, _) {
                              final burst = _burst.value;
                              return Stack(
                                alignment: Alignment.center,
                                children: [
                                  // Expanding ring while closing.
                                  if (burst > 0)
                                    Container(
                                      width: 70 + burst * 90,
                                      height: 70 + burst * 90,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Colors.white.withValues(alpha: 1 - burst), width: 3),
                                      ),
                                    ),
                                  Transform.scale(
                                    scale: _heartScale(_beat.value) * (1 + burst * .5),
                                    child: Container(
                                      width: 72,
                                      height: 72,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white.withValues(alpha: .16),
                                        boxShadow: [BoxShadow(color: const Color(0xFFFF6B9D).withValues(alpha: .6), blurRadius: 24)],
                                      ),
                                      child: const Icon(Icons.favorite_rounded, color: Color(0xFFFF4D8D), size: 44),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text('Tap the heart to begin your day', style: t.bodySmall?.copyWith(color: Colors.white70)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StarsPainter extends CustomPainter {
  _StarsPainter(this.stars, this.t);
  final List<(Offset, double, double)> stars;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    for (final (pos, r, phase) in stars) {
      final o = (.25 + .75 * (.5 + .5 * sin((t + phase) * 2 * pi))).clamp(0.0, 1.0);
      canvas.drawCircle(Offset(pos.dx * size.width, pos.dy * size.height), r, Paint()..color = Colors.white.withValues(alpha: o * .7));
    }
  }

  @override
  bool shouldRepaint(_StarsPainter old) => old.t != t;
}
