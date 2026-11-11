import 'package:flutter/material.dart';

import '../models/route_option.dart';
import '../utils/format.dart';

const routeColors = {
  RouteType.fastest: Color(0xFF1565C0),
  RouteType.cheapest: Color(0xFF2E7D32),
  RouteType.lowStress: Color(0xFF6A1B9A),
};

const _icons = {
  RouteType.fastest: Icons.bolt,
  RouteType.cheapest: Icons.savings_outlined,
  RouteType.lowStress: Icons.spa_outlined,
};

/// One route option (FASTEST / CHEAPEST / LOW_STRESS) with time, tolls and stress.
class RouteCard extends StatelessWidget {
  final RouteOption route;
  final bool selected;
  final bool preferred;
  final String? sameAs;
  final VoidCallback onTap;

  const RouteCard({super.key, required this.route, required this.selected, required this.onTap, this.preferred = false, this.sameAs});

  String get _stressLabel {
    if (route.stressScore < 25) return 'Relaxed';
    if (route.stressScore < 50) return 'Moderate';
    if (route.stressScore < 75) return 'Stressful';
    return 'Very stressful';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = routeColors[route.routeType]!;
    return Card(
      elevation: selected ? 3 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: selected ? color : theme.colorScheme.outlineVariant, width: selected ? 2 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(_icons[route.routeType], color: color),
                  const SizedBox(width: 8),
                  Text(route.routeType.label, style: theme.textTheme.titleMedium?.copyWith(color: color, fontWeight: FontWeight.w600)),
                  if (preferred) ...[
                    const SizedBox(width: 8),
                    Chip(
                      label: const Text('Your pick'),
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      labelStyle: theme.textTheme.labelSmall,
                    ),
                  ],
                  const Spacer(),
                  Text(formatMinutes(route.durationMinutes), style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 4),
              Text(sameAs != null ? '${route.summary} (same road as $sameAs)' : route.summary,
                  style: theme.textTheme.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  _Fact(Icons.straighten, '${route.distanceKm.toStringAsFixed(1)} km'),
                  _Fact(Icons.toll, formatAed(route.tollCostAed)),
                  _Fact(Icons.self_improvement, _stressLabel),
                  if (route.schoolZones.isNotEmpty) const _Fact(Icons.school_outlined, 'School zone'),
                ],
              ),
              if (route.tollGates.any((g) => g.feeAed > 0)) ...[
                const SizedBox(height: 6),
                Text(
                  route.tollGates.where((g) => g.feeAed > 0).map((g) => '${g.name} (${g.system == 'SALIK' ? 'Salik' : 'DARB'} AED ${g.feeAed.round()})').join(' · '),
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Fact(this.icon, this.text);

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [Icon(icon, size: 16), const SizedBox(width: 4), Text(text, style: Theme.of(context).textTheme.bodySmall)],
      );
}
