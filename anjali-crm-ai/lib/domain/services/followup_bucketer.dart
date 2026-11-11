import '../../core/utils/date_utils.dart';
import '../entities/enums.dart';
import '../entities/followup.dart';

enum FollowupBucket {
  today('Today'),
  tomorrow('Tomorrow'),
  thisWeek('This Week'),
  upcoming('Upcoming'),
  overdue('Overdue'),
  completed('Completed');

  const FollowupBucket(this.label);
  final String label;
}

/// Splits followups into the six Followups-tab segments.
///
/// Rules: overdue = pending and due before now (wins over "today");
/// today = pending, due later today; tomorrow = due tomorrow;
/// thisWeek = after tomorrow and within the next 7 days; upcoming = later.
/// Every bucket is sorted nearest-first; completed is most-recent-first.
abstract final class FollowupBucketer {
  static Map<FollowupBucket, List<Followup>> bucket(List<Followup> all, DateTime now) {
    final out = {for (final b in FollowupBucket.values) b: <Followup>[]};
    final today = DateX.startOfDay(now);
    final tomorrow = today.add(const Duration(days: 1));
    final dayAfter = today.add(const Duration(days: 2));
    final weekEnd = today.add(const Duration(days: 8));

    for (final f in all) {
      if (f.deleted || f.status == FollowupStatus.cancelled) continue;
      if (f.status == FollowupStatus.completed) {
        out[FollowupBucket.completed]!.add(f);
      } else if (f.dueAt.isBefore(now)) {
        out[FollowupBucket.overdue]!.add(f);
      } else if (f.dueAt.isBefore(tomorrow)) {
        out[FollowupBucket.today]!.add(f);
      } else if (f.dueAt.isBefore(dayAfter)) {
        out[FollowupBucket.tomorrow]!.add(f);
      } else if (f.dueAt.isBefore(weekEnd)) {
        out[FollowupBucket.thisWeek]!.add(f);
      } else {
        out[FollowupBucket.upcoming]!.add(f);
      }
    }
    for (final e in out.entries) {
      if (e.key == FollowupBucket.completed) {
        e.value.sort((a, b) => (b.completedAt ?? b.dueAt).compareTo(a.completedAt ?? a.dueAt));
      } else if (e.key == FollowupBucket.overdue) {
        // nearest date first = most recently missed first
        e.value.sort((a, b) => b.dueAt.compareTo(a.dueAt));
      } else {
        e.value.sort((a, b) => a.dueAt.compareTo(b.dueAt));
      }
    }
    return out;
  }
}
