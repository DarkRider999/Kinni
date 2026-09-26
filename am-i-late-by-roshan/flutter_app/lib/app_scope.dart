import 'package:flutter/widgets.dart';

import 'services/api_client.dart';
import 'services/location_service.dart';
import 'services/notification_service.dart';
import 'services/sensor_service.dart';

/// Makes the app-wide services available to every screen.
class AppScope extends InheritedWidget {
  final ApiClient api;
  final NotificationService notifications;
  final LocationService location;
  final SensorService sensors;

  const AppScope({
    super.key,
    required this.api,
    required this.notifications,
    required this.location,
    required this.sensors,
    required super.child,
  });

  static AppScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope not found in widget tree');
    return scope!;
  }

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      api != oldWidget.api || notifications != oldWidget.notifications || location != oldWidget.location || sensors != oldWidget.sensors;
}
