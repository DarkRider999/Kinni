import '../../core/utils/formatters.dart';
import '../entities/client.dart';

/// Replaces template tags with client values when a message is sent.
abstract final class TemplateRenderer {
  static const tags = ['{CustomerName}', '{ProductName}', '{Phone}', '{Location}', '{Salary}', '{Status}', '{FollowupDate}'];

  static Map<String, String> valuesFor(Client c, {String? productName}) => {
        'CustomerName': c.name,
        'ProductName': productName ?? '',
        'Phone': c.phone,
        'Location': c.location ?? '',
        'Salary': c.monthlySalary == null ? '' : Fmt.aed(c.monthlySalary),
        'Status': c.status.label,
        'FollowupDate': c.nextFollowupAt == null ? '' : Fmt.dateTime(c.nextFollowupAt!),
      };

  /// Unknown tags are left untouched so typos stay visible; known tags
  /// with no value become empty, and the doubled spaces this leaves are tidied.
  static String render(String body, Map<String, String> values) {
    final out = body.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values[m.group(1)] ?? m.group(0)!);
    return out.replaceAll(RegExp(r'[ \t]{2,}'), ' ').replaceAllMapped(RegExp(r' ([,.!?])'), (m) => m.group(1)!).trim();
  }

  /// Plain-text client summary for "Share client details".
  static String clientSummary(Client c, {String? productName}) => [
        'Customer: ${c.name}',
        'Phone: ${c.phone}',
        if (productName != null && productName.isNotEmpty) 'Product: $productName',
        'Status: ${c.status.label}',
        if (c.remarks != null && c.remarks!.trim().isNotEmpty) 'Remarks: ${c.remarks!.trim()}',
      ].join('\n');
}
