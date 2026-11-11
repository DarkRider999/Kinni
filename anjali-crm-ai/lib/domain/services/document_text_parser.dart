/// Fields pulled from OCR text of an identity or salary document.
class ExtractedDocumentData {
  const ExtractedDocumentData({this.name, this.idNumber, this.passportNumber, this.salary, required this.fullText});
  final String? name;

  /// Emirates ID number, formatted 784-YYYY-NNNNNNN-C.
  final String? idNumber;
  final String? passportNumber;

  /// Salary line as printed (e.g. "AED 15,000").
  final String? salary;
  final String fullText;

  bool get hasFields => name != null || idNumber != null || passportNumber != null || salary != null;

  /// Editable note text saved to the client's notes.
  String toNote() => [
        if (name != null) 'Name: $name',
        if (idNumber != null) 'Emirates ID No: $idNumber',
        if (passportNumber != null) 'Passport No: $passportNumber',
        if (salary != null) 'Salary: $salary',
        if (hasFields) '',
        'Document text:',
        fullText.trim(),
      ].join('\n');
}

/// Pure-Dart extraction rules over Google ML Kit OCR output (no network).
abstract final class DocumentTextParser {
  static final _eid = RegExp(r'784[\s\-]?(\d{4})[\s\-]?(\d{7})[\s\-]?(\d)');
  static final _passportLabel = RegExp(r'passport\s*(no|number|n°|#)?\.?\s*[:\-]?\s*([A-Z]{1,2}\d{6,9})', caseSensitive: false);
  static final _mrz = RegExp(r'^P[<A-Z][A-Z]{3}([A-Z<]+)<<([A-Z<]+)', multiLine: true);
  static final _mrzLine2 = RegExp(r'^([A-Z0-9<]{9})\d[A-Z]{3}\d{6}', multiLine: true);
  static final _passportNo = RegExp(r'\b([A-Z]{1,2}\d{6,9})\b');
  static final _nameLabel = RegExp(r'^\s*(name|full name|employee name|holder name)\s*[:\-]?\s*(.+)$', caseSensitive: false, multiLine: true);
  static final _salary = RegExp(
      r'(?:(?:monthly|gross|basic|total|net)?\s*salary[^\n\d]{0,30}|AED|Dhs?\.?)\s*([0-9]{1,3}(?:[,\s][0-9]{3})+|[0-9]{3,6})(?:\.\d{2})?',
      caseSensitive: false);

  static ExtractedDocumentData parse(String text) {
    String? idNumber;
    final e = _eid.firstMatch(text);
    if (e != null) idNumber = '784-${e.group(1)}-${e.group(2)}-${e.group(3)}';

    String? name;
    String? passport;
    final mrz = _mrz.firstMatch(text);
    if (mrz != null) {
      final surname = mrz.group(1)!.replaceAll('<', ' ').trim();
      final given = mrz.group(2)!.replaceAll('<', ' ').trim();
      name = _title('$given $surname');
      final l2 = _mrzLine2.firstMatch(text);
      if (l2 != null) passport = l2.group(1)!.replaceAll('<', '');
    }
    passport ??= _passportLabel.firstMatch(text)?.group(2);
    if (passport == null && idNumber == null && RegExp('passport', caseSensitive: false).hasMatch(text)) {
      passport = _passportNo.firstMatch(text)?.group(1);
    }

    if (name == null) {
      final n = _nameLabel.firstMatch(text)?.group(2)?.trim();
      if (n != null && RegExp(r"^[A-Za-z][A-Za-z .'\-]{2,60}$").hasMatch(n)) name = _title(n);
    }

    String? salary;
    final s = _salary.firstMatch(text);
    if (s != null) {
      final digits = s.group(1)!.replaceAll(RegExp(r'[,\s]'), '');
      final v = int.tryParse(digits);
      if (v != null && v >= 500) salary = 'AED ${_thousands(v)}';
    }
    return ExtractedDocumentData(name: name, idNumber: idNumber, passportNumber: passport, salary: salary, fullText: text);
  }

  static String _title(String s) => s
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');

  static String _thousands(int v) => v.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
}
