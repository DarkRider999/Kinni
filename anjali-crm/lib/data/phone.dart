/// Phone number helpers. The app is UAE-focused (AED, Emirates ID), so a
/// local number starting with a single 0 is read as a UAE number.
library;

const defaultCountryCode = '971';

String digitsOnly(String phone) => phone.replaceAll(RegExp(r'[^0-9]'), '');

/// Key used to spot the same number written differently, for example
/// "+971 50 123 4567", "00971501234567" and "050 123 4567" all share
/// "501234567". It is the last 9 digits, or all digits when there are fewer.
String phoneKey(String phone) {
  final d = digitsOnly(phone);
  return d.length <= 9 ? d : d.substring(d.length - 9);
}

/// International digits for wa.me links: "+971 50…" and "00971 50…" become
/// "97150…"; a local "050…" becomes "97150…". Returns null when the number
/// has too few digits to dial.
String? internationalDigits(String phone) {
  final trimmed = phone.trim();
  var d = digitsOnly(trimmed);
  if (d.length < 7) return null;
  if (trimmed.startsWith('+')) return d;
  if (d.startsWith('00')) return d.substring(2);
  if (d.startsWith('0')) return '$defaultCountryCode${d.substring(1)}';
  return d;
}

/// Digits to match against stored phone keys when searching, so a partial
/// number typed in local or international form ("050 123", "+971 50 123",
/// "0097150") still matches. Drops a leading 00, the UAE country code and the
/// local trunk 0.
String phoneSearchDigits(String term) {
  var d = digitsOnly(term);
  if (d.startsWith('00')) d = d.substring(2);
  if (d.startsWith(defaultCountryCode)) d = d.substring(defaultCountryCode.length);
  return d.replaceFirst(RegExp(r'^0+'), '');
}
