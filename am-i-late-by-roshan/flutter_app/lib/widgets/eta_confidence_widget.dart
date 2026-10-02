import 'package:flutter/material.dart';

import '../utils/format.dart';

/// Shows the ETA with its likely range (p10-p90) and a confidence meter.
class EtaConfidenceWidget extends StatelessWidget {
  final double etaMinutes;
  final double p10Minutes;
  final double p90Minutes;
  final double confidence; // 0..1

  const EtaConfidenceWidget({
    super.key,
    required this.etaMinutes,
    required this.p10Minutes,
    required this.p90Minutes,
    required this.confidence,
  });

  Color _color(ColorScheme cs) {
    if (confidence >= 0.8) return Colors.green.shade600;
    if (confidence >= 0.6) return Colors.orange.shade700;
    return cs.error;
  }

  String get _label {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.6) return 'Medium confidence';
    return 'Low confidence';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _color(theme.colorScheme);
    final span = (p90Minutes - p10Minutes).clamp(1, double.infinity);
    final etaPos = ((etaMinutes - p10Minutes) / span).clamp(0.0, 1.0);
    return Semantics(
      label: 'Estimated ${formatMinutes(etaMinutes)}, likely between ${formatMinutes(p10Minutes)} and ${formatMinutes(p90Minutes)}, $_label',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(formatMinutes(etaMinutes), style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(width: 8),
              Text('(${p10Minutes.round()}-${p90Minutes.round()} min)', style: theme.textTheme.bodyMedium),
              const Spacer(),
              Icon(Icons.insights, size: 16, color: color),
              const SizedBox(width: 4),
              Text(_label, style: theme.textTheme.labelMedium?.copyWith(color: color)),
            ],
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, c) => Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: 8,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    gradient: LinearGradient(colors: [Colors.green.shade300, Colors.orange.shade300, Colors.red.shade300]),
                  ),
                ),
                Positioned(
                  left: (c.maxWidth * etaPos - 6).clamp(0, c.maxWidth - 12),
                  top: -3,
                  child: Container(
                    width: 12,
                    height: 14,
                    decoration: BoxDecoration(color: theme.colorScheme.onSurface, borderRadius: BorderRadius.circular(3)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Best case', style: theme.textTheme.labelSmall),
              Text('Confidence ${(confidence * 100).round()}%', style: theme.textTheme.labelSmall),
              Text('Worst case', style: theme.textTheme.labelSmall),
            ],
          ),
        ],
      ),
    );
  }
}
