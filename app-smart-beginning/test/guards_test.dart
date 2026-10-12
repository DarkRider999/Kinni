import 'package:flutter_test/flutter_test.dart';
import 'package:smart_beginning/app/guards.dart';

void main() {
  group('parentGuardRedirect', () {
    test('allows a non-parent route', () {
      expect(
        parentGuardRedirect(location: '/home', parentElevated: false),
        isNull,
      );
    });

    test('blocks the parent route when not elevated', () {
      final String? redirect =
          parentGuardRedirect(location: '/parent', parentElevated: false);
      expect(redirect, isNotNull);
      expect(redirect, contains(parentGatePath));
      expect(redirect, contains('redirect='));
    });

    test('allows the parent route when elevated', () {
      expect(
        parentGuardRedirect(location: '/parent', parentElevated: true),
        isNull,
      );
    });

    test('blocks a nested parent route when not elevated', () {
      expect(
        parentGuardRedirect(location: '/parent/settings', parentElevated: false),
        isNotNull,
      );
    });

    test('never blocks the gate route itself', () {
      expect(
        parentGuardRedirect(
          location: '$parentGatePath?redirect=%2Fparent',
          parentElevated: false,
        ),
        isNull,
      );
    });
  });
}
