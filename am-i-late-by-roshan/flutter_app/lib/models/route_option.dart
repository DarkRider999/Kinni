import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../utils/polyline.dart';

enum RouteType { fastest, cheapest, lowStress }

extension RouteTypeX on RouteType {
  String get apiName => const {RouteType.fastest: 'FASTEST', RouteType.cheapest: 'CHEAPEST', RouteType.lowStress: 'LOW_STRESS'}[this]!;

  String get label => const {RouteType.fastest: 'Fastest', RouteType.cheapest: 'Cheapest', RouteType.lowStress: 'Low stress'}[this]!;

  static RouteType parse(String s) => RouteType.values.firstWhere((t) => t.apiName == s, orElse: () => RouteType.fastest);
}

class Lane {
  final List<String> indications;
  final bool valid;
  const Lane(this.indications, this.valid);

  factory Lane.fromJson(Map<String, dynamic> j) =>
      Lane((j['indications'] as List).map((e) => e.toString()).toList(), j['valid'] as bool? ?? false);
}

class RouteStep {
  final String instruction;
  final String maneuver;
  final String? modifier;
  final String roadName;
  final double distanceM;
  final double durationS;
  final LatLng location;
  final List<Lane> lanes;
  final String? laneGuidance;

  const RouteStep({
    required this.instruction,
    required this.maneuver,
    required this.modifier,
    required this.roadName,
    required this.distanceM,
    required this.durationS,
    required this.location,
    required this.lanes,
    required this.laneGuidance,
  });

  factory RouteStep.fromJson(Map<String, dynamic> j) {
    final loc = j['location'] as Map<String, dynamic>;
    return RouteStep(
      instruction: j['instruction'] as String? ?? '',
      maneuver: j['maneuver'] as String? ?? '',
      modifier: j['modifier'] as String?,
      roadName: j['roadName'] as String? ?? '',
      distanceM: (j['distanceM'] as num? ?? 0).toDouble(),
      durationS: (j['durationS'] as num? ?? 0).toDouble(),
      location: LatLng((loc['lat'] as num).toDouble(), (loc['lng'] as num).toDouble()),
      lanes: ((j['lanes'] as List?) ?? []).map((e) => Lane.fromJson(e as Map<String, dynamic>)).toList(),
      laneGuidance: j['laneGuidance'] as String?,
    );
  }
}

class TollCrossing {
  final String name;
  final String system;
  final double feeAed;
  const TollCrossing(this.name, this.system, this.feeAed);

  factory TollCrossing.fromJson(Map<String, dynamic> j) =>
      TollCrossing(j['name'] as String, j['system'] as String, (j['feeAed'] as num).toDouble());
}

class RouteOption {
  final RouteType routeType;
  final String variantKey;
  final String summary;
  final double distanceKm;
  final double durationMinutes;
  final double durationP10Minutes;
  final double durationP90Minutes;
  final double etaConfidence;
  final double tollCostAed;
  final List<TollCrossing> tollGates;
  final double stressScore;
  final String congestionLevel;
  final List<String> schoolZones;
  final String polyline;
  final List<RouteStep> steps;

  RouteOption({
    required this.routeType,
    required this.variantKey,
    required this.summary,
    required this.distanceKm,
    required this.durationMinutes,
    required this.durationP10Minutes,
    required this.durationP90Minutes,
    required this.etaConfidence,
    required this.tollCostAed,
    required this.tollGates,
    required this.stressScore,
    required this.congestionLevel,
    required this.schoolZones,
    required this.polyline,
    required this.steps,
  });

  late final List<LatLng> points = decodePolyline(polyline);

  factory RouteOption.fromJson(Map<String, dynamic> j) {
    double d(String k) => (j[k] as num? ?? 0).toDouble();
    return RouteOption(
      routeType: RouteTypeX.parse(j['routeType'] as String),
      variantKey: j['variantKey'] as String? ?? '',
      summary: j['summary'] as String? ?? '',
      distanceKm: d('distanceKm'),
      durationMinutes: d('durationMinutes'),
      durationP10Minutes: d('durationP10Minutes'),
      durationP90Minutes: d('durationP90Minutes'),
      etaConfidence: d('etaConfidence'),
      tollCostAed: d('tollCostAed'),
      tollGates: ((j['tollGates'] as List?) ?? []).map((e) => TollCrossing.fromJson(e as Map<String, dynamic>)).toList(),
      stressScore: d('stressScore'),
      congestionLevel: j['congestionLevel'] as String? ?? 'LOW',
      schoolZones: ((j['schoolZones'] as List?) ?? []).map((e) => (e as Map<String, dynamic>)['name'] as String).toList(),
      polyline: j['polyline'] as String? ?? '',
      steps: ((j['steps'] as List?) ?? []).map((e) => RouteStep.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
