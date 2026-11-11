import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:anjali_crm_ai/domain/entities/product.dart';
import 'package:anjali_crm_ai/domain/services/followup_bucketer.dart';
import 'package:anjali_crm_ai/domain/services/report_engine.dart';
import 'package:anjali_crm_ai/domain/services/status_automation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  group('FollowupBucketer', () {
    final now = DateTime(2026, 10, 14, 12); // Wednesday noon
    final fs = [
      followup(id: 'over', due: now.subtract(const Duration(hours: 1))),
      followup(id: 'today', due: DateTime(2026, 10, 14, 17)),
      followup(id: 'tom', due: DateTime(2026, 10, 15, 9)),
      followup(id: 'week', due: DateTime(2026, 10, 19, 9)),
      followup(id: 'later', due: DateTime(2026, 11, 2, 9)),
      followup(id: 'done', due: now, status: FollowupStatus.completed, completedAt: now),
      followup(id: 'cancel', due: now, status: FollowupStatus.cancelled),
    ];
    final b = FollowupBucketer.bucket(fs, now);

    test('each followup lands in exactly one segment; cancelled excluded', () {
      String ids(FollowupBucket k) => b[k]!.map((f) => f.id).join(',');
      expect(ids(FollowupBucket.overdue), 'over');
      expect(ids(FollowupBucket.today), 'today');
      expect(ids(FollowupBucket.tomorrow), 'tom');
      expect(ids(FollowupBucket.thisWeek), 'week');
      expect(ids(FollowupBucket.upcoming), 'later');
      expect(ids(FollowupBucket.completed), 'done');
    });

    test('sorted nearest date first', () {
      final more = FollowupBucketer.bucket([
        followup(id: 'b', due: DateTime(2026, 10, 14, 18)),
        followup(id: 'a', due: DateTime(2026, 10, 14, 13)),
      ], now);
      expect(more[FollowupBucket.today]!.map((f) => f.id), ['a', 'b']);
    });
  });

  group('ReportEngine', () {
    final now = DateTime(2026, 10, 20);
    final clients = [
      client(id: '1', status: LeadStatus.approved, statusChangedAt: DateTime(2026, 10, 5), salary: 12000, source: LeadSource.referral),
      client(id: '2', status: LeadStatus.disbursed, statusChangedAt: DateTime(2026, 9, 5), source: LeadSource.referral),
      client(id: '3', status: LeadStatus.rejected, source: LeadSource.coldCall),
      client(id: '4', status: LeadStatus.notEligible),
      client(id: '5', status: LeadStatus.interested, salary: 4000),
      client(id: '6', status: LeadStatus.documentsRequested),
      client(id: 'x', status: LeadStatus.approved, deleted: true),
    ];

    test('KPI rates use decided leads as the denominator', () {
      final k = ReportEngine.kpis(clients, const [], now: now);
      expect(k.total, 6);
      expect(k.approvalRate, closeTo(2 / 4, 1e-9));
      expect(k.rejectionRate, closeTo(1 / 4, 1e-9));
      expect(k.conversionRate, closeTo(2 / 6, 1e-9));
      expect(k.monthlyConversions, 1);
      expect(k.documentsPending, 1);
    });

    test('funnel is cumulative and monotonic', () {
      final f = ReportEngine.funnel(clients);
      for (var i = 1; i < f.length; i++) {
        expect(f[i].count, lessThanOrEqualTo(f[i - 1].count));
      }
      expect(f.first.count, 4); // open + converted, closed-lost excluded
    });

    test('group by salary band and lead source', () {
      final products = [Product(id: 'p', createdAt: t0, updatedAt: t0, name: 'PL')];
      final bands = ReportEngine.groupBy(ReportGroup.salary, clients, products).map((r) => r.label).toList();
      expect(bands, containsAllInOrder(['< 5k', '10k – 20k', 'Unknown']));
      final src = ReportEngine.groupBy(ReportGroup.source, clients, products);
      final referral = src.firstWhere((r) => r.label == 'Referral');
      expect(referral.leads, 2);
      expect(referral.conversionRate, 1);
    });
  });

  group('StatusAutomation', () {
    final now = DateTime(2026, 10, 14, 15);
    test('call outcomes map to CRM effects', () {
      expect(StatusAutomation.forOutcome(CallOutcome.interested, LeadStatus.newLead, now).newStatus, LeadStatus.interested);
      expect(StatusAutomation.forOutcome(CallOutcome.interested, LeadStatus.underReview, now).newStatus, isNull,
          reason: 'never downgrade an advanced lead');
      expect(StatusAutomation.forOutcome(CallOutcome.rejected, LeadStatus.interested, now).newStatus, LeadStatus.notInterested);
      expect(StatusAutomation.forOutcome(CallOutcome.noAnswer, LeadStatus.newLead, now).suggestFollowupAt, now.add(const Duration(hours: 2)));
      final cb = StatusAutomation.forOutcome(CallOutcome.callBack, LeadStatus.newLead, now);
      expect(cb.askForFollowup, isTrue);
      expect(cb.suggestFollowupAt, DateTime(2026, 10, 15, 10));
      final wrong = StatusAutomation.forOutcome(CallOutcome.wrongNumber, LeadStatus.newLead, now);
      expect(wrong.markWrongNumber, isTrue);
      expect(wrong.newPriority, Priority.low);
    });
  });
}
