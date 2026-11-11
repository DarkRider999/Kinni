/// Base contract for every record that lives in a Hive box and syncs to
/// Firestore. See docs/03-database-design.md §2.
abstract class SyncEntity {
  const SyncEntity({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deleted = false,
  });

  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool deleted;

  /// Entity-specific fields. The repository adds the sync columns.
  Map<String, dynamic> fieldsToMap();

  /// Full persisted map (without the local-only `dirty` flag).
  Map<String, dynamic> toMap() => {
        ...fieldsToMap(),
        'id': id,
        'createdAt': createdAt.toUtc().toIso8601String(),
        'updatedAt': updatedAt.toUtc().toIso8601String(),
        'deleted': deleted,
      };
}

/// Decoding helpers tolerant of missing / mistyped values.
abstract final class MapRead {
  static String str(Map m, String k, [String fallback = '']) {
    final v = m[k];
    return v == null ? fallback : v.toString();
  }

  static String? strOrNull(Map m, String k) {
    final v = m[k];
    if (v == null) return null;
    final s = v.toString();
    return s.isEmpty ? null : s;
  }

  static int integer(Map m, String k, [int fallback = 0]) {
    final v = m[k];
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? fallback;
  }

  static double? dbl(Map m, String k) {
    final v = m[k];
    if (v is num) return v.toDouble();
    if (v == null) return null;
    return double.tryParse('$v');
  }

  static bool boolean(Map m, String k, [bool fallback = false]) {
    final v = m[k];
    if (v is bool) return v;
    if (v is String) return v == 'true';
    return fallback;
  }

  static DateTime date(Map m, String k, [DateTime? fallback]) =>
      dateOrNull(m, k) ?? fallback ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

  static DateTime? dateOrNull(Map m, String k) {
    final v = m[k];
    if (v is DateTime) return v;
    if (v is String && v.isNotEmpty) return DateTime.tryParse(v)?.toLocal();
    if (v is int) return DateTime.fromMillisecondsSinceEpoch(v);
    return null;
  }
}

String? isoOrNull(DateTime? d) => d?.toUtc().toIso8601String();
