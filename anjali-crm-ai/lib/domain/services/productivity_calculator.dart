import '../../core/utils/date_utils.dart';
import '../entities/activity.dart';
import '../entities/call_log.dart';
import '../entities/client_document.dart';
import '../entities/enums.dart';
import '../entities/followup.dart';

/// Daily productivity dashboard numbers (FR HOME-07).
class Productivity {
  const Productivity({
    required this.followupsDoneToday,
    required this.callsToday,
    required this.conversionsToday,
    required this.pendingTasks,
    required this.weeklyScore,
    required this.monthlyScore,
  });
  final int followupsDoneToday;
  final int callsToday;
  final int conversionsToday;
  final int pendingTasks;
  final int weeklyScore;
  final int monthlyScore;

  static const zero = Productivity(followupsDoneToday: 0, callsToday: 0, conversionsToday: 0, pendingTasks: 0, weeklyScore: 0, monthlyScore: 0);
}

abstract final class ProductivityCalculator {
  /// Raw points for a window: followups×4 + calls×2 + conversions×15 + docs×3.
  static int points({required int followups, required int calls, required int conversions, required int docs}) =>
      followups * 4 + calls * 2 + conversions * 15 + docs * 3;

  static Productivity compute({
    required List<Followup> followups,
    required List<CallLog> calls,
    required List<Activity> activities,
    required List<ClientDocument> documents,
    required DateTime now,
  }) {
    final dayStart = DateX.startOfDay(now);
    final weekStart = dayStart.subtract(const Duration(days: 6));
    final monthStart = DateX.startOfMonth(now);

    int fDone(DateTime from) => followups
        .where((f) => !f.deleted && f.status == FollowupStatus.completed && f.completedAt != null && !f.completedAt!.isBefore(from))
        .length;
    int callCount(DateTime from) => calls.where((c) => !c.deleted && !c.calledAt.isBefore(from)).length;
    int conversions(DateTime from) => activities
        .where((a) => a.type == ActivityType.statusChanged && a.toStatus != null && a.toStatus!.isConverted && !a.at.isBefore(from))
        .length;
    int docs(DateTime from) =>
        documents.where((d) => !d.deleted && d.status.isCollected && !d.updatedAt.isBefore(from)).length;

    final pending = followups.where((f) => !f.deleted && f.isPending && f.dueAt.isBefore(DateX.endOfDay(now))).length;

    final weekPts = points(followups: fDone(weekStart), calls: callCount(weekStart), conversions: conversions(weekStart), docs: docs(weekStart));
    final monthPts = points(followups: fDone(monthStart), calls: callCount(monthStart), conversions: conversions(monthStart), docs: docs(monthStart));
    // Month target scales with elapsed days so the score is fair early in the month.
    final monthTarget = 100 * (now.day / 7).clamp(1, 5);

    return Productivity(
      followupsDoneToday: fDone(dayStart),
      callsToday: callCount(dayStart),
      conversionsToday: conversions(dayStart),
      pendingTasks: pending,
      weeklyScore: weekPts.clamp(0, 100),
      monthlyScore: (monthPts * 100 / monthTarget).round().clamp(0, 100),
    );
  }
}
