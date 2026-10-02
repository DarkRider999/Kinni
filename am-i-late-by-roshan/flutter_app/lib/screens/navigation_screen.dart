import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../app_scope.dart';
import '../models/driver_profile.dart';
import '../models/place.dart';
import '../models/route_option.dart';
import '../models/trip.dart';
import '../utils/format.dart';
import '../utils/geo.dart';
import '../widgets/app_map.dart';
import '../widgets/route_card.dart';
import '../widgets/sleep_alert_overlay.dart';
import '../widgets/speed_indicator_widget.dart';

/// Turn-by-turn guidance with live speed/limit, lane guidance from real
/// directions data, off-route re-routing, periodic re-planning (adapts when a
/// faster route appears), crowd speed reporting and fatigue monitoring.
class NavigationScreen extends StatefulWidget {
  final TripPlan plan;
  final RouteType routeType;
  const NavigationScreen({super.key, required this.plan, required this.routeType});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  static const _offRouteM = 80.0;
  static const _arrivalM = 60.0;

  late TripPlan _plan = widget.plan;
  late RouteType _routeType = widget.routeType;
  RouteOption get _route => _plan.route(_routeType);

  final _map = MapController();
  bool _mapReady = false;
  AppScope? _scope;
  StreamSubscription<Position>? _posSub;
  Position? _pos;
  int _stepIndex = 0;
  double _speedKmh = 0;
  int? _limitKmh;
  String? _limitRoad;
  DateTime _lastLimitCheck = DateTime.fromMillisecondsSinceEpoch(0);
  LatLng? _lastLimitAt;
  DateTime _lastReport = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _lastReplan = DateTime.now();
  bool _rerouting = false;
  bool _arrived = false;
  bool _followUser = true;
  DriverProfile _profile = const DriverProfile();
  Timer? _fatigueTimer;
  Timer? _replanTimer;
  ({String level, String recommendation})? _fatigueAlert;
  DateTime? _fatigueSnoozedUntil;
  String? _banner;
  Timer? _bannerTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startNavigation());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _scope = AppScope.of(context);
  }

  Future<void> _startNavigation() async {
    final scope = AppScope.of(context);
    try {
      _profile = await scope.api.getDriverProfile();
    } catch (_) {}
    try {
      await scope.location.ensurePermission();
    } catch (e) {
      _showBanner(e.toString());
      return;
    }
    if (_profile.fatigueMonitoringEnabled) {
      scope.sensors.start();
      _fatigueTimer = Timer.periodic(const Duration(minutes: 2), (_) => _checkFatigue());
    }
    _replanTimer = Timer.periodic(const Duration(minutes: 3), (_) => _replan(reason: _ReplanReason.periodic));
    _posSub = scope.location.navigationStream().listen(_onPosition, onError: (Object e) => _showBanner('GPS error: $e'));
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _fatigueTimer?.cancel();
    _replanTimer?.cancel();
    _bannerTimer?.cancel();
    _scope?.sensors.stop();
    _map.dispose();
    super.dispose();
  }

  void _showBanner(String text, {Duration duration = const Duration(seconds: 6)}) {
    if (!mounted) return;
    setState(() => _banner = text);
    _bannerTimer?.cancel();
    _bannerTimer = Timer(duration, () => mounted ? setState(() => _banner = null) : null);
  }

  void _onPosition(Position p) {
    if (!mounted || _arrived) return;
    final scope = AppScope.of(context);
    final here = LatLng(p.latitude, p.longitude);
    final speed = p.speed >= 0 ? p.speed * 3.6 : 0.0;
    scope.sensors.addSpeedSample(speed);
    setState(() {
      _pos = p;
      _speedKmh = speed;
      _stepIndex = _currentStep(here);
    });
    if (_followUser) {
      if (_mapReady) _map.move(here, 16.5);
    }

    if (distanceM(here, _plan.destination.latLng) < _arrivalM) {
      _arrive();
      return;
    }
    if (_route.points.length > 1 && distanceToPathM(here, _route.points) > _offRouteM && p.accuracy < 50) {
      _replan(reason: _ReplanReason.offRoute);
    }
    _maybeUpdateSpeedLimit(here);
    _maybeReport(p);
  }

  List<int>? _stepPointIdx;
  String? _stepPointIdxKey;

  static int _nearestIndex(LatLng p, List<LatLng> pts) {
    var best = 0;
    var bestD = double.infinity;
    for (var i = 0; i < pts.length; i++) {
      final d = distanceM(p, pts[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /// Index into the route polyline where each step's maneuver happens (cached per route).
  List<int> get _stepPointIndex {
    final key = '${_routeType.name}:${_route.polyline.hashCode}';
    if (_stepPointIdxKey != key) {
      _stepPointIdx = [for (final s in _route.steps) _nearestIndex(s.location, _route.points)];
      _stepPointIdxKey = key;
    }
    return _stepPointIdx!;
  }

  /// The next maneuver: the first step whose position on the route is ahead of ours.
  /// Uses progress along the polyline, so fast GPS jumps can't skip a maneuver.
  int _currentStep(LatLng here) {
    final steps = _route.steps;
    if (steps.isEmpty) return 0;
    if (_route.points.length < 2) {
      return distanceM(here, steps.first.location) < 35 ? (steps.length - 1) : 0;
    }
    final at = _nearestIndex(here, _route.points);
    final idx = _stepPointIndex;
    for (var i = 0; i < steps.length; i++) {
      if (idx[i] > at) return i;
    }
    return steps.length - 1;
  }

  RouteStep? get _nextStep => _route.steps.isEmpty ? null : _route.steps[_stepIndex];

  String get _roadName {
    final steps = _route.steps;
    if (steps.isEmpty) return '';
    final i = (_stepIndex - 1).clamp(0, steps.length - 1);
    return steps[i].roadName;
  }

  Future<void> _maybeUpdateSpeedLimit(LatLng here) async {
    final now = DateTime.now();
    final moved = _lastLimitAt == null ? double.infinity : distanceM(here, _lastLimitAt!);
    if (now.difference(_lastLimitCheck) < const Duration(seconds: 20) && moved < 300) return;
    _lastLimitCheck = now;
    _lastLimitAt = here;
    try {
      final r = await AppScope.of(context).api.speedLimit(here.latitude, here.longitude, road: _roadName);
      if (mounted) {
        setState(() {
          _limitKmh = r.limitKmh;
          _limitRoad = r.roadName;
        });
      }
    } catch (_) {}
  }

  Future<void> _maybeReport(Position p) async {
    if (DateTime.now().difference(_lastReport) < const Duration(seconds: 60)) return;
    _lastReport = DateTime.now();
    try {
      await AppScope.of(context).api.reportSpeed(
            lat: p.latitude,
            lng: p.longitude,
            speedKmh: _speedKmh,
            speedLimitKmh: _limitKmh,
            heading: p.heading >= 0 ? p.heading : null,
          );
    } catch (_) {}
  }

  Future<void> _replan({required _ReplanReason reason}) async {
    final p = _pos;
    if (p == null || _rerouting || _arrived) return;
    if (reason == _ReplanReason.offRoute && DateTime.now().difference(_lastReplan) < const Duration(seconds: 20)) return;
    _rerouting = true;
    _lastReplan = DateTime.now();
    if (reason == _ReplanReason.offRoute) _showBanner('Off route - finding a new way...');
    try {
      final fresh = await AppScope.of(context).api.planTrip(
            origin: Place(lat: p.latitude, lng: p.longitude, label: 'Current location'),
            destination: _plan.destination,
            targetArrival: _plan.targetArrival != null && _plan.targetArrival!.isAfter(DateTime.now()) ? _plan.targetArrival : null,
            save: false,
          );
      if (!mounted) return;
      final current = fresh.route(_routeType);
      final fastest = fresh.route(RouteType.fastest);
      final saving = current.durationMinutes - fastest.durationMinutes;
      setState(() {
        _plan = TripPlan(
          tripId: _plan.tripId,
          origin: fresh.origin,
          destination: _plan.destination,
          verdict: fresh.verdict,
          minutesLate: fresh.minutesLate,
          minutesUntilDeparture: fresh.minutesUntilDeparture,
          targetArrival: _plan.targetArrival,
          recommendedDeparture: fresh.recommendedDeparture,
          expectedArrival: fresh.expectedArrival,
          explanation: fresh.explanation,
          routes: fresh.routes,
          weather: fresh.weather,
          weatherCondition: fresh.weatherCondition,
          events: fresh.events,
          disruptionScore: fresh.disruptionScore,
          congestionLevel: fresh.congestionLevel,
          provider: fresh.provider,
          aiSource: fresh.aiSource,
          preferredRouteType: _plan.preferredRouteType,
        );
        _stepIndex = 0;
      });
      if (reason == _ReplanReason.offRoute) {
        _showBanner('New route: ${formatMinutes(current.durationMinutes)} ${current.summary}');
      } else if (_routeType != RouteType.fastest && saving >= 3) {
        _offerSwitch(saving);
      } else if (fresh.verdict == Verdict.late) {
        _showBanner('Traffic changed: you may arrive ~${fresh.minutesLate} min late.');
      }
    } catch (_) {
      // Keep guiding on the old route if re-planning fails.
    } finally {
      _rerouting = false;
    }
  }

  void _offerSwitch(double saving) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 12),
        content: Text('Traffic changed: the fastest route now saves ${saving.round()} min.'),
        action: SnackBarAction(label: 'Switch', onPressed: () => setState(() {
          _routeType = RouteType.fastest;
          _stepIndex = 0;
        })),
      ),
    );
  }

  Future<void> _checkFatigue() async {
    final scope = AppScope.of(context);
    if (_fatigueAlert != null || (_fatigueSnoozedUntil?.isAfter(DateTime.now()) ?? false)) return;
    try {
      final r = await scope.api.fatigueCheck(
        continuousDriveMinutes: scope.sensors.continuousDriveMinutes,
        steeringVariance: scope.sensors.steeringVariance,
        harshEventCount: scope.sensors.harshEventCount,
        speedVariance: scope.sensors.speedVariance,
      );
      if (mounted && r['should_alert'] == true) {
        setState(() => _fatigueAlert = (level: r['level'] as String? ?? 'TIRED', recommendation: r['recommendation'] as String? ?? 'Take a break.'));
      }
    } catch (_) {}
  }

  Future<void> _arrive() async {
    if (_arrived) return;
    setState(() => _arrived = true);
    final api = AppScope.of(context).api;
    if (_plan.tripId != null) {
      try {
        await api.completeTrip(_plan.tripId!);
      } catch (_) {}
    }
    if (!mounted) return;
    final late = _plan.targetArrival != null && DateTime.now().isAfter(_plan.targetArrival!);
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        icon: Icon(late ? Icons.schedule : Icons.celebration, size: 40),
        title: Text(late ? 'You have arrived' : 'You made it on time!'),
        content: Text('Welcome to ${_plan.destination.label}.'),
        actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Done'))],
      ),
    );
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _endTrip() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('End navigation?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep driving')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('End')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final api = AppScope.of(context).api;
    if (_plan.tripId != null) {
      try {
        await api.cancelTrip(_plan.tripId!);
      } catch (_) {}
    }
    if (mounted) Navigator.of(context).pop();
  }

  double get _remainingKm {
    final steps = _route.steps;
    var m = 0.0;
    for (var i = _stepIndex; i < steps.length; i++) {
      m += steps[i].distanceM;
    }
    if (_pos != null && _nextStep != null) {
      m = m - _nextStep!.distanceM + distanceM(LatLng(_pos!.latitude, _pos!.longitude), _nextStep!.location);
    }
    return (m / 1000).clamp(0, double.infinity);
  }

  double get _remainingMinutes {
    final total = _route.distanceKm <= 0 ? 1 : _route.distanceKm;
    return _route.durationMinutes * (_remainingKm / total).clamp(0.0, 1.0);
  }

  IconData _maneuverIcon(RouteStep s) {
    final m = s.modifier ?? '';
    if (s.maneuver == 'arrive') return Icons.flag;
    if (s.maneuver.contains('roundabout') || s.maneuver.contains('rotary')) return Icons.roundabout_right;
    if (m.contains('uturn')) return Icons.u_turn_left;
    if (m.contains('slight left') || s.maneuver.contains('fork') && m.contains('left')) return Icons.turn_slight_left;
    if (m.contains('slight right') || s.maneuver.contains('fork') && m.contains('right')) return Icons.turn_slight_right;
    if (m.contains('left')) return Icons.turn_left;
    if (m.contains('right')) return Icons.turn_right;
    if (s.maneuver.contains('merge')) return Icons.merge;
    return Icons.straight;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final step = _nextStep;
    final here = _pos == null ? null : LatLng(_pos!.latitude, _pos!.longitude);
    final distToStep = step != null && here != null ? distanceM(here, step.location) : step?.distanceM;
    final eta = DateTime.now().add(Duration(seconds: (_remainingMinutes * 60).round()));
    final color = routeColors[_routeType]!;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _endTrip();
      },
      child: Scaffold(
        body: Stack(
          children: [
            AppMap(
              controller: _map,
              initialCenter: here ?? _plan.origin.latLng,
              initialZoom: 16,
              polylines: [
                if (_route.points.length > 1)
                  Polyline(points: _route.points, color: color, strokeWidth: 7, borderStrokeWidth: 2, borderColor: Colors.white),
              ],
              markers: [
                pinMarker(_plan.destination.latLng, const Color(0xFFE53935)),
                if (here != null) userMarker(here, headingDegrees: _pos!.heading >= 0 ? _pos!.heading : 0),
              ],
              onReady: () => _mapReady = true,
              onUserGesture: () {
                if (_followUser) setState(() => _followUser = false);
              },
            ),
            SafeArea(
              child: Column(
                children: [
                  if (step != null)
                    Card(
                      margin: const EdgeInsets.all(12),
                      color: color,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(_maneuverIcon(step), color: Colors.white, size: 44),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (distToStep != null)
                                        Text(formatDistance(distToStep), style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.bold)),
                                      Text(step.instruction, style: theme.textTheme.titleMedium?.copyWith(color: Colors.white)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            if (step.laneGuidance != null) ...[
                              const SizedBox(height: 10),
                              _LaneGuidance(step: step),
                            ],
                          ],
                        ),
                      ),
                    ),
                  if (_banner != null)
                    Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12),
                      color: theme.colorScheme.inverseSurface,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(_banner!, style: TextStyle(color: theme.colorScheme.onInverseSurface)),
                      ),
                    ),
                ],
              ),
            ),
            Positioned(
              left: 12,
              bottom: 150,
              child: SpeedIndicatorWidget(speedKmh: _speedKmh, limitKmh: _limitKmh, toleranceKmh: _profile.speedAlertThresholdKmh),
            ),
            if (!_followUser)
              Positioned(
                right: 12,
                bottom: 150,
                child: FloatingActionButton.small(
                  heroTag: 'recenter',
                  onPressed: () {
                    setState(() => _followUser = true);
                    if (_pos != null && _mapReady) _map.move(LatLng(_pos!.latitude, _pos!.longitude), 16.5);
                  },
                  child: const Icon(Icons.navigation),
                ),
              ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(
                child: Card(
                  margin: const EdgeInsets.all(12),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('${formatMinutes(_remainingMinutes)} · ${_remainingKm.toStringAsFixed(1)} km',
                                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                              Text(
                                'Arrive ${formatClock(eta)}'
                                '${_plan.targetArrival != null ? (eta.isAfter(_plan.targetArrival!) ? ' · late by ${formatMinutes(eta.difference(_plan.targetArrival!).inMinutes)}' : ' · on time') : ''}'
                                '${_limitRoad != null ? ' · $_limitRoad' : ''}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        if (_rerouting) const Padding(padding: EdgeInsets.all(8), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                        IconButton.filledTonal(tooltip: 'End trip', onPressed: _endTrip, icon: const Icon(Icons.close)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (_fatigueAlert != null)
              Positioned.fill(
                child: SleepAlertOverlay(
                  level: _fatigueAlert!.level,
                  recommendation: _fatigueAlert!.recommendation,
                  onTookBreak: () {
                    AppScope.of(context).sensors.resetDriveTimer();
                    setState(() => _fatigueAlert = null);
                  },
                  onDismiss: () => setState(() {
                    _fatigueAlert = null;
                    _fatigueSnoozedUntil = DateTime.now().add(const Duration(minutes: 15));
                  }),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

enum _ReplanReason { offRoute, periodic }

/// Lane arrows from real lane data (highlighted lanes are the ones to use).
class _LaneGuidance extends StatelessWidget {
  final RouteStep step;
  const _LaneGuidance({required this.step});

  IconData _icon(List<String> ind) {
    final i = ind.join(' ');
    if (i.contains('uturn')) return Icons.u_turn_left;
    if (i.contains('slight left')) return Icons.turn_slight_left;
    if (i.contains('slight right')) return Icons.turn_slight_right;
    if (i.contains('left')) return Icons.turn_left;
    if (i.contains('right')) return Icons.turn_right;
    return Icons.straight;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (step.lanes.isNotEmpty)
          Row(
            children: [
              for (final lane in step.lanes)
                Container(
                  margin: const EdgeInsets.only(right: 4),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: lane.valid ? Colors.white : Colors.white24,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(_icon(lane.indications), size: 22, color: lane.valid ? Colors.black : Colors.white70),
                ),
            ],
          ),
        const SizedBox(height: 4),
        Text(step.laneGuidance!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
