import 'route_option.dart';

class DriverProfile {
  final String vehicleType;
  final bool hasSalikTag;
  final bool hasDarbAccount;
  final RouteType preferredRouteType;
  final int speedAlertThresholdKmh;
  final bool fatigueMonitoringEnabled;
  final int maxContinuousDriveMinutes;
  final int bufferMinutes;

  const DriverProfile({
    this.vehicleType = 'car',
    this.hasSalikTag = true,
    this.hasDarbAccount = false,
    this.preferredRouteType = RouteType.fastest,
    this.speedAlertThresholdKmh = 5,
    this.fatigueMonitoringEnabled = true,
    this.maxContinuousDriveMinutes = 120,
    this.bufferMinutes = 5,
  });

  factory DriverProfile.fromJson(Map<String, dynamic> j) => DriverProfile(
        vehicleType: j['vehicle_type'] as String? ?? 'car',
        hasSalikTag: j['has_salik_tag'] as bool? ?? true,
        hasDarbAccount: j['has_darb_account'] as bool? ?? false,
        preferredRouteType: RouteTypeX.parse(j['preferred_route_type'] as String? ?? 'FASTEST'),
        speedAlertThresholdKmh: (j['speed_alert_threshold_kmh'] as num? ?? 5).toInt(),
        fatigueMonitoringEnabled: j['fatigue_monitoring_enabled'] as bool? ?? true,
        maxContinuousDriveMinutes: (j['max_continuous_drive_minutes'] as num? ?? 120).toInt(),
        bufferMinutes: (j['buffer_minutes'] as num? ?? 5).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'vehicle_type': vehicleType,
        'has_salik_tag': hasSalikTag,
        'has_darb_account': hasDarbAccount,
        'preferred_route_type': preferredRouteType.apiName,
        'speed_alert_threshold_kmh': speedAlertThresholdKmh,
        'fatigue_monitoring_enabled': fatigueMonitoringEnabled,
        'max_continuous_drive_minutes': maxContinuousDriveMinutes,
        'buffer_minutes': bufferMinutes,
      };

  DriverProfile copyWith({
    String? vehicleType,
    bool? hasSalikTag,
    bool? hasDarbAccount,
    RouteType? preferredRouteType,
    int? speedAlertThresholdKmh,
    bool? fatigueMonitoringEnabled,
    int? maxContinuousDriveMinutes,
    int? bufferMinutes,
  }) =>
      DriverProfile(
        vehicleType: vehicleType ?? this.vehicleType,
        hasSalikTag: hasSalikTag ?? this.hasSalikTag,
        hasDarbAccount: hasDarbAccount ?? this.hasDarbAccount,
        preferredRouteType: preferredRouteType ?? this.preferredRouteType,
        speedAlertThresholdKmh: speedAlertThresholdKmh ?? this.speedAlertThresholdKmh,
        fatigueMonitoringEnabled: fatigueMonitoringEnabled ?? this.fatigueMonitoringEnabled,
        maxContinuousDriveMinutes: maxContinuousDriveMinutes ?? this.maxContinuousDriveMinutes,
        bufferMinutes: bufferMinutes ?? this.bufferMinutes,
      );
}

class CommuteProfile {
  final String? id;
  final String name;
  final double originLat;
  final double originLng;
  final String originLabel;
  final double destinationLat;
  final double destinationLng;
  final String destinationLabel;
  final String targetArrivalTime; // HH:MM, UAE time
  final List<int> daysOfWeek; // ISO 1=Mon..7=Sun
  final bool active;
  final double? lastEtaMinutes;

  const CommuteProfile({
    this.id,
    required this.name,
    required this.originLat,
    required this.originLng,
    required this.originLabel,
    required this.destinationLat,
    required this.destinationLng,
    required this.destinationLabel,
    required this.targetArrivalTime,
    this.daysOfWeek = const [1, 2, 3, 4, 5],
    this.active = true,
    this.lastEtaMinutes,
  });

  factory CommuteProfile.fromJson(Map<String, dynamic> j) {
    final o = j['origin'] as Map<String, dynamic>;
    final d = j['destination'] as Map<String, dynamic>;
    return CommuteProfile(
      id: j['id'] as String?,
      name: j['name'] as String? ?? 'Commute',
      originLat: (o['lat'] as num).toDouble(),
      originLng: (o['lng'] as num).toDouble(),
      originLabel: j['origin_label'] as String? ?? 'Start',
      destinationLat: (d['lat'] as num).toDouble(),
      destinationLng: (d['lng'] as num).toDouble(),
      destinationLabel: j['destination_label'] as String? ?? 'Destination',
      targetArrivalTime: j['target_arrival_time'] as String? ?? '08:30',
      daysOfWeek: ((j['days_of_week'] as List?) ?? [1, 2, 3, 4, 5]).map((e) => (e as num).toInt()).toList(),
      active: j['active'] as bool? ?? true,
      lastEtaMinutes: (j['last_eta_minutes'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'origin': {'lat': originLat, 'lng': originLng},
        'originLabel': originLabel,
        'destination': {'lat': destinationLat, 'lng': destinationLng},
        'destinationLabel': destinationLabel,
        'targetArrivalTime': targetArrivalTime,
        'daysOfWeek': daysOfWeek,
        'active': active,
      };

  /// Next arrival time for this commute, in the device's local time (assumed UAE).
  DateTime nextArrival(DateTime now) {
    final parts = targetArrivalTime.split(':').map(int.parse).toList();
    for (var offset = 0; offset < 8; offset++) {
      final day = DateTime(now.year, now.month, now.day + offset, parts[0], parts[1]);
      if (daysOfWeek.contains(day.weekday) && day.isAfter(now)) return day;
    }
    return DateTime(now.year, now.month, now.day + 1, parts[0], parts[1]);
  }
}
