/// Form validators. Each returns an error message, or null when valid.
class Validators {
  Validators._();

  static final _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _phoneChars = RegExp(r'^\+?[0-9 ()\-]+$');

  static String? required(String? value, String label) =>
      (value == null || value.trim().isEmpty) ? '$label is required' : null;

  /// Optional field; when filled it must look like name@domain.tld.
  static String? email(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return null;
    return _email.hasMatch(v) ? null : 'Enter a valid email address';
  }

  /// Optional field; when filled it may contain only digits, spaces, ( ) -
  /// and a leading +, and must have 7 to 15 digits (the E.164 maximum).
  static String? phone(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return null;
    if (!_phoneChars.hasMatch(v)) return 'Use digits, spaces, ( ) - and a leading +';
    final digits = v.replaceAll(RegExp(r'[^0-9]'), '').length;
    if (digits < 7 || digits > 15) return 'Phone number must have 7 to 15 digits';
    return null;
  }
}
