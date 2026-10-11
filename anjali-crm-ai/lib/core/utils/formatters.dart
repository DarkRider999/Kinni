import 'package:intl/intl.dart';

/// Display formatting (AED currency, dates, relative times).
abstract final class Fmt {
  static final _money = NumberFormat.decimalPattern('en_US');
  static final _compact = NumberFormat.compact(locale: 'en_US');
  static final _date = DateFormat('d MMM yyyy');
  static final _dateShort = DateFormat('d MMM');
  static final _time = DateFormat('h:mm a');
  static final _dateTime = DateFormat('d MMM yyyy, h:mm a');
  static final _weekday = DateFormat('EEEE, d MMMM');
  static final _month = DateFormat('MMM yy');
  static final _file = DateFormat('yyyyMMdd_HHmmss');

  static String aed(num? v) => v == null ? '—' : 'AED ${_money.format(v.round())}';
  static String aedCompact(num? v) => v == null ? '—' : 'AED ${_compact.format(v)}';
  static String number(num v) => _money.format(v);
  static String percent(double v) => '${(v * 100).toStringAsFixed(v >= 0.1 || v == 0 ? 0 : 1)}%';
  static String date(DateTime d) => _date.format(d);
  static String dateShort(DateTime d) => _dateShort.format(d);
  static String time(DateTime d) => _time.format(d);
  static String dateTime(DateTime d) => _dateTime.format(d);
  static String weekday(DateTime d) => _weekday.format(d);
  static String month(DateTime d) => _month.format(d);
  static String fileStamp(DateTime d) => _file.format(d);

  static String duration(int ms) {
    final s = (ms / 1000).round();
    return '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
  }

  /// "in 3 h", "2 d ago", "now".
  static String relative(DateTime d, DateTime now) {
    final diff = d.difference(now);
    final past = diff.isNegative;
    final a = diff.abs();
    String v;
    if (a.inMinutes < 1) return 'now';
    if (a.inMinutes < 60) {
      v = '${a.inMinutes} min';
    } else if (a.inHours < 24) {
      v = '${a.inHours} h';
    } else {
      v = '${a.inDays} d';
    }
    return past ? '$v ago' : 'in $v';
  }
}
