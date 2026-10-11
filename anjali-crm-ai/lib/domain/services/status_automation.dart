import '../entities/enums.dart';

/// What a call outcome does to the CRM (FR CALL-03).
class OutcomeEffect {
  const OutcomeEffect({this.newStatus, this.suggestFollowupAt, this.askForFollowup = false, this.markWrongNumber = false, this.newPriority});
  final LeadStatus? newStatus;
  final DateTime? suggestFollowupAt;
  final bool askForFollowup;
  final bool markWrongNumber;
  final Priority? newPriority;
}

abstract final class StatusAutomation {
  static OutcomeEffect forOutcome(CallOutcome o, LeadStatus current, DateTime now) {
    switch (o) {
      case CallOutcome.interested:
        // Only move forward: never downgrade a lead already further along.
        return OutcomeEffect(
          newStatus: current.pipelineIndex >= LeadStatus.interested.pipelineIndex ? null : LeadStatus.interested,
        );
      case CallOutcome.callBack:
        final t = DateTime(now.year, now.month, now.day + 1, 10);
        return OutcomeEffect(suggestFollowupAt: t, askForFollowup: true);
      case CallOutcome.noAnswer:
        return OutcomeEffect(suggestFollowupAt: now.add(const Duration(hours: 2)));
      case CallOutcome.rejected:
        return const OutcomeEffect(newStatus: LeadStatus.notInterested);
      case CallOutcome.wrongNumber:
        return const OutcomeEffect(markWrongNumber: true, newPriority: Priority.low);
    }
  }
}
