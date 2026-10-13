import 'package:flutter_test/flutter_test.dart';
import 'package:smart_beginning/core/parent_session.dart';

void main() {
  group('ParentSession', () {
    test('is not elevated by default', () {
      const ParentSession session = ParentSession();
      expect(session.isElevatedAt(DateTime(2026, 1, 1)), isFalse);
    });

    test('is elevated within the ttl window and expires after it', () {
      final DateTime start = DateTime(2026, 1, 1, 12);
      final ParentSession session = ParentSession(
        elevatedUntil: start.add(ParentSessionNotifier.ttl),
      );
      expect(
        session.isElevatedAt(start.add(const Duration(minutes: 4))),
        isTrue,
      );
      expect(
        session.isElevatedAt(start.add(const Duration(minutes: 6))),
        isFalse,
      );
    });
  });
}
