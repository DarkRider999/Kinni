import 'enums.dart';
import 'sync_entity.dart';

/// Local-only security audit entry (never synced).
class SecurityEvent extends SyncEntity {
  const SecurityEvent({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.type,
    required this.at,
    this.photoPath,
    this.detail,
  });

  final SecurityEventType type;
  final DateTime at;
  final String? photoPath;
  final String? detail;

  @override
  Map<String, dynamic> fieldsToMap() => {
        'type': type.name,
        'at': isoOrNull(at),
        'photoPath': photoPath,
        'detail': detail,
      };

  factory SecurityEvent.fromMap(Map m) => SecurityEvent(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        type: SecurityEventType.fromName(m['type']),
        at: MapRead.date(m, 'at'),
        photoPath: MapRead.strOrNull(m, 'photoPath'),
        detail: MapRead.strOrNull(m, 'detail'),
      );
}
