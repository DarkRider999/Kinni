import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

const _earthRadiusM = 6371008.8;
double _rad(double deg) => deg * math.pi / 180;

double distanceM(LatLng a, LatLng b) {
  final dLat = _rad(b.latitude - a.latitude);
  final dLng = _rad(b.longitude - a.longitude);
  final h = math.pow(math.sin(dLat / 2), 2) +
      math.cos(_rad(a.latitude)) * math.cos(_rad(b.latitude)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * _earthRadiusM * math.asin(math.min(1, math.sqrt(h)));
}

/// Distance from [p] to segment a-b in metres (local flat projection).
double distanceToSegmentM(LatLng p, LatLng a, LatLng b) {
  final kx = 111320 * math.cos(_rad(p.latitude));
  const ky = 110574.0;
  final ax = (a.longitude - p.longitude) * kx, ay = (a.latitude - p.latitude) * ky;
  final bx = (b.longitude - p.longitude) * kx, by = (b.latitude - p.latitude) * ky;
  final dx = bx - ax, dy = by - ay;
  final lenSq = dx * dx + dy * dy;
  var t = lenSq == 0 ? 0.0 : -(ax * dx + ay * dy) / lenSq;
  t = t.clamp(0.0, 1.0);
  final cx = ax + t * dx, cy = ay + t * dy;
  return math.sqrt(cx * cx + cy * cy);
}

/// Shortest distance from [p] to the polyline [path], in metres.
double distanceToPathM(LatLng p, List<LatLng> path) {
  if (path.isEmpty) return double.infinity;
  if (path.length == 1) return distanceM(p, path.first);
  var best = double.infinity;
  for (var i = 1; i < path.length; i++) {
    final d = distanceToSegmentM(p, path[i - 1], path[i]);
    if (d < best) best = d;
  }
  return best;
}
