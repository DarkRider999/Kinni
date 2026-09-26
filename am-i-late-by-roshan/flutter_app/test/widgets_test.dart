import 'dart:convert';

import 'package:am_i_late/app_scope.dart';
import 'package:am_i_late/models/route_option.dart';
import 'package:am_i_late/models/trip.dart';
import 'package:am_i_late/screens/trip_result_screen.dart';
import 'package:am_i_late/screens/login_screen.dart';
import 'package:am_i_late/services/api_client.dart';
import 'package:am_i_late/services/location_service.dart';
import 'package:am_i_late/services/notification_service.dart';
import 'package:am_i_late/services/sensor_service.dart';
import 'package:am_i_late/widgets/eta_confidence_widget.dart';
import 'package:am_i_late/widgets/route_card.dart';
import 'package:am_i_late/widgets/speed_indicator_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';

Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('RouteCard shows time, tolls and the shared-road note', (tester) async {
    final route = RouteOption.fromJson(sampleRoute('CHEAPEST', 'r0', tolls: 6));
    var tapped = false;
    await tester.pumpWidget(wrap(RouteCard(route: route, selected: true, preferred: true, sameAs: 'fastest', onTap: () => tapped = true)));
    expect(find.text('Cheapest'), findsOneWidget);
    expect(find.text('28 min'), findsOneWidget);
    expect(find.text('AED 6'), findsOneWidget);
    expect(find.text('Your pick'), findsOneWidget);
    expect(find.textContaining('same road as fastest'), findsOneWidget);
    expect(find.textContaining('Al Garhoud Bridge (Salik AED 6)'), findsOneWidget);
    await tester.tap(find.byType(RouteCard));
    expect(tapped, isTrue);
  });

  testWidgets('EtaConfidenceWidget shows range and confidence', (tester) async {
    await tester.pumpWidget(wrap(const EtaConfidenceWidget(etaMinutes: 30, p10Minutes: 26, p90Minutes: 41, confidence: 0.64)));
    expect(find.text('30 min'), findsOneWidget);
    expect(find.text('(26-41 min)'), findsOneWidget);
    expect(find.text('Medium confidence'), findsOneWidget);
    expect(find.text('Confidence 64%'), findsOneWidget);
  });

  testWidgets('SpeedIndicatorWidget flags speeding', (tester) async {
    const over = SpeedIndicatorWidget(speedKmh: 131, limitKmh: 120, toleranceKmh: 5);
    expect(over.isOver, isTrue);
    expect(const SpeedIndicatorWidget(speedKmh: 122, limitKmh: 120).isNear, isTrue);
    expect(const SpeedIndicatorWidget(speedKmh: 100, limitKmh: null).isOver, isFalse);
    await tester.pumpWidget(wrap(const Center(child: over)));
    expect(find.text('131'), findsOneWidget);
    expect(find.text('120'), findsOneWidget);
  });

  testWidgets('LoginScreen signs in against the API', (tester) async {
    SharedPreferences.setMockInitialValues({});
    late http.Request sent;
    final api = ApiClient(
      httpClient: MockClient((req) async {
        sent = req;
        return http.Response(
          jsonEncode({
            'token': 'jwt-token',
            'user': {'id': 'u1', 'email': 'roshan@example.com', 'display_name': 'Roshan'},
          }),
          200,
        );
      }),
    );
    await api.init();
    await tester.pumpWidget(AppScope(
      api: api,
      notifications: NotificationService(api),
      location: LocationService(),
      sensors: SensorService(),
      child: const MaterialApp(home: LoginScreen()),
    ));

    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.text('Enter a valid email'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'roshan@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'longpassword1');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(sent.url.path, '/auth/login');
    expect(jsonDecode(sent.body), {'email': 'roshan@example.com', 'password': 'longpassword1'});
    expect(api.isLoggedIn, isTrue);
    expect(api.displayName, 'Roshan');
  });

  test('ApiClient surfaces server error messages and never sends a user id', () async {
    SharedPreferences.setMockInitialValues({'auth_token': 't'});
    final api = ApiClient(
      httpClient: MockClient((req) async {
        expect(req.headers['Authorization'], 'Bearer t');
        expect(req.body.contains('user_id'), isFalse);
        return http.Response(jsonEncode({'error': {'code': 'not_found', 'message': 'Trip not found'}}), 404);
      }),
    );
    await api.init();
    expect(() => api.startTrip('x', RouteType.fastest), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Trip not found')));
  });

  testWidgets('TripResultScreen draws routes and pins on the OpenStreetMap map', (tester) async {
    SharedPreferences.setMockInitialValues({'auth_token': 't'});
    final api = ApiClient(httpClient: MockClient((req) async => http.Response('{"tariff":{"free":true,"note":"Free"},"carParks":[]}', 200)));
    await api.init();
    await tester.pumpWidget(AppScope(
      api: api,
      notifications: NotificationService(api),
      location: LocationService(),
      sensors: SensorService(),
      child: MaterialApp(home: TripResultScreen(plan: TripPlan.fromJson(samplePlanJson()))),
    ));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byType(FlutterMap), findsOneWidget);
    final polylines = tester.widget<PolylineLayer>(find.byType(PolylineLayer)).polylines;
    expect(polylines, hasLength(3));
    expect(polylines.last.strokeWidth, 6); // selected route on top
    expect(tester.widget<MarkerLayer>(find.byType(MarkerLayer)).markers, hasLength(2));
    expect(find.text('OpenStreetMap contributors'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  test('SensorService variance', () {
    expect(SensorService.variance([1, 2, 3, 4]), closeTo(1.6667, 1e-3));
    expect(SensorService.variance([5]), 0);
  });
}
