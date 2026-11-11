import '../../core/utils/phone_utils.dart';
import '../entities/client.dart';

enum DuplicateReason { phone, whatsapp, nameAndPhone, email }

class DuplicateMatch {
  const DuplicateMatch(this.existing, this.reason);
  final Client existing;
  final DuplicateReason reason;

  String get description => switch (reason) {
        DuplicateReason.phone => 'Same phone number as ${existing.name} (${existing.phone})',
        DuplicateReason.whatsapp => 'Same WhatsApp number as ${existing.name}',
        DuplicateReason.nameAndPhone => 'Same name and a very similar phone number as ${existing.name} (${existing.phone})',
        DuplicateReason.email => 'Same email as ${existing.name}',
      };
}

/// Finds a likely duplicate before a client is saved, and merges two records.
abstract final class DuplicateDetector {
  static String _name(String n) => n.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  /// Checks (in order): phone, WhatsApp number (against both phone and
  /// WhatsApp of existing clients), name + near-identical phone, email.
  static DuplicateMatch? find(Client candidate, Iterable<Client> existing) {
    final phone = candidate.phoneKey;
    final wa = (candidate.whatsapp == null || candidate.whatsapp!.trim().isEmpty) ? null : PhoneUtils.key(candidate.whatsapp!);
    final email = candidate.emailKey;
    final name = _name(candidate.name);
    final others = existing.where((c) => !c.deleted && c.id != candidate.id).toList();

    for (final c in others) {
      if (phone.length >= 7 && (c.phoneKey == phone || (c.whatsapp != null && PhoneUtils.key(c.whatsapp!) == phone))) {
        return DuplicateMatch(c, DuplicateReason.phone);
      }
    }
    if (wa != null && wa.length >= 7) {
      for (final c in others) {
        if (c.phoneKey == wa || (c.whatsapp != null && PhoneUtils.key(c.whatsapp!) == wa)) return DuplicateMatch(c, DuplicateReason.whatsapp);
      }
    }
    // Same name and the phone differs only in its last digits (typo / old number).
    if (name.length >= 3 && phone.length >= 7) {
      for (final c in others) {
        if (_name(c.name) == name && c.phoneKey.length >= 7 && c.phoneKey.substring(0, 6) == phone.substring(0, 6)) {
          return DuplicateMatch(c, DuplicateReason.nameAndPhone);
        }
      }
    }
    if (email != null) {
      for (final c in others) {
        if (c.emailKey == email) return DuplicateMatch(c, DuplicateReason.email);
      }
    }
    return null;
  }

  /// Keeps every non-empty field of [primary]; fills gaps from [other].
  /// Status keeps the more advanced pipeline stage; rating and priority the higher.
  static Client merge(Client primary, Client other, {DateTime? now}) {
    String? pickS(String? a, String? b) => (a == null || a.trim().isEmpty) ? b : a;
    T? pick<T>(T? a, T? b) => a ?? b;
    final status = primary.status.pipelineIndex >= other.status.pipelineIndex ? primary.status : other.status;
    final remarks = [primary.remarks, other.remarks].where((r) => r != null && r.trim().isNotEmpty).toSet().join('\n— merged —\n');
    return primary.copyWith(
      updatedAt: now ?? DateTime.now(),
      whatsapp: pickS(primary.whatsapp, other.whatsapp),
      email: pickS(primary.email, other.email),
      photoPath: pickS(primary.photoPath, other.photoPath),
      location: pickS(primary.location, other.location),
      latitude: pick(primary.latitude, other.latitude),
      longitude: pick(primary.longitude, other.longitude),
      company: pickS(primary.company, other.company),
      jobTitle: pickS(primary.jobTitle, other.jobTitle),
      nationality: pickS(primary.nationality, other.nationality),
      monthlySalary: pick(primary.monthlySalary, other.monthlySalary),
      productId: pickS(primary.productId, other.productId),
      status: status,
      priority: primary.priority.index >= other.priority.index ? primary.priority : other.priority,
      rating: primary.rating >= other.rating ? primary.rating : other.rating,
      remarks: remarks.isEmpty ? null : remarks,
      requestedAmount: pick(primary.requestedAmount, other.requestedAmount),
    );
  }
}
