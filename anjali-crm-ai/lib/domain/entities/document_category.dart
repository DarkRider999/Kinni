import 'sync_entity.dart';

/// A folder inside every client's Document Vault (Passport, Visa…).
/// Built-in categories have stable ids so product checklists can refer to them.
class DocumentCategory extends SyncEntity {
  const DocumentCategory({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.name,
    this.sortOrder = 0,
    this.supportsExpiry = false,
  });

  final String name;
  final int sortOrder;

  /// Whether documents in this category usually carry an expiry date.
  final bool supportsExpiry;

  // Stable ids of the default categories.
  static const passport = 'passport';
  static const emiratesIdFront = 'emirates_id_front';
  static const emiratesIdBack = 'emirates_id_back';
  static const visa = 'visa';
  static const salaryCertificate = 'salary_certificate';
  static const bankStatement = 'bank_statement';
  static const creditCardForm = 'credit_card_form';
  static const loanApplicationForm = 'loan_application_form';
  static const tradeLicense = 'trade_license';
  static const other = 'other';

  DocumentCategory copyWith({String? name, int? sortOrder, bool? supportsExpiry, bool? deleted}) => DocumentCategory(
        id: id,
        createdAt: createdAt,
        updatedAt: updatedAt,
        deleted: deleted ?? this.deleted,
        name: name ?? this.name,
        sortOrder: sortOrder ?? this.sortOrder,
        supportsExpiry: supportsExpiry ?? this.supportsExpiry,
      );

  @override
  Map<String, dynamic> fieldsToMap() => {'name': name, 'sortOrder': sortOrder, 'supportsExpiry': supportsExpiry};

  factory DocumentCategory.fromMap(Map m) => DocumentCategory(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        name: MapRead.str(m, 'name'),
        sortOrder: MapRead.integer(m, 'sortOrder'),
        supportsExpiry: MapRead.boolean(m, 'supportsExpiry'),
      );
}
