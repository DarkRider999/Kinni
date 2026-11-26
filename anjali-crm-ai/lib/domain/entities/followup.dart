import 'enums.dart';
import 'sync_entity.dart';

/// A scheduled followup with up to four reminders.
class Followup extends SyncEntity {
  const Followup({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.clientId,
    required this.dueAt,
    this.note,
    this.status = FollowupStatus.pending,
    this.completedAt,
    this.missedNotified = false,
  });

  final String clientId;
  final DateTime dueAt;
  final String? note;
  final FollowupStatus status;
  final DateTime? completedAt;
  final bool missedNotified;

  bool get isPending => status == FollowupStatus.pending;
  bool isOverdue(DateTime now) => isPending && dueAt.isBefore(now);

  /// Stable 31-bit base id for the 4 notification slots (base + 0..3) and
  /// the missed-reminder slot (base + 4).
  int get notificationBaseId {
    var h = 0;
    for (final c in id.codeUnits) {
      h = (h * 31 + c) & 0x0FFFFFFF;
    }
    return (h ~/ 8) * 8;
  }

  Followup copyWith({
    DateTime? dueAt,
    String? note,
    FollowupStatus? status,
    DateTime? completedAt,
    bool? missedNotified,
    bool? deleted,
  }) =>
      Followup(
        id: id,
        createdAt: createdAt,
        updatedAt: updatedAt,
        deleted: deleted ?? this.deleted,
        clientId: clientId,
        dueAt: dueAt ?? this.dueAt,
        note: note ?? this.note,
        status: status ?? this.status,
        completedAt: completedAt ?? this.completedAt,
        missedNotified: missedNotified ?? this.missedNotified,
      );

  @override
  Map<String, dynamic> fieldsToMap() => {
        'clientId': clientId,
        'dueAt': isoOrNull(dueAt),
        'note': note,
        'status': status.name,
        'completedAt': isoOrNull(completedAt),
        'missedNotified': missedNotified,
      };

  factory Followup.fromMap(Map m) => Followup(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        clientId: MapRead.str(m, 'clientId'),
        dueAt: MapRead.date(m, 'dueAt'),
        note: MapRead.strOrNull(m, 'note'),
        status: FollowupStatus.fromName(m['status']),
        completedAt: MapRead.dateOrNull(m, 'completedAt'),
        missedNotified: MapRead.boolean(m, 'missedNotified'),
      );
}
