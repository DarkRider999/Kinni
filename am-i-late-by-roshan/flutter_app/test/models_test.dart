import 'package:am_i_late/models/driver_profile.dart';
import 'package:am_i_late/models/notification_preference.dart';
import 'package:am_i_late/models/route_option.dart';
import 'package:am_i_late/models/trip.dart';
import 'package:am_i_late/utils/format.dart';
import 'package:am_i_late/utils/geo.dart';
import 'package:am_i_late/utils/polyline.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

import 'fixtures.dart';

void main() {
  group('polyline', () {
    test('decodes the reference Google polyline', () {
      final pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      expect(pts, const [LatLng(38.5, -120.2), LatLng(40.7, -120.95), LatLng(43.252, -126.453)]);
    });

    test('bounds cover all points', () {
      final b = boundsOf(const [LatLng(25, 55), LatLng(25.2, 55.3), LatLng(24.9, 55.1)]);
      expect(b.southWest, const LatLng(24.9, 55));
      expect(b.northEast, const LatLng(25.2, 55.3));
    });
  });

  group('geo', () {
    test('distance between Dubai Mall and Dubai Marina Mall is ~19.4 km', () {
      final d = distanceM(const LatLng(25.1972, 55.2796), const LatLng(25.0763, 55.1401));
      expect(d, closeTo(19400, 300));
    });

    test('distance to path uses the closest segment', () {
      final path = const [LatLng(25, 55), LatLng(25, 55.1)];
      expect(distanceToPathM(const LatLng(25.001, 55.05), path), closeTo(110, 5));
    });
  });

  group('TripPlan.fromJson', () {
    final plan = TripPlan.fromJson(samplePlanJson());

    test('parses verdict, times and context', () {
      expect(plan.verdict, Verdict.onTime);
      expect(plan.minutesUntilDeparture, 22);
      expect(plan.targetArrival, DateTime.parse('2026-09-28T04:30:00.000Z'));
      expect(plan.weather, 'Clear skies');
      expect(plan.events.single.name, 'Expo');
      expect(plan.preferredRouteType, RouteType.cheapest);
    });

    test('parses three routes with steps, lanes and tolls', () {
      expect(plan.routes.map((r) => r.routeType), [RouteType.fastest, RouteType.cheapest, RouteType.lowStress]);
      final fastest = plan.route(RouteType.fastest);
      expect(fastest.tollCostAed, 6);
      expect(fastest.tollGates.single.name, 'Al Garhoud Bridge');
      expect(fastest.points, hasLength(3));
      expect(fastest.steps[1].lanes, hasLength(3));
      expect(fastest.steps[1].laneGuidance, 'Use the 2 left lanes to turn left (2 of 3)');
      expect(plan.route(RouteType.lowStress).variantKey, 'r0');
    });
  });

  test('DriverProfile JSON round trip', () {
    const p = DriverProfile(bufferMinutes: 12, preferredRouteType: RouteType.lowStress, hasSalikTag: false);
    final back = DriverProfile.fromJson(p.toJson());
    expect(back.bufferMinutes, 12);
    expect(back.preferredRouteType, RouteType.lowStress);
    expect(back.hasSalikTag, isFalse);
  });

  test('CommuteProfile.nextArrival skips days that are not selected', () {
    const c = CommuteProfile(
      name: 'Work',
      originLat: 25,
      originLng: 55,
      originLabel: 'Home',
      destinationLat: 25.2,
      destinationLng: 55.3,
      destinationLabel: 'Office',
      targetArrivalTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
    );
    // Friday 2026-10-02 at 09:00 -> next is Monday 2026-10-05 08:30.
    expect(c.nextArrival(DateTime(2026, 10, 2, 9)), DateTime(2026, 10, 5, 8, 30));
    // Monday 07:00 -> same day.
    expect(c.nextArrival(DateTime(2026, 10, 5, 7)), DateTime(2026, 10, 5, 8, 30));
  });

  test('NotificationPreference trims seconds from quiet hours and clears them', () {
    final p = NotificationPreference.fromJson({'quiet_hours_start': '23:00:00', 'quiet_hours_end': '06:00:00'});
    expect(p.quietHoursStart, '23:00');
    final cleared = p.copyWith(quietHoursStart: () => null, quietHoursEnd: () => null);
    expect(cleared.toJson()['quiet_hours_start'], isNull);
  });

  group('format', () {
    test('minutes', () {
      expect(formatMinutes(42.4), '42 min');
      expect(formatMinutes(60), '1 h');
      expect(formatMinutes(95), '1 h 35 min');
    });
    test('distance', () {
      expect(formatDistance(234), '230 m');
      expect(formatDistance(1500), '1.5 km');
      expect(formatDistance(25400), '25 km');
    });
    test('tolls and days', () {
      expect(formatAed(0), 'No tolls');
      expect(formatAed(12), 'AED 12');
      expect(formatDays([1, 2, 3, 4, 5]), 'Mon-Fri');
      expect(formatDays([6, 7]), 'Sat, Sun');
    });
  });
}
