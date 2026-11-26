import 'models.dart';

/// Lead score from 0 to 100, shown as the circle on the client profile and
/// used by the "Lead score" sort (guide §6, §8).
///
/// It is a transparent rule, not a model, so it can be explained to the user:
/// * pipeline stage sets the base (New Lead 10 … Disbursed 100; lost leads 0),
/// * priority adds 0/5/10, star rating adds 3 per star,
/// * a known salary, product and email add 5/5/3, a requested amount adds 2,
/// * a lead untouched for more than 30 days loses 10.
int leadScore(Client c, {DateTime? now}) {
  if (c.status.isLost) return 0;
  if (c.status == LeadStatus.disbursed) return 100;
  final stage = switch (c.status) {
    LeadStatus.newLead => 10,
    LeadStatus.interested => 25,
    LeadStatus.documentsRequested => 35,
    LeadStatus.documentsReceived => 50,
    LeadStatus.applicationSubmitted => 65,
    LeadStatus.approved => 80,
    _ => 0,
  };
  var score = stage;
  score += switch (c.priority) {
    Priority.high => 10,
    Priority.medium => 5,
    Priority.low => 0,
  };
  score += c.rating.clamp(0, 5) * 3;
  if (c.salary != null && c.salary! > 0) score += 5;
  if (c.productId != null) score += 5;
  if (c.email.trim().isNotEmpty) score += 3;
  if (c.requestedAmount != null && c.requestedAmount! > 0) score += 2;
  final touched = c.updatedAt ?? c.createdAt;
  if (touched != null && (now ?? DateTime.now()).difference(touched).inDays > 30) score -= 10;
  return score.clamp(0, 99);
}
