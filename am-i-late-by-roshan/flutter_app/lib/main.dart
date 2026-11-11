import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'services/location_service.dart';
import 'services/notification_service.dart';
import 'services/sensor_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  await api.init();
  final notifications = NotificationService(api);
  try {
    await notifications.init();
  } catch (e) {
    debugPrint('Notifications unavailable: $e');
  }
  runApp(AmILateApp(api: api, notifications: notifications, location: LocationService(), sensors: SensorService()));
}

class AmILateApp extends StatelessWidget {
  final ApiClient api;
  final NotificationService notifications;
  final LocationService location;
  final SensorService sensors;

  const AmILateApp({super.key, required this.api, required this.notifications, required this.location, required this.sensors});

  static const seed = Color(0xFF00897B); // UAE-inspired teal

  @override
  Widget build(BuildContext context) {
    return AppScope(
      api: api,
      notifications: notifications,
      location: location,
      sensors: sensors,
      child: MaterialApp(
        title: 'Am I Late? by Roshan',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: seed, useMaterial3: true, brightness: Brightness.light),
        darkTheme: ThemeData(colorSchemeSeed: seed, useMaterial3: true, brightness: Brightness.dark),
        home: ListenableBuilder(
          listenable: api,
          builder: (context, _) => api.isLoggedIn ? const HomeScreen() : const LoginScreen(),
        ),
      ),
    );
  }
}
