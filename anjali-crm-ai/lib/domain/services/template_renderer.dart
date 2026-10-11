/// Fills `{placeholder}` tokens in WhatsApp templates.
abstract final class TemplateRenderer {
  static const placeholders = ['name', 'product', 'agent', 'date', 'documents'];

  /// Unknown or empty placeholders are removed cleanly (no stray braces),
  /// and doubled spaces left behind are collapsed.
  static String render(String body, Map<String, String> vars) {
    final out = body.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => vars[m.group(1)] ?? '');
    return out.replaceAll(RegExp(r'[ \t]{2,}'), ' ').replaceAll(RegExp(r' ([,.!?])'), r'$1').trim();
  }
}
