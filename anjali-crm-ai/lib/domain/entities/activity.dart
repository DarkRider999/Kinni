import 'enums.dart';
import 'sync_entity.dart';

/// Append-only timeline event.
class Activity extends SyncEntity {
  const Activity({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    this.clientId,
    required this.type,
    required this.title,
    this.detail,
    this.fromStatus,
    this.toStatus,
    required this.at,
  });

  final String? clientId;
  final ActivityType type;
  final String title;
  final String? detail;
  final LeadStatus? fromStatus;
  final LeadStatus? toStatus;
  final DateTime at;

  @override
  Map<String, dynamic> fieldsToMap() => {
        'clientId': clientId,
        'type': type.name,
        'title': title,
        'detail': detail,
        'fromStatus': fromStatus?.name,
        'toStatus': toStatus?.name,
        'at': isoOrNull(at),
      };

  factory Activity.fromMap(Map m) => Activity(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        clientId: MapRead.strOrNull(m, 'clientId'),
        type: ActivityType.fromName(m['type']),
        title: MapRead.str(m, 'title'),
        detail: MapRead.strOrNull(m, 'detail'),
        fromStatus: m['fromStatus'] == null ? null : LeadStatus.fromName(m['fromStatus']),
        toStatus: m['toStatus'] == null ? null : LeadStatus.fromName(m['toStatus']),
        at: MapRead.date(m, 'at'),
      );
}
