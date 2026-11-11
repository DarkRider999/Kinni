import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../core/widgets/common.dart';

/// Map picker for a client's location (FR MAP-01). Tap the map or drag the
/// marker; "Use current location" centres on the GPS fix. Pops a [LatLng].
class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({super.key, this.initial});

  /// Starting point; defaults to central Dubai.
  final LatLng? initial;

  static const dubai = LatLng(25.2048, 55.2708);

  /// Pushes the picker and returns the chosen point (null when cancelled).
  static Future<LatLng?> pick(BuildContext context, {LatLng? initial}) =>
      Navigator.of(context).push<LatLng>(MaterialPageRoute(builder: (_) => LocationPickerScreen(initial: initial)));

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  GoogleMapController? _map;
  late LatLng _point = widget.initial ?? LocationPickerScreen.dubai;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    // With no saved point, try to start on the user's own position.
    if (widget.initial == null) WidgetsBinding.instance.addPostFrameCallback((_) => _useCurrent(silent: true));
  }

  @override
  void dispose() {
    _map?.dispose();
    super.dispose();
  }

  void _set(LatLng p, {bool move = false}) {
    setState(() => _point = p);
    if (move) _map?.animateCamera(CameraUpdate.newLatLngZoom(p, 16));
  }

  /// Reads the GPS fix after checking the location service and permission.
  Future<void> _useCurrent({bool silent = false}) async {
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        if (!silent && mounted) showSnack(context, 'Turn on location services to use GPS', error: true);
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (!silent && mounted) showSnack(context, 'Location permission denied', error: true);
        return;
      }
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      if (mounted) _set(LatLng(pos.latitude, pos.longitude), move: true);
    } catch (e) {
      if (!silent && mounted) showSnack(context, 'Could not get your location', error: true);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Pick location'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, _point), child: const Text('Use this')),
          ],
        ),
        body: Stack(
          children: [
            GoogleMap(
              initialCameraPosition: CameraPosition(target: _point, zoom: widget.initial == null ? 11 : 16),
              onMapCreated: (c) => _map = c,
              onTap: _set,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              markers: {
                Marker(
                  markerId: const MarkerId('client'),
                  position: _point,
                  draggable: true,
                  onDragEnd: _set,
                ),
              },
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          'Tap the map or drag the pin.\n${_point.latitude.toStringAsFixed(5)}, ${_point.longitude.toStringAsFixed(5)}',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.tonalIcon(
                            onPressed: _locating ? null : _useCurrent,
                            icon: _locating
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.my_location_rounded),
                            label: const Text('Current location'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () => Navigator.pop(context, _point),
                            icon: const Icon(Icons.check_rounded),
                            label: const Text('Use this'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}
