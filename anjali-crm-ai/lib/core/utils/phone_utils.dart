/// Phone number helpers. UAE-first (Anjali works in the Emirates) but
/// tolerant of any international number.
abstract final class PhoneUtils {
  static const defaultCountryCode = '971';

  /// Digits only (a leading + is dropped).
  static String digits(String raw) => raw.replaceAll(RegExp(r'[^0-9]'), '');

  /// Comparison key used for duplicate detection: the last 9 digits, which
  /// is the national significant number for UAE mobiles and matches the
  /// same number written as 050…, +97150…, 0097150… or 50….
  static String key(String raw) {
    final d = digits(raw);
    if (d.length <= 9) return d;
    return d.substring(d.length - 9);
  }

  /// International digits without +, suitable for wa.me links and tel: URIs.
  static String international(String raw, {String countryCode = defaultCountryCode}) {
    var d = digits(raw);
    if (d.isEmpty) return d;
    if (d.startsWith('00')) return d.substring(2);
    if (raw.trim().startsWith('+')) return d;
    if (d.startsWith(countryCode)) return d;
    if (d.startsWith('0')) d = d.substring(1);
    if (d.length <= 9) return '$countryCode$d';
    return d;
  }

  /// Dialable string with a leading +.
  static String dialable(String raw) {
    final i = international(raw);
    return i.isEmpty ? raw : '+$i';
  }

  static bool isValid(String raw) {
    final d = digits(raw);
    return d.length >= 7 && d.length <= 15;
  }
}
