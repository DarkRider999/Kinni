import 'place.dart';
import 'route_option.dart';

enum Verdict { onTime, leaveNow, late, noTarget }

Verdict parseVerdict(String? s) => switch (s) {
      'ON_TIME' => Verdict.onTime,
      'LEAVE_NOW' => Verdict.leaveNow,
      'LATE' => Verdict.late,
      _ => Verdict.noTarget,
    };

class TripEvent {
  final String name;
  final String venue;
  final DateTime startsAt;
  const TripEvent(this.name, this.venue, this.startsAt);
}

/// Response of POST /trips/plan.
class TripPlan {
  final String? tripId;
  final Place origin;
  final Place destination;
  final Verdict verdict;
  final int minutesLate;
  final int? minutesUntilDeparture;
  final DateTime? targetArrival;
  final DateTime recommendedDeparture;
  final DateTime expectedArrival;
  final String explanation;
  final List<RouteOption> routes;
  final String weather;
  final String weatherCondition;
  final List<TripEvent> events;
  final double disruptionScore;
  final String congestionLevel;
  final String provider;
  final String aiSource;
  final RouteType preferredRouteType;

  const TripPlan({
    required this.tripId,
    required this.origin,
    required this.destination,
    required this.verdict,
    required this.minutesLate,
    required this.minutesUntilDeparture,
    required this.targetArrival,
    required this.recommendedDeparture,
    required this.expectedArrival,
    required this.explanation,
    required this.routes,
    required this.weather,
    required this.weatherCondition,
    required this.events,
    required this.disruptionScore,
    required this.congestionLevel,
    required this.provider,
    required this.aiSource,
    required this.preferredRouteType,
  });

  RouteOption route(RouteType t) => routes.firstWhere((r) => r.routeType == t, orElse: () => routes.first);

  factory TripPlan.fromJson(Map<String, dynamic> j) {
    final ctx = j['context'] as Map<String, dynamic>? ?? {};
    final weather = ctx['weather'] as Map<String, dynamic>? ?? {};
    final disruption = ctx['disruption'] as Map<String, dynamic>? ?? {};
    return TripPlan(
      tripId: j['tripId'] as String?,
      origin: Place.fromJson(j['origin'] as Map<String, dynamic>),
      destination: Place.fromJson(j['destination'] as Map<String, dynamic>),
      verdict: parseVerdict(j['verdict'] as String?),
      minutesLate: (j['minutesLate'] as num? ?? 0).round(),
      minutesUntilDeparture: (j['minutesUntilDeparture'] as num?)?.round(),
      targetArrival: j['targetArrival'] == null ? null : DateTime.parse(j['targetArrival'] as String),
      recommendedDeparture: DateTime.parse(j['recommendedDeparture'] as String),
      expectedArrival: DateTime.parse(j['expectedArrival'] as String),
      explanation: j['explanation'] as String? ?? '',
      routes: ((j['routes'] as List?) ?? []).map((e) => RouteOption.fromJson(e as Map<String, dynamic>)).toList(),
      weather: weather['description'] as String? ?? '',
      weatherCondition: weather['condition'] as String? ?? 'CLEAR',
      events: ((ctx['events'] as List?) ?? [])
          .map((e) => e as Map<String, dynamic>)
          .map((e) => TripEvent(e['name'] as String, e['venue'] as String, DateTime.parse(e['startsAt'] as String)))
          .toList(),
      disruptionScore: (disruption['score'] as num? ?? 0).toDouble(),
      congestionLevel: ctx['congestionLevel'] as String? ?? 'LOW',
      provider: ctx['provider'] as String? ?? '',
      aiSource: ctx['aiSource'] as String? ?? '',
      preferredRouteType: RouteTypeX.parse(j['preferredRouteType'] as String? ?? 'FASTEST'),
    );
  }
}

/// Row of GET /trips.
class TripSummary {
  final String id;
  final String originLabel;
  final String destinationLabel;
  final Verdict verdict;
  final String status;
  final DateTime createdAt;
  final DateTime? targetArrival;
  final Place origin;
  final Place destination;

  const TripSummary({
    required this.id,
    required this.originLabel,
    required this.destinationLabel,
    required this.verdict,
    required this.status,
    required this.createdAt,
    required this.targetArrival,
    required this.origin,
    required this.destination,
  });

  factory TripSummary.fromJson(Map<String, dynamic> j) {
    final o = j['origin'] as Map<String, dynamic>;
    final d = j['destination'] as Map<String, dynamic>;
    final originLabel = j['origin_label'] as String? ?? 'Start';
    final destLabel = j['destination_label'] as String? ?? 'Destination';
    return TripSummary(
      id: j['id'] as String,
      originLabel: originLabel,
      destinationLabel: destLabel,
      verdict: parseVerdict(j['verdict'] as String?),
      status: j['status'] as String? ?? 'PLANNED',
      createdAt: DateTime.parse(j['created_at'] as String),
      targetArrival: j['target_arrival'] == null ? null : DateTime.parse(j['target_arrival'] as String),
      origin: Place(lat: (o['lat'] as num).toDouble(), lng: (o['lng'] as num).toDouble(), label: originLabel),
      destination: Place(lat: (d['lat'] as num).toDouble(), lng: (d['lng'] as num).toDouble(), label: destLabel),
    );
  }
}
