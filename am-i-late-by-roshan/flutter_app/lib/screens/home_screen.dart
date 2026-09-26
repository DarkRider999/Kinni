import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../app_scope.dart';
import '../models/driver_profile.dart';
import '../models/place.dart';
import '../models/trip.dart';
import '../utils/format.dart';
import '../widgets/app_map.dart';
import '../widgets/assistant_sheet.dart';
import '../widgets/place_search_field.dart';
import 'notification_settings_screen.dart';
import 'settings_screen.dart';
import 'trip_result_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _dubai = LatLng(25.2048, 55.2708);

  final _map = MapController();
  bool _mapReady = false;
  Place? _origin;
  Place? _destination;
  TimeOfDay? _arriveBy;
  bool _planning = false;
  List<CommuteProfile> _commutes = [];
  List<TripSummary> _recent = [];
  StreamSubscription<Object>? _incomingSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    final scope = AppScope.of(context);
    scope.notifications.start();
    _incomingSub = scope.notifications.incoming.listen((n) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${n.title}\n${n.body}'), duration: const Duration(seconds: 6)));
    });
    _useCurrentLocationAsOrigin(silent: true);
    _refresh();
  }

  Future<void> _refresh() async {
    final api = AppScope.of(context).api;
    try {
      final results = await Future.wait([api.listCommutes(), api.listTrips(limit: 5)]);
      if (!mounted) return;
      setState(() {
        _commutes = results[0] as List<CommuteProfile>;
        _recent = results[1] as List<TripSummary>;
      });
    } catch (e) {
      _toast(e.toString());
    }
  }

  @override
  void dispose() {
    _incomingSub?.cancel();
    _map.dispose();
    super.dispose();
  }

  void _toast(String msg) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<Place?> _currentPlace() async {
    final scope = AppScope.of(context);
    final pos = await scope.location.current();
    Place place;
    try {
      place = await scope.api.reverseGeocode(pos.latitude, pos.longitude);
    } catch (_) {
      place = Place(lat: pos.latitude, lng: pos.longitude, label: 'Current location');
    }
    return Place(lat: pos.latitude, lng: pos.longitude, label: place.label.isEmpty ? 'Current location' : place.label);
  }

  Future<void> _useCurrentLocationAsOrigin({bool silent = false}) async {
    try {
      final p = await _currentPlace();
      if (!mounted || p == null) return;
      setState(() => _origin ??= p);
      _moveMap(p.latLng);
    } catch (e) {
      if (!silent) _toast(e.toString());
    }
  }

  DateTime? get _targetArrival {
    final t = _arriveBy;
    if (t == null) return null;
    final now = DateTime.now();
    var target = DateTime(now.year, now.month, now.day, t.hour, t.minute);
    if (target.isBefore(now.subtract(const Duration(minutes: 1)))) target = target.add(const Duration(days: 1));
    return target;
  }

  Future<void> _plan({Place? origin, Place? destination, DateTime? targetArrival}) async {
    final o = origin ?? _origin;
    final d = destination ?? _destination;
    if (o == null || d == null) {
      _toast('Choose where you are starting from and where you are going.');
      return;
    }
    setState(() => _planning = true);
    try {
      final plan = await AppScope.of(context).api.planTrip(origin: o, destination: d, targetArrival: targetArrival ?? _targetArrival);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TripResultScreen(plan: plan)));
      _refresh();
    } catch (e) {
      _toast(e.toString());
    } finally {
      if (mounted) setState(() => _planning = false);
    }
  }

  void _planCommute(CommuteProfile c) => _plan(
        origin: Place(lat: c.originLat, lng: c.originLng, label: c.originLabel),
        destination: Place(lat: c.destinationLat, lng: c.destinationLng, label: c.destinationLabel),
        targetArrival: c.nextArrival(DateTime.now()),
      );

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _arriveBy ?? TimeOfDay.fromDateTime(DateTime.now().add(const Duration(hours: 1))));
    if (t != null) setState(() => _arriveBy = t);
  }

  void _moveMap(LatLng target) {
    if (_mapReady) _map.move(target, 13);
  }

  List<Marker> get _markers {
    final me = AppScope.of(context).location.lastKnown;
    return [
      if (me != null) userMarker(LatLng(me.latitude, me.longitude)),
      if (_origin != null) pinMarker(_origin!.latLng, const Color(0xFF1E88E5)),
      if (_destination != null) pinMarker(_destination!.latLng, const Color(0xFFE53935)),
    ];
  }

  Future<void> _onMapLongPress(LatLng p) async {
    final api = AppScope.of(context).api;
    Place place = Place(lat: p.latitude, lng: p.longitude, label: 'Dropped pin');
    try {
      final r = await api.reverseGeocode(p.latitude, p.longitude);
      place = Place(lat: p.latitude, lng: p.longitude, label: r.label);
    } catch (_) {}
    if (mounted) setState(() => _destination = place);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scope = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('Hi ${scope.api.displayName ?? 'there'}'),
        actions: [
          ListenableBuilder(
            listenable: scope.notifications,
            builder: (context, _) => IconButton(
              tooltip: 'Alerts',
              icon: Badge(
                isLabelVisible: scope.notifications.unreadCount > 0,
                label: Text('${scope.notifications.unreadCount}'),
                child: const Icon(Icons.notifications_outlined),
              ),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationSettingsScreen())),
            ),
          ),
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () async {
              await Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
              _refresh();
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'assistant',
        onPressed: () => showModalBottomSheet(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => const AssistantSheet()),
        icon: const Icon(Icons.assistant),
        label: const Text('Ask Roshan'),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 96),
          children: [
            SizedBox(
              height: 220,
              child: Stack(
                children: [
                  AppMap(
                    controller: _map,
                    initialCenter: _origin?.latLng ?? _dubai,
                    initialZoom: 11,
                    markers: _markers,
                    onLongPress: _onMapLongPress,
                    onReady: () => _mapReady = true,
                  ),
                  Positioned(
                    right: 10,
                    top: 10,
                    child: IconButton.filledTonal(
                      tooltip: 'My location',
                      icon: const Icon(Icons.my_location),
                      onPressed: () async {
                        try {
                          final p = await AppScope.of(context).location.current();
                          if (!mounted) return;
                          setState(() {});
                          _moveMap(LatLng(p.latitude, p.longitude));
                        } catch (e) {
                          _toast(e.toString());
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PlaceSearchField(
                    hint: 'Starting from',
                    icon: Icons.trip_origin,
                    value: _origin,
                    onSelected: (p) => setState(() => _origin = p),
                    onUseCurrentLocation: _currentPlace,
                  ),
                  const SizedBox(height: 10),
                  PlaceSearchField(
                    hint: 'Where to? (or long-press the map)',
                    icon: Icons.flag_outlined,
                    value: _destination,
                    onSelected: (p) {
                      setState(() => _destination = p);
                      _moveMap(p.latLng);
                    },
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _pickTime,
                          icon: const Icon(Icons.access_time),
                          label: Text(_arriveBy == null ? 'Arrive by... (optional)' : 'Arrive by ${_arriveBy!.format(context)}'),
                        ),
                      ),
                      if (_arriveBy != null) IconButton(tooltip: 'Leave now instead', onPressed: () => setState(() => _arriveBy = null), icon: const Icon(Icons.clear)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56), textStyle: theme.textTheme.titleMedium),
                    onPressed: _planning ? null : () => _plan(),
                    icon: _planning ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.alarm),
                    label: Text(_arriveBy == null ? 'How long will it take?' : 'Am I late?'),
                  ),
                ],
              ),
            ),
            if (_commutes.isNotEmpty) ...[
              _SectionTitle('My commutes'),
              SizedBox(
                height: 92,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    for (final c in _commutes.where((c) => c.active))
                      SizedBox(
                        width: 220,
                        child: Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: _planning ? null : () => _planCommute(c),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.name, style: theme.textTheme.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                                  Text('Arrive ${c.targetArrivalTime} · ${formatDays(c.daysOfWeek)}', style: theme.textTheme.bodySmall),
                                  const Spacer(),
                                  Text(c.lastEtaMinutes != null ? 'Last ETA ${formatMinutes(c.lastEtaMinutes!)}' : 'Tap to check',
                                      style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.primary)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ] else
              Padding(
                padding: const EdgeInsets.all(16),
                child: Card(
                  child: ListTile(
                    leading: const Icon(Icons.notifications_active_outlined),
                    title: const Text('Get "time to leave" alerts'),
                    subtitle: const Text('Save your daily commute and I will warn you when traffic gets worse.'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen(openCommuteEditor: true)));
                      _refresh();
                    },
                  ),
                ),
              ),
            if (_recent.isNotEmpty) ...[
              _SectionTitle('Recent trips'),
              for (final t in _recent)
                ListTile(
                  leading: Icon(_verdictIcon(t.verdict), color: _verdictColor(t.verdict)),
                  title: Text('${t.originLabel} → ${t.destinationLabel}', maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${formatClock(t.createdAt)} · ${t.status.toLowerCase().replaceAll('_', ' ')}'),
                  trailing: const Icon(Icons.replay),
                  onTap: () => _plan(origin: t.origin, destination: t.destination, targetArrival: null),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

IconData _verdictIcon(Verdict v) => switch (v) {
      Verdict.late => Icons.running_with_errors,
      Verdict.leaveNow => Icons.directions_run,
      Verdict.onTime => Icons.check_circle_outline,
      Verdict.noTarget => Icons.route_outlined,
    };

Color _verdictColor(Verdict v) => switch (v) {
      Verdict.late => Colors.red,
      Verdict.leaveNow => Colors.orange,
      Verdict.onTime => Colors.green,
      Verdict.noTarget => Colors.blueGrey,
    };

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.fromLTRB(16, 20, 16, 8), child: Text(text, style: Theme.of(context).textTheme.titleMedium));
}
