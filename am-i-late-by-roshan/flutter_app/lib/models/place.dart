import 'package:latlong2/latlong.dart';

class Place {
  final double lat;
  final double lng;
  final String label;
  final String address;

  const Place({required this.lat, required this.lng, required this.label, this.address = ''});

  LatLng get latLng => LatLng(lat, lng);

  factory Place.fromJson(Map<String, dynamic> j) => Place(
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        label: (j['label'] as String?) ?? '',
        address: (j['address'] as String?) ?? '',
      );

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng, 'label': label};

  Map<String, dynamic> toLatLngJson() => {'lat': lat, 'lng': lng};
}
