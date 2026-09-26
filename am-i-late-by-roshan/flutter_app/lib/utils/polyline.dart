import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Decodes a Google/OSRM encoded polyline (precision 5).
List<LatLng> decodePolyline(String encoded) {
  final points = <LatLng>[];
  var index = 0;
  var lat = 0;
  var lng = 0;
  while (index < encoded.length) {
    for (var i = 0; i < 2; i++) {
      var result = 0;
      var shift = 0;
      int byte;
      do {
        byte = encoded.codeUnitAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      final delta = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
      if (i == 0) {
        lat += delta;
      } else {
        lng += delta;
      }
    }
    points.add(LatLng(lat / 1e5, lng / 1e5));
  }
  return points;
}

/// Bounds covering all points (for fitting the camera).
LatLngBounds boundsOf(Iterable<LatLng> points) => LatLngBounds.fromPoints(points.toList());
