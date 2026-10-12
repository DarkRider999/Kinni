import '../entities/client.dart';
import '../entities/client_document.dart';
import '../entities/enums.dart';
import '../entities/followup.dart';
import '../entities/product.dart';
import 'document_checklist.dart';

/// Local "AI" lead score, 0–100. Higher = more likely to convert soon.
///
/// Components (docs/03-database-design.md §6):
/// status 0–35 · priority 0–20 · rating 0–15 · salary 0–10 ·
/// document completeness 0–10 · recency 0–10 · overdue penalty 0–15.
abstract final class LeadScoring {
  static const _statusWeight = {
    LeadStatus.newLead: 8,
    LeadStatus.interested: 16,
    LeadStatus.documentsRequested: 20,
    LeadStatus.documentsReceived: 26,
    LeadStatus.applicationSubmitted: 30,
    LeadStatus.underReview: 33,
    LeadStatus.approved: 35,
    LeadStatus.disbursed: 35,
    LeadStatus.rejected: 0,
    LeadStatus.notEligible: 0,
    LeadStatus.notInterested: 0,
  };

  static const _priorityWeight = {
    Priority.low: 4,
    Priority.medium: 10,
    Priority.high: 16,
    Priority.urgent: 20,
  };

  static int score(
    Client c, {
    List<Followup> followups = const [],
    List<ClientDocument> docs = const [],
    Product? product,
    DateTime? now,
  }) {
    final t = now ?? DateTime.now();
    if (c.status.isClosedLost) return 0;
    var s = 0.0;
    s += _statusWeight[c.status]!;
    s += _priorityWeight[c.priority]!;
    s += c.rating * 3;
    s += _salaryPoints(c.monthlySalary);

    if (docs.isNotEmpty) s += 10 * DocumentChecklist.build(product, docs).completion;

    final daysIdle = t.difference(c.updatedAt).inDays;
    s += daysIdle <= 1 ? 10 : daysIdle <= 3 ? 7 : daysIdle <= 7 ? 4 : daysIdle <= 30 ? 1 : 0;

    final overdue = followups.where((f) => !f.deleted && f.isOverdue(t)).toList();
    if (overdue.isNotEmpty) {
      final worst = overdue.map((f) => t.difference(f.dueAt).inDays).reduce((a, b) => a > b ? a : b);
      s -= (5 + worst * 2).clamp(5, 15);
    }
    if (c.wrongNumber) s -= 10;
    return s.round().clamp(0, 100);
  }

  static double _salaryPoints(double? salary) {
    if (salary == null) return 3;
    if (salary >= 30000) return 10;
    if (salary >= 15000) return 8;
    if (salary >= 8000) return 6;
    if (salary >= 5000) return 4;
    return 2;
  }

  static String band(int score) => score >= 75 ? 'Hot' : score >= 50 ? 'Warm' : score >= 25 ? 'Cool' : 'Cold';
}
