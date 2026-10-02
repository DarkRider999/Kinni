import 'dart:async';

import 'package:geolocator/geolocator.dart';

class LocationUnavailable implements Exception {
  final String message;
  const LocationUnavailable(this.message);
  @override
  String toString() => message;
}

/// Thin wrapper over geolocator with permission handling.
class LocationService {
  Position? lastKnown;

  Future<void> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationUnavailable('Location services are turned off. Turn on GPS to use your current location.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) throw const LocationUnavailable('Location permission was denied.');
    if (permission == LocationPermission.deniedForever) {
      throw const LocationUnavailable('Location permission is blocked. Enable it for Am I Late? in system settings.');
    }
  }

  Future<Position> current() async {
    await ensurePermission();
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
    );
    lastKnown = pos;
    return pos;
  }

  /// High-accuracy stream for navigation (updates every ~5 m).
  Stream<Position> navigationStream() => Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.bestForNavigation, distanceFilter: 5),
      ).map((p) => lastKnown = p);
}
