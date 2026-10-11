import 'sync_entity.dart';

/// A product / category Anjali sells (Personal Loan, Credit Card…).
class Product extends SyncEntity {
  const Product({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.name,
    this.iconCode = 0,
    this.colorValue = 0xFF6C63FF,
    this.active = true,
    this.sortOrder = 0,
  });

  final String name;
  final int iconCode;
  final int colorValue;
  final bool active;
  final int sortOrder;

  Product copyWith({String? name, int? iconCode, int? colorValue, bool? active, int? sortOrder, bool? deleted}) =>
      Product(
        id: id,
        createdAt: createdAt,
        updatedAt: updatedAt,
        deleted: deleted ?? this.deleted,
        name: name ?? this.name,
        iconCode: iconCode ?? this.iconCode,
        colorValue: colorValue ?? this.colorValue,
        active: active ?? this.active,
        sortOrder: sortOrder ?? this.sortOrder,
      );

  @override
  Map<String, dynamic> fieldsToMap() => {
        'name': name,
        'iconCode': iconCode,
        'colorValue': colorValue,
        'active': active,
        'sortOrder': sortOrder,
      };

  factory Product.fromMap(Map m) => Product(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        name: MapRead.str(m, 'name'),
        iconCode: MapRead.integer(m, 'iconCode'),
        colorValue: MapRead.integer(m, 'colorValue', 0xFF6C63FF),
        active: MapRead.boolean(m, 'active', true),
        sortOrder: MapRead.integer(m, 'sortOrder'),
      );
}
