import 'package:intl/intl.dart';

final _aed = NumberFormat.decimalPattern('en');

/// "AED 15,000" (no decimals when the amount is whole).
String aed(double? amount) {
  if (amount == null) return '—';
  final whole = amount.truncateToDouble() == amount;
  return 'AED ${whole ? _aed.format(amount.toInt()) : NumberFormat('#,##0.00', 'en').format(amount)}';
}

String dateTimeLabel(DateTime d) => DateFormat('d MMM y, HH:mm').format(d);
String dateLabel(DateTime d) => DateFormat('d MMM y').format(d);
String timeLabel(DateTime d) => DateFormat('HH:mm').format(d);

/// Parses an optional AED amount typed by the user ("15,000" or "15000.5").
/// Empty → null. Throws [FormatException] for anything else that is not a
/// non-negative number.
double? parseAmount(String text) {
  final t = text.replaceAll(',', '').trim();
  if (t.isEmpty) return null;
  final v = double.tryParse(t);
  if (v == null || v < 0) throw const FormatException('Enter a positive amount');
  return v;
}
