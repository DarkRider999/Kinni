import 'package:anjali_crm_ai/domain/entities/client_document.dart';
import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:anjali_crm_ai/domain/entities/product.dart';
import 'package:anjali_crm_ai/domain/services/insights_engine.dart';
import 'package:anjali_crm_ai/domain/services/lead_scoring.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  final now = t0.add(const Duration(hours: 2));

  test('score is 0 for closed-lost and within 0..100', () {
    expect(LeadScoring.score(client(status: LeadStatus.rejected), now: now), 0);
    final hot = client(status: LeadStatus.underReview, priority: Priority.urgent, rating: 5, salary: 40000);
    expect(LeadScoring.score(hot, now: now), inInclusiveRange(0, 100));
    expect(LeadScoring.score(hot, now: now), greaterThan(80));
  });

  test('advanced, high-priority leads outscore new low-priority ones', () {
    final a = LeadScoring.score(client(status: LeadStatus.applicationSubmitted, priority: Priority.high, rating: 4), now: now);
    final b = LeadScoring.score(client(status: LeadStatus.newLead, priority: Priority.low, rating: 1), now: now);
    expect(a, greaterThan(b));
  });

  test('overdue followups reduce the score', () {
    final c = client(status: LeadStatus.interested, priority: Priority.high);
    final base = LeadScoring.score(c, now: now);
    final overdue = LeadScoring.score(c, followups: [followup(due: now.subtract(const Duration(days: 3)))], now: now);
    expect(overdue, lessThan(base));
  });

  test('collected documents raise the score', () {
    final c = client(status: LeadStatus.documentsRequested);
    final docs = [
      for (final t in DocumentType.required)
        ClientDocument(id: t.name, createdAt: t0, updatedAt: t0, clientId: 'c1', type: t, status: DocumentStatus.verified),
    ];
    expect(LeadScoring.score(c, docs: docs, now: now), greaterThan(LeadScoring.score(c, now: now)));
  });

  test('insights surface overdue, pending docs and best product', () {
    final p1 = Product(id: 'p1', createdAt: t0, updatedAt: t0, name: 'Personal Loan');
    final p2 = Product(id: 'p2', createdAt: t0, updatedAt: t0, name: 'Credit Card');
    final clients = [
      client(id: 'a', status: LeadStatus.approved, productId: 'p1'),
      client(id: 'b', status: LeadStatus.disbursed, productId: 'p1'),
      client(id: 'c', status: LeadStatus.rejected, productId: 'p2'),
      client(id: 'd', status: LeadStatus.newLead, productId: 'p2'),
      client(id: 'e', status: LeadStatus.documentsRequested, productId: 'p1', priority: Priority.urgent),
    ];
    final i = InsightsEngine.build(
      clients: clients,
      followups: [followup(id: 'f', clientId: 'd', due: now.subtract(const Duration(hours: 5)))],
      documents: const [],
      products: [p1, p2],
      now: now,
    );
    expect(i.overdue.single.client.id, 'd');
    expect(i.pendingDocuments.map((s) => s.client.id), contains('e'));
    expect(i.bestProduct?.label, 'Personal Loan');
    expect(i.highPriority.map((s) => s.client.id), contains('e'));
  });
}
