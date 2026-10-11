import 'enums.dart';
import 'sync_entity.dart';

/// Reusable WhatsApp message. Placeholders: {name} {product} {agent} {date} {documents}.
class WhatsAppTemplate extends SyncEntity {
  const WhatsAppTemplate({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.name,
    required this.category,
    required this.body,
    this.isDefault = false,
  });

  final String name;
  final TemplateCategory category;
  final String body;
  final bool isDefault;

  WhatsAppTemplate copyWith({String? name, TemplateCategory? category, String? body, bool? deleted}) =>
      WhatsAppTemplate(
        id: id,
        createdAt: createdAt,
        updatedAt: updatedAt,
        deleted: deleted ?? this.deleted,
        name: name ?? this.name,
        category: category ?? this.category,
        body: body ?? this.body,
        isDefault: isDefault,
      );

  @override
  Map<String, dynamic> fieldsToMap() => {
        'name': name,
        'category': category.name,
        'body': body,
        'isDefault': isDefault,
      };

  factory WhatsAppTemplate.fromMap(Map m) => WhatsAppTemplate(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        name: MapRead.str(m, 'name'),
        category: TemplateCategory.fromName(m['category']),
        body: MapRead.str(m, 'body'),
        isDefault: MapRead.boolean(m, 'isDefault'),
      );
}
