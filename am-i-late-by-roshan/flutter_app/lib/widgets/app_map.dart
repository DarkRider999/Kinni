import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// OpenStreetMap tiles: free, no API key or billing. Override at build time to
/// use another tile provider: --dart-define=MAP_TILE_URL=https://.../{z}/{x}/{y}.png
const mapTileUrl = String.fromEnvironment('MAP_TILE_URL', defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');

/// The app's map: OSM tiles, route polylines, markers and the required attribution.
class AppMap extends StatelessWidget {
  final MapController? controller;
  final LatLng initialCenter;
  final double initialZoom;

  /// When given (2+ points), the map opens zoomed to fit them.
  final List<LatLng>? fitPoints;
  final List<Polyline> polylines;
  final List<Marker> markers;
  final void Function(LatLng point)? onLongPress;
  final VoidCallback? onUserGesture;
  final VoidCallback? onReady;

  const AppMap({
    super.key,
    this.controller,
    required this.initialCenter,
    this.initialZoom = 12,
    this.fitPoints,
    this.polylines = const [],
    this.markers = const [],
    this.onLongPress,
    this.onUserGesture,
    this.onReady,
  });

  @override
  Widget build(BuildContext context) {
    final fit = fitPoints;
    return FlutterMap(
      mapController: controller,
      options: MapOptions(
        initialCenter: initialCenter,
        initialZoom: initialZoom,
        initialCameraFit: fit != null && fit.length > 1
            ? CameraFit.bounds(bounds: LatLngBounds.fromPoints(fit), padding: const EdgeInsets.all(40))
            : null,
        interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
        onLongPress: onLongPress == null ? null : (_, point) => onLongPress!(point),
        onPositionChanged: onUserGesture == null ? null : (_, hasGesture) => hasGesture ? onUserGesture!() : null,
        onMapReady: onReady,
      ),
      children: [
        TileLayer(urlTemplate: mapTileUrl, userAgentPackageName: 'com.roshan.am_i_late', maxNativeZoom: 19),
        if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
        if (markers.isNotEmpty) MarkerLayer(markers: markers),
        const SimpleAttributionWidget(source: Text('OpenStreetMap contributors')),
      ],
    );
  }
}

/// A map pin whose tip sits on [point].
Marker pinMarker(LatLng point, Color color) => Marker(
      point: point,
      width: 40,
      height: 40,
      alignment: Alignment.topCenter,
      child: Icon(Icons.location_on, color: color, size: 40, shadows: const [Shadow(blurRadius: 4, color: Colors.black38)]),
    );

/// "You are here": a blue dot, or an arrow pointing along [headingDegrees] while driving.
Marker userMarker(LatLng point, {double? headingDegrees}) => Marker(
      point: point,
      width: 44,
      height: 44,
      child: Container(
        decoration: const BoxDecoration(color: Color(0x331E88E5), shape: BoxShape.circle),
        alignment: Alignment.center,
        child: headingDegrees == null
            ? Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: const Color(0xFF1E88E5),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
              )
            : Transform.rotate(
                angle: headingDegrees * math.pi / 180,
                child: const Icon(Icons.navigation, color: Color(0xFF1E88E5), size: 30, shadows: [Shadow(blurRadius: 3, color: Colors.white)]),
              ),
      ),
    );
