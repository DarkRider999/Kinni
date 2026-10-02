class NotificationPreference {
  final bool earlyWarningEnabled;
  final bool leaveNowEnabled;
  final bool speedAlertsEnabled;
  final bool fatigueAlertsEnabled;
  final int etaIncreaseThresholdMinutes;
  final String? quietHoursStart; // HH:MM
  final String? quietHoursEnd;

  const NotificationPreference({
    this.earlyWarningEnabled = true,
    this.leaveNowEnabled = true,
    this.speedAlertsEnabled = true,
    this.fatigueAlertsEnabled = true,
    this.etaIncreaseThresholdMinutes = 10,
    this.quietHoursStart,
    this.quietHoursEnd,
  });

  static String? _hhmm(Object? v) => v == null ? null : (v as String).substring(0, 5);

  factory NotificationPreference.fromJson(Map<String, dynamic> j) => NotificationPreference(
        earlyWarningEnabled: j['early_warning_enabled'] as bool? ?? true,
        leaveNowEnabled: j['leave_now_enabled'] as bool? ?? true,
        speedAlertsEnabled: j['speed_alerts_enabled'] as bool? ?? true,
        fatigueAlertsEnabled: j['fatigue_alerts_enabled'] as bool? ?? true,
        etaIncreaseThresholdMinutes: (j['eta_increase_threshold_minutes'] as num? ?? 10).toInt(),
        quietHoursStart: _hhmm(j['quiet_hours_start']),
        quietHoursEnd: _hhmm(j['quiet_hours_end']),
      );

  Map<String, dynamic> toJson() => {
        'early_warning_enabled': earlyWarningEnabled,
        'leave_now_enabled': leaveNowEnabled,
        'speed_alerts_enabled': speedAlertsEnabled,
        'fatigue_alerts_enabled': fatigueAlertsEnabled,
        'eta_increase_threshold_minutes': etaIncreaseThresholdMinutes,
        'quiet_hours_start': quietHoursStart,
        'quiet_hours_end': quietHoursEnd,
      };

  NotificationPreference copyWith({
    bool? earlyWarningEnabled,
    bool? leaveNowEnabled,
    bool? speedAlertsEnabled,
    bool? fatigueAlertsEnabled,
    int? etaIncreaseThresholdMinutes,
    String? Function()? quietHoursStart,
    String? Function()? quietHoursEnd,
  }) =>
      NotificationPreference(
        earlyWarningEnabled: earlyWarningEnabled ?? this.earlyWarningEnabled,
        leaveNowEnabled: leaveNowEnabled ?? this.leaveNowEnabled,
        speedAlertsEnabled: speedAlertsEnabled ?? this.speedAlertsEnabled,
        fatigueAlertsEnabled: fatigueAlertsEnabled ?? this.fatigueAlertsEnabled,
        etaIncreaseThresholdMinutes: etaIncreaseThresholdMinutes ?? this.etaIncreaseThresholdMinutes,
        quietHoursStart: quietHoursStart != null ? quietHoursStart() : this.quietHoursStart,
        quietHoursEnd: quietHoursEnd != null ? quietHoursEnd() : this.quietHoursEnd,
      );
}

/// An item from the in-app notification inbox.
class AppNotification {
  final String id;
  final String kind;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;

  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.read,
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'] as String,
        kind: j['kind'] as String? ?? 'SYSTEM',
        title: j['title'] as String? ?? '',
        body: j['body'] as String? ?? '',
        createdAt: DateTime.parse(j['created_at'] as String),
        read: j['read_at'] != null,
      );
}
