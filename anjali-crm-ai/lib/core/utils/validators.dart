import 'phone_utils.dart';

/// Form validators returning an error message or null.
abstract final class Validators {
  static String? name(String? v) {
    final t = v?.trim() ?? '';
    if (t.length < 2) return 'Enter at least 2 characters';
    if (t.length > 80) return 'Name is too long';
    return null;
  }

  static String? phone(String? v) {
    if (v == null || v.trim().isEmpty) return 'Phone number is required';
    return PhoneUtils.isValid(v) ? null : 'Enter a valid phone number';
  }

  static String? optionalPhone(String? v) =>
      (v == null || v.trim().isEmpty) ? null : (PhoneUtils.isValid(v) ? null : 'Enter a valid phone number');

  static final _email = RegExp(r'^[\w.+\-]+@[\w\-]+(\.[\w\-]+)+$');
  static String? optionalEmail(String? v) =>
      (v == null || v.trim().isEmpty) ? null : (_email.hasMatch(v.trim()) ? null : 'Enter a valid email');

  static String? optionalAmount(String? v) {
    if (v == null || v.trim().isEmpty) return null;
    final n = double.tryParse(v.replaceAll(',', '').trim());
    if (n == null || n < 0) return 'Enter a valid amount';
    return null;
  }

  static String? pin(String? v) {
    if (v == null || !RegExp(r'^\d{4,6}$').hasMatch(v)) return 'PIN must be 4–6 digits';
    if (RegExp(r'^(\d)\1+$').hasMatch(v)) return 'Avoid repeating the same digit';
    if ('0123456789'.contains(v) || '9876543210'.contains(v)) return 'Avoid sequential digits';
    return null;
  }

  static double? parseAmount(String? v) =>
      (v == null || v.trim().isEmpty) ? null : double.tryParse(v.replaceAll(',', '').trim());
}
