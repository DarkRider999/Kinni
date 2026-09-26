import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../app_scope.dart';
import '../models/route_option.dart';
import '../models/trip.dart';
import '../utils/format.dart';
import '../widgets/app_map.dart';
import '../widgets/eta_confidence_widget.dart';
import '../widgets/route_card.dart';
import 'navigation_screen.dart';

class TripResultScreen extends StatefulWidget {
  final TripPlan plan;
  const TripResultScreen({super.key, required this.plan});

  @override
  State<TripResultScreen> createState() => _TripResultScreenState();
}

class _TripResultScreenState extends State<TripResultScreen> {
  late RouteType _selected = widget.plan.preferredRouteType;
  Map<String, dynamic>? _parking;
  bool _starting = false;

  TripPlan get plan => widget.plan;
  RouteOption get selectedRoute => plan.route(_selected);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadParking());
  }

  Future<void> _loadParking() async {
    try {
      final p = await AppScope.of(context).api.parkingNear(plan.destination.lat, plan.destination.lng);
      if (mounted) setState(() => _parking = p);
    } catch (_) {}
  }

  Future<void> _start() async {
    setState(() => _starting = true);
    final api = AppScope.of(context).api;
    try {
      if (plan.tripId != null) await api.startTrip(plan.tripId!, _selected);
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => NavigationScreen(plan: plan, routeType: _selected)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  ({Color color, IconData icon, String title, String subtitle}) get _verdictUi {
    final leaveBy = formatClock(plan.recommendedDeparture);
    final arrive = formatClock(plan.expectedArrival);
    return switch (plan.verdict) {
      Verdict.late => (
          color: Colors.red.shade700,
          icon: Icons.running_with_errors,
          title: "You're ${plan.minutesLate} min late",
          subtitle: 'Leave now to arrive around $arrive',
        ),
      Verdict.leaveNow => (color: Colors.orange.shade800, icon: Icons.directions_run, title: 'Leave now', subtitle: 'You will arrive around $arrive'),
      Verdict.onTime => (
          color: Colors.green.shade700,
          icon: Icons.check_circle,
          title: "You're on time",
          subtitle: 'Leave by $leaveBy (in ${formatMinutes(plan.minutesUntilDeparture ?? 0)}) to arrive by ${formatClock(plan.targetArrival!)}',
        ),
      Verdict.noTarget => (color: Colors.blueGrey.shade700, icon: Icons.route, title: 'Arrive around $arrive', subtitle: 'Leaving at $leaveBy'),
    };
  }

  String? _sameAs(RouteOption r) {
    for (final other in plan.routes) {
      if (other.routeType.index < r.routeType.index && other.variantKey == r.variantKey) return other.routeType.label.toLowerCase();
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final v = _verdictUi;
    final route = selectedRoute;
    final points = route.points;
    return Scaffold(
      appBar: AppBar(title: Text(plan.destination.label.isEmpty ? 'Your trip' : 'To ${plan.destination.label}')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 100),
        children: [
          Container(
            color: v.color,
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Icon(v.icon, color: Colors.white, size: 44),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(v.title, style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(v.subtitle, style: theme.textTheme.bodyLarge?.copyWith(color: Colors.white)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 240,
            child: AppMap(
              key: ValueKey(_selected),
              initialCenter: plan.origin.latLng,
              initialZoom: 11,
              fitPoints: points.length > 1 ? points : [plan.origin.latLng, plan.destination.latLng],
              polylines: [
                // Selected route drawn last so it sits on top.
                for (final r in [...plan.routes.where((r) => r.routeType != _selected), route])
                  if (r.points.length > 1)
                    Polyline(
                      points: r.points,
                      strokeWidth: r.routeType == _selected ? 6 : 4,
                      color: routeColors[r.routeType]!.withValues(alpha: r.routeType == _selected ? 1 : 0.4),
                      borderStrokeWidth: r.routeType == _selected ? 1.5 : 0,
                      borderColor: Colors.white,
                    ),
              ],
              markers: [
                pinMarker(plan.origin.latLng, const Color(0xFF1E88E5)),
                pinMarker(plan.destination.latLng, const Color(0xFFE53935)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                EtaConfidenceWidget(
                  etaMinutes: route.durationMinutes,
                  p10Minutes: route.durationP10Minutes,
                  p90Minutes: route.durationP90Minutes,
                  confidence: route.etaConfidence,
                ),
                const SizedBox(height: 16),
                Card(
                  color: theme.colorScheme.secondaryContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.lightbulb_outline, color: theme.colorScheme.onSecondaryContainer),
                        const SizedBox(width: 10),
                        Expanded(child: Text(plan.explanation, style: TextStyle(color: theme.colorScheme.onSecondaryContainer))),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Chip(avatar: const Icon(Icons.traffic, size: 18), label: Text('Traffic: ${plan.congestionLevel.toLowerCase()}')),
                    if (plan.weather.isNotEmpty) Chip(avatar: const Icon(Icons.wb_sunny_outlined, size: 18), label: Text(plan.weather)),
                    for (final e in plan.events.take(2)) Chip(avatar: const Icon(Icons.event, size: 18), label: Text('${e.name} ${formatClock(e.startsAt)}')),
                    if (plan.provider == 'haversine') const Chip(avatar: Icon(Icons.info_outline, size: 18), label: Text('Estimated route (offline)')),
                  ],
                ),
                const SizedBox(height: 12),
                Text('Route options', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final r in plan.routes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: RouteCard(
                      route: r,
                      selected: r.routeType == _selected,
                      preferred: r.routeType == plan.preferredRouteType,
                      sameAs: _sameAs(r),
                      onTap: () => setState(() => _selected = r.routeType),
                    ),
                  ),
                if (_parking != null) _ParkingCard(parking: _parking!),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56), backgroundColor: routeColors[_selected]),
            onPressed: _starting ? null : _start,
            icon: const Icon(Icons.navigation),
            label: Text('Start ${_selected.label.toLowerCase()} route'),
          ),
        ),
      ),
    );
  }
}

class _ParkingCard extends StatelessWidget {
  final Map<String, dynamic> parking;
  const _ParkingCard({required this.parking});

  @override
  Widget build(BuildContext context) {
    final tariff = parking['tariff'] as Map<String, dynamic>;
    final lots = (parking['carParks'] as List).cast<Map<String, dynamic>>();
    final free = tariff['free'] as bool? ?? false;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.local_parking),
              const SizedBox(width: 8),
              Text('Parking at destination', style: Theme.of(context).textTheme.titleSmall),
            ]),
            const SizedBox(height: 6),
            Text(free
                ? '${tariff['note']}'
                : '${tariff['note']}: ~AED ${tariff['standardAedPerHour']}/h standard, AED ${tariff['premiumAedPerHour']}/h premium'),
            for (final lot in lots.take(3))
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('• ${lot['name']} (${formatDistance(lot['distanceM'] as num)})', style: Theme.of(context).textTheme.bodySmall),
              ),
          ],
        ),
      ),
    );
  }
}
