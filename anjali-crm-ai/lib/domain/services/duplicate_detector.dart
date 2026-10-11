import '../../core/utils/phone_utils.dart';
import '../entities/client.dart';

enum DuplicateReason { phone, email, whatsapp }

class DuplicateMatch {
  const DuplicateMatch(this.existing, this.reason);
  final Client existing;
  final DuplicateReason reason;

  String get description => switch (reason) {
        DuplicateReason.phone => 'Same phone number as ${existing.name}',
        DuplicateReason.email => 'Same email as ${existing.name}',
        DuplicateReason.whatsapp => 'Same WhatsApp number as ${existing.name}',
      };
}

/// Finds an existing client with the same phone / WhatsApp / email and
/// merges two client records.
abstract final class DuplicateDetector {
  static DuplicateMatch? find(Client candidate, Iterable<Client> existing) {
    final phone = candidate.phoneKey;
    final wa = candidate.whatsapp == null ? null : PhoneUtils.key(candidate.whatsapp!);
    final email = candidate.emailKey;
    for (final c in existing) {
      if (c.deleted || c.id == candidate.id) continue;
      if (phone.length >= 7 && (c.phoneKey == phone)) return DuplicateMatch(c, DuplicateReason.phone);
      if (email != null && c.emailKey == email) return DuplicateMatch(c, DuplicateReason.email);
      if (wa != null && wa.length >= 7 && c.phoneKey == wa) return DuplicateMatch(c, DuplicateReason.whatsapp);
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
