import 'package:flutter/material.dart';

import 'glass_card.dart';

/// KPI tile: icon, value, label. Tap to drill down.
class StatCard extends StatelessWidget {
  const StatCard({super.key, required this.label, required this.value, required this.icon, required this.color, this.onTap});

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: color.withValues(alpha: .15), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(value, style: t.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                ),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(color: t.bodySmall?.color?.withValues(alpha: .7))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
