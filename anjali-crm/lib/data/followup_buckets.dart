import 'models.dart';

/// The Followups screen's tabs (guide §15).
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

/// Which tab a followup belongs in at [now]. Each followup is in exactly one:
/// done → Completed; past due → Overdue; due later today → Today; tomorrow →
/// Tomorrow; within the next 7 days → This Week; anything later → Upcoming.
FollowupBucket bucketFor(Followup f, DateTime now) {
  if (f.isDone) return FollowupBucket.completed;
  if (f.dueAt.isBefore(now)) return FollowupBucket.overdue;
  final today = DateTime(now.year, now.month, now.day);
  final tomorrow = today.add(const Duration(days: 1));
  final dayAfter = today.add(const Duration(days: 2));
  final weekEnd = today.add(const Duration(days: 7));
  if (f.dueAt.isBefore(tomorrow)) return FollowupBucket.today;
  if (f.dueAt.isBefore(dayAfter)) return FollowupBucket.tomorrow;
  if (f.dueAt.isBefore(weekEnd)) return FollowupBucket.thisWeek;
  return FollowupBucket.upcoming;
}
