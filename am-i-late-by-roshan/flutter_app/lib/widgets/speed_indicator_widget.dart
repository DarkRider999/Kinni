import 'package:flutter/material.dart';

/// Current speed against the posted limit; turns amber near the limit and red over it.
class SpeedIndicatorWidget extends StatelessWidget {
  final double speedKmh;
  final int? limitKmh;
  final int toleranceKmh;

  const SpeedIndicatorWidget({super.key, required this.speedKmh, required this.limitKmh, this.toleranceKmh = 5});

  bool get isOver => limitKmh != null && speedKmh > limitKmh! + toleranceKmh;
  bool get isNear => limitKmh != null && !isOver && speedKmh > limitKmh!;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bg = isOver ? Colors.red.shade600 : (isNear ? Colors.amber.shade600 : theme.colorScheme.surface);
    final fg = isOver || isNear ? Colors.white : theme.colorScheme.onSurface;
    return Semantics(
      label: 'Speed ${speedKmh.round()} kilometres per hour${limitKmh != null ? ', limit $limitKmh' : ''}',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            width: 76,
            height: 76,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle, boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)]),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('${speedKmh.round()}', style: theme.textTheme.headlineSmall?.copyWith(color: fg, fontWeight: FontWeight.bold)),
                Text('km/h', style: theme.textTheme.labelSmall?.copyWith(color: fg)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.red.shade700, width: 6),
            ),
            alignment: Alignment.center,
            child: Text(
              limitKmh?.toString() ?? '--',
              style: theme.textTheme.titleMedium?.copyWith(color: Colors.black, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
