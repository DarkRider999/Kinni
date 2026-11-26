import 'enums.dart';
import 'sync_entity.dart';

/// Outcome of a phone call made from the app.
class CallLog extends SyncEntity {
  const CallLog({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.clientId,
    required this.calledAt,
    required this.outcome,
    this.note,
    this.durationSeconds,
  });

  final String clientId;
  final DateTime calledAt;
  final CallOutcome outcome;
  final String? note;
  final int? durationSeconds;

  @override
  Map<String, dynamic> fieldsToMap() => {
        'clientId': clientId,
        'calledAt': isoOrNull(calledAt),
        'outcome': outcome.name,
        'note': note,
        'durationSeconds': durationSeconds,
      };

  factory CallLog.fromMap(Map m) => CallLog(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        clientId: MapRead.str(m, 'clientId'),
        calledAt: MapRead.date(m, 'calledAt'),
        outcome: CallOutcome.fromName(m['outcome']),
        note: MapRead.strOrNull(m, 'note'),
        durationSeconds: m['durationSeconds'] == null ? null : MapRead.integer(m, 'durationSeconds'),
      );
}
