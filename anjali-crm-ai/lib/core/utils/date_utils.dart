/// Calendar helpers that work in local time.
abstract final class DateX {
  static DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);
  static DateTime endOfDay(DateTime d) => DateTime(d.year, d.month, d.day, 23, 59, 59, 999);
  static DateTime startOfMonth(DateTime d) => DateTime(d.year, d.month);
  static DateTime startOfWeek(DateTime d) => startOfDay(d).subtract(Duration(days: d.weekday - 1));
  static bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
  static bool sameMonth(DateTime a, DateTime b) => a.year == b.year && a.month == b.month;
  static bool isBetween(DateTime d, DateTime from, DateTime to) => !d.isBefore(from) && !d.isAfter(to);

  /// Time-of-day greeting.
  static String greeting(DateTime now) {
    final h = now.hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }
}
