/// Extracts contact fields from OCR text of a visiting card.
class ParsedCard {
  const ParsedCard({this.name, this.phones = const [], this.email, this.company, this.jobTitle, this.website});
  final String? name;
  final List<String> phones;
  final String? email;
  final String? company;
  final String? jobTitle;
  final String? website;
  bool get isEmpty => name == null && phones.isEmpty && email == null && company == null;
}

abstract final class BusinessCardParser {
  static final _email = RegExp(r'[\w.+\-]+@[\w\-]+(\.[\w\-]+)+');
  static final _phone = RegExp(r'(\+?\d[\d\s\-().]{6,}\d)');
  static final _web = RegExp(r'(www\.|https?://)\S+', caseSensitive: false);
  static final _companyHints = RegExp(
      r'\b(LLC|L\.L\.C|Ltd|Limited|Inc|FZE|FZCO|FZ-LLC|Group|Bank|Holding|Trading|Company|Co\.|Corp|Est|Establishment|Solutions|Services|Technologies|Properties|Realty|Insurance)\b',
      caseSensitive: false);
  static final _titleHints = RegExp(
      r'\b(Manager|Director|Officer|Executive|Engineer|CEO|CFO|COO|CTO|Founder|Partner|Owner|Consultant|Advisor|Head|Lead|Specialist|Supervisor|Accountant|Sales|Assistant|President|Analyst|Coordinator)\b',
      caseSensitive: false);
  static final _labelPrefix = RegExp(r'^(tel|phone|mob|mobile|m|t|ph|fax|f|cell|whatsapp|office|direct)\s*[:.]?\s*', caseSensitive: false);

  static ParsedCard parse(String text) {
    final lines = text.split(RegExp(r'[\r\n]+')).map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    String? email;
    String? website;
    final phones = <String>[];
    String? company;
    String? title;
    final leftovers = <String>[];

    for (final raw in lines) {
      final line = raw.replaceFirst(_labelPrefix, '');
      final e = _email.firstMatch(line);
      if (e != null) {
        email ??= e.group(0)!.toLowerCase();
        continue;
      }
      final w = _web.firstMatch(line);
      if (w != null) {
        website ??= w.group(0);
        continue;
      }
      final isFax = RegExp(r'^\s*(fax|f)\b', caseSensitive: false).hasMatch(raw);
      final pm = _phone.allMatches(line).toList();
      final digitsInLine = line.replaceAll(RegExp(r'\D'), '').length;
      if (pm.isNotEmpty && digitsInLine >= 7 && digitsInLine * 2 >= line.replaceAll(' ', '').length) {
        if (!isFax) {
          for (final m in pm) {
            final p = m.group(0)!.replaceAll(RegExp(r'[\s\-().]'), '');
            if (p.replaceAll('+', '').length >= 7 && !phones.contains(p)) phones.add(p);
          }
        }
        continue;
      }
      if (company == null && _companyHints.hasMatch(line)) {
        company = line;
        continue;
      }
      if (title == null && _titleHints.hasMatch(line)) {
        title = line;
        continue;
      }
      leftovers.add(line);
    }

    // Name: first leftover line that looks like 2–4 alphabetic words.
    String? name;
    for (final l in leftovers) {
      final words = l.split(RegExp(r'\s+'));
      final alpha = RegExp(r"^[A-Za-z][A-Za-z.'\-]*$");
      if (words.length >= 2 && words.length <= 4 && words.every(alpha.hasMatch)) {
        name = words.map((w) => w.length > 1 && w == w.toUpperCase() ? w[0] + w.substring(1).toLowerCase() : w).join(' ');
        break;
      }
    }
    if (company == null && leftovers.isNotEmpty) {
      final rest = leftovers.where((l) => l != name && !(name != null && l.toLowerCase() == name.toLowerCase())).toList();
      if (rest.isNotEmpty) company = rest.first;
    }
    return ParsedCard(name: name, phones: phones, email: email, company: company, jobTitle: title, website: website);
  }
}
