import 'sync_entity.dart';

/// Reusable WhatsApp message. Supported tags: {CustomerName} {ProductName}
/// {Phone} {Location} {Salary} {Status} {FollowupDate}.
class MessageTemplate extends SyncEntity {
  const MessageTemplate({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.name,
    required this.body,
    this.isDefault = false,
    this.sortOrder = 0,
  });

  final String name;
  final String body;

  /// The template pre-selected in the send sheet (exactly one at a time).
  final bool isDefault;
  final int sortOrder;

  MessageTemplate copyWith({String? name, String? body, bool? isDefault, int? sortOrder, bool? deleted}) => MessageTemplate(
        id: id,
        createdAt: createdAt,
        updatedAt: updatedAt,
        deleted: deleted ?? this.deleted,
        name: name ?? this.name,
        body: body ?? this.body,
        isDefault: isDefault ?? this.isDefault,
        sortOrder: sortOrder ?? this.sortOrder,
      );

  @override
  Map<String, dynamic> fieldsToMap() => {'name': name, 'body': body, 'isDefault': isDefault, 'sortOrder': sortOrder};

  factory MessageTemplate.fromMap(Map m) => MessageTemplate(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        name: MapRead.str(m, 'name'),
        body: MapRead.str(m, 'body'),
        isDefault: MapRead.boolean(m, 'isDefault'),
        sortOrder: MapRead.integer(m, 'sortOrder'),
      );
}
