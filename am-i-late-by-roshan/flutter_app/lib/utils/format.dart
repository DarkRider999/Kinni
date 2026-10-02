import 'package:intl/intl.dart';

String formatClock(DateTime t) => DateFormat.Hm().format(t.toLocal());

String formatMinutes(num minutes) {
  final m = minutes.round();
  if (m < 60) return '$m min';
  final h = m ~/ 60;
  final rest = m % 60;
  return rest == 0 ? '$h h' : '$h h $rest min';
}

String formatDistance(num metres) {
  if (metres < 1000) return '${(metres / 10).round() * 10} m';
  return '${(metres / 1000).toStringAsFixed(metres < 10000 ? 1 : 0)} km';
}

String formatAed(num aed) => aed == 0 ? 'No tolls' : 'AED ${aed % 1 == 0 ? aed.toInt() : aed.toStringAsFixed(2)}';

const weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

String formatDays(List<int> isoDays) {
  final sorted = [...isoDays]..sort();
  if (sorted.join(',') == '1,2,3,4,5') return 'Mon-Fri';
  if (sorted.length == 7) return 'Every day';
  return sorted.map((d) => weekdayShort[d - 1]).join(', ');
}
