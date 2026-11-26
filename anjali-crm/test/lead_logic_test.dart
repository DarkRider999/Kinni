import 'package:anjali_crm_ai/data/followup_buckets.dart';
import 'package:anjali_crm_ai/data/lead_score.dart';
import 'package:anjali_crm_ai/data/models.dart';
import 'package:anjali_crm_ai/data/phone.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('phone', () {
    test('the same number in different formats shares one key', () {
      expect(phoneKey('+971 50 123 4567'), '501234567');
      expect(phoneKey('00971501234567'), '501234567');
      expect(phoneKey('050-123-4567'), '501234567');
      expect(phoneKey('1234'), '1234');
    });

    test('search digits match partial numbers in local or international form', () {
      expect(phoneSearchDigits('050 123'), '50123');
      expect(phoneSearchDigits('+971 50 123'), '50123');
      expect(phoneSearchDigits('0097150123'), '50123');
      expect(phoneSearchDigits('4567'), '4567');
    });

    test('WhatsApp digits are international', () {
      expect(internationalDigits('+971 50 123 4567'), '971501234567');
      expect(internationalDigits('00971 50 123 4567'), '971501234567');
      expect(internationalDigits('050 123 4567'), '971501234567');
      expect(internationalDigits('+44 20 7946 0958'), '442079460958');
      expect(internationalDigits('12345'), isNull);
    });
  });

  group('lead score', () {
    final now = DateTime(2026, 11, 26);
    Client c({LeadStatus status = LeadStatus.newLead, Priority priority = Priority.medium, int rating = 0, double? salary, int? productId, String email = '', DateTime? updated}) =>
        Client(name: 'x', phone: '', status: status, priority: priority, rating: rating, salary: salary, productId: productId, email: email, updatedAt: updated ?? now);

    test('follows the documented rule', () {
      expect(leadScore(c(), now: now), 15); // 10 stage + 5 medium
      expect(leadScore(c(status: LeadStatus.approved, priority: Priority.high, rating: 5, salary: 20000, productId: 1, email: 'a@b.c'), now: now), 99,
          reason: '80+10+15+5+5+3 = 118, capped below 100 for open leads');
      expect(leadScore(c(status: LeadStatus.disbursed), now: now), 100);
      expect(leadScore(c(status: LeadStatus.rejected, priority: Priority.high, rating: 5), now: now), 0);
    });

    test('stale leads lose 10 points', () {
      expect(leadScore(c(updated: now.subtract(const Duration(days: 31))), now: now), 5);
    });

    test('later pipeline stages never score lower, other things equal', () {
      var last = -1;
      for (final s in LeadStatus.pipeline) {
        final v = leadScore(c(status: s), now: now);
        expect(v, greaterThanOrEqualTo(last), reason: s.label);
        last = v;
      }
    });
  });

  group('followup buckets', () {
    final now = DateTime(2026, 11, 26, 10, 0); // a Thursday morning
    FollowupBucket at(DateTime due, {bool done = false}) =>
        bucketFor(Followup(clientId: 1, dueAt: due, completedAt: done ? now : null), now);

    test('each followup lands in exactly one tab', () {
      expect(at(DateTime(2026, 11, 26, 9, 59)), FollowupBucket.overdue);
      expect(at(DateTime(2026, 11, 20)), FollowupBucket.overdue);
      expect(at(DateTime(2026, 11, 26, 10, 0)), FollowupBucket.today);
      expect(at(DateTime(2026, 11, 26, 23, 59)), FollowupBucket.today);
      expect(at(DateTime(2026, 11, 27, 0, 0)), FollowupBucket.tomorrow);
      expect(at(DateTime(2026, 11, 27, 23, 59)), FollowupBucket.tomorrow);
      expect(at(DateTime(2026, 11, 28, 9)), FollowupBucket.thisWeek);
      expect(at(DateTime(2026, 12, 2, 23, 59)), FollowupBucket.thisWeek);
      expect(at(DateTime(2026, 12, 3)), FollowupBucket.upcoming);
      expect(at(DateTime(2026, 11, 20), done: true), FollowupBucket.completed, reason: 'done wins over overdue');
    });
  });
}
