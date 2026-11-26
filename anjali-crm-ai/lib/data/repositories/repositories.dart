import '../../core/utils/phone_utils.dart';
import '../../domain/entities/activity.dart';
import '../../domain/entities/call_log.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/document_category.dart';
import '../../domain/entities/message_template.dart';
import '../../domain/entities/followup.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/security_event.dart';
import '../../domain/entities/voice_note.dart';
import '../local/hive_repository.dart';

typedef ClientRepository = HiveRepository<Client>;
typedef ProductRepository = HiveRepository<Product>;
typedef FollowupRepository = HiveRepository<Followup>;
typedef CallLogRepository = HiveRepository<CallLog>;
typedef VoiceNoteRepository = HiveRepository<VoiceNote>;
typedef DocumentRepository = HiveRepository<ClientDocument>;
typedef ActivityRepository = HiveRepository<Activity>;
typedef TemplateRepository = HiveRepository<MessageTemplate>;
typedef CategoryRepository = HiveRepository<DocumentCategory>;
typedef SecurityLogRepository = HiveRepository<SecurityEvent>;

/// Client-specific queries.
extension ClientQueries on HiveRepository<Client> {
  Client? findByPhone(String phone) {
    final key = PhoneUtils.key(phone);
    if (key.length < 7) return null;
    for (final c in getAll()) {
      if (c.phoneKey == key) return c;
    }
    return null;
  }

  /// Global search across name, phone, company, salary, location, product,
  /// status. Ranked: phone match > name prefix > contains.
  List<Client> search(String query, {Map<String, String> productNames = const {}}) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    // "10k-20k", "10000-20000", ">15k", "<8k": salary range search.
    final range = SalaryRange.tryParse(q);
    if (range != null) {
      final hits = getAll().where((c) => !c.deleted && c.monthlySalary != null && range.contains(c.monthlySalary!)).toList()
        ..sort((a, b) => b.monthlySalary!.compareTo(a.monthlySalary!));
      return hits;
    }
    final qDigits = PhoneUtils.digits(q);
    final scored = <(Client, int)>[];
    for (final c in getAll()) {
      var rank = 0;
      final name = c.name.toLowerCase();
      if (qDigits.length >= 3 && (PhoneUtils.digits(c.phone).contains(qDigits) || PhoneUtils.digits(c.whatsapp ?? '').contains(qDigits))) {
        rank = 100;
      } else if (name.startsWith(q)) {
        rank = 80;
      } else if (name.split(' ').any((w) => w.startsWith(q))) {
        rank = 70;
      } else {
        final hay = [
          name,
          c.company,
          c.location,
          c.email,
          c.jobTitle,
          c.nationality,
          c.status.label,
          productNames[c.productId],
          c.monthlySalary?.toStringAsFixed(0),
          c.remarks,
        ].whereType<String>().join(' | ').toLowerCase();
        if (hay.contains(q)) rank = 40;
      }
      if (rank > 0) scored.add((c, rank));
    }
    scored.sort((a, b) {
      final r = b.$2.compareTo(a.$2);
      return r != 0 ? r : a.$1.name.compareTo(b.$1.name);
    });
    return [for (final s in scored) s.$1];
  }
}

extension FollowupQueries on HiveRepository<Followup> {
  List<Followup> forClient(String id) => getAll().where((f) => f.clientId == id).toList()..sort((a, b) => b.dueAt.compareTo(a.dueAt));
  List<Followup> pending() => getAll().where((f) => f.isPending).toList();
  Followup? nextPendingFor(String clientId) {
    final l = getAll().where((f) => f.clientId == clientId && f.isPending).toList()..sort((a, b) => a.dueAt.compareTo(b.dueAt));
    return l.isEmpty ? null : l.first;
  }
}

extension DocumentQueries on HiveRepository<ClientDocument> {
  List<ClientDocument> forClient(String id) => getAll().where((d) => d.clientId == id).toList();
  List<ClientDocument> inCategory(String clientId, String categoryId) =>
      forClient(clientId).where((d) => d.categoryId == categoryId).toList()..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
}

extension ProductQueries on HiveRepository<Product> {
  List<Product> active() => getAll().where((p) => p.active).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  Map<String, String> names() => {for (final p in getAll(includeDeleted: true)) p.id: p.name};
}


/// Monthly-salary range typed into search: "10k-20k", "10000 - 20000",
/// ">15k", "<8000", "15k+". Returns null for anything else.
class SalaryRange {
  const SalaryRange(this.min, this.max);
  final double min;
  final double max;

  bool contains(double v) => v >= min && v <= max;

  static double? _amount(String s) {
    final m = RegExp(r'^(\d+(?:\.\d+)?)\s*(k)?$').firstMatch(s.trim());
    if (m == null) return null;
    final n = double.parse(m.group(1)!);
    return m.group(2) != null ? n * 1000 : n;
  }

  static SalaryRange? tryParse(String input) {
    final q = input.trim().toLowerCase().replaceAll(',', '').replaceAll('aed', '').trim();
    final between = RegExp(r'^(\d+(?:\.\d+)?\s*k?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?\s*k?)$').firstMatch(q);
    if (between != null) {
      final a = _amount(between.group(1)!);
      final b = _amount(between.group(2)!);
      if (a == null || b == null) return null;
      return a <= b ? SalaryRange(a, b) : SalaryRange(b, a);
    }
    if (q.startsWith('>')) {
      final a = _amount(q.substring(1));
      return a == null ? null : SalaryRange(a, double.infinity);
    }
    if (q.endsWith('+')) {
      final a = _amount(q.substring(0, q.length - 1));
      return a == null ? null : SalaryRange(a, double.infinity);
    }
    if (q.startsWith('<')) {
      final a = _amount(q.substring(1));
      return a == null ? null : SalaryRange(0, a);
    }
    return null;
  }
}
