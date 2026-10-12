import 'enums.dart';
import 'sync_entity.dart';

/// A document in a client's Document Vault. Each record belongs to exactly
/// one client ([clientId]) and one category; files are AES-encrypted on disk.
/// A record without a file is a checklist placeholder (Pending / Requested).
class ClientDocument extends SyncEntity {
  const ClientDocument({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.clientId,
    required this.categoryId,
    this.title,
    this.status = DocumentStatus.pending,
    this.filePath,
    this.mimeType,
    this.remotePath,
    this.note,
    this.expiryDate,
    this.encrypted = true,
  });

  final String clientId;
  final String categoryId;

  /// User-visible file name (renameable). Falls back to the category name.
  final String? title;
  final DocumentStatus status;
  final String? filePath;
  final String? mimeType;
  final String? remotePath;
  final String? note;
  final DateTime? expiryDate;

  /// Whether [filePath] holds AES-GCM ciphertext (all new files do).
  final bool encrypted;

  bool get isPdf => (mimeType ?? '').contains('pdf');
  bool get isImage => (mimeType ?? '').startsWith('image/');
  bool get hasFile => filePath != null && filePath!.isNotEmpty;
  bool get isCollected => status.isCollected;

  /// Days until expiry (negative when expired), or null.
  int? daysToExpiry(DateTime now) =>
      expiryDate == null ? null : DateTime(expiryDate!.year, expiryDate!.month, expiryDate!.day).difference(DateTime(now.year, now.month, now.day)).inDays;

  /// Stable 31-bit base for expiry reminder notification ids (base+0..3).
  int get notificationBaseId {
    var h = 7;
    for (final c in id.codeUnits) {
      h = (h * 37 + c) & 0x0FFFFFFF;
    }
    return 0x10000000 + (h ~/ 8) * 8;
  }

  static const _unset = Object();

  ClientDocument copyWith({
    String? categoryId,
    Object? title = _unset,
    DocumentStatus? status,
    Object? filePath = _unset,
    Object? mimeType = _unset,
    Object? remotePath = _unset,
    Object? note = _unset,
    Object? expiryDate = _unset,
    bool? encrypted,
    bool? deleted,
  }) {
    T? pick<T>(Object? v, T? c) => identical(v, _unset) ? c : v as T?;
    return ClientDocument(
      id: id,
      createdAt: createdAt,
      updatedAt: updatedAt,
      deleted: deleted ?? this.deleted,
      clientId: clientId,
      categoryId: categoryId ?? this.categoryId,
      title: pick(title, this.title),
      status: status ?? this.status,
      filePath: pick(filePath, this.filePath),
      mimeType: pick(mimeType, this.mimeType),
      remotePath: pick(remotePath, this.remotePath),
      note: pick(note, this.note),
      expiryDate: pick(expiryDate, this.expiryDate),
      encrypted: encrypted ?? this.encrypted,
    );
  }

  @override
  Map<String, dynamic> fieldsToMap() => {
        'clientId': clientId,
        'categoryId': categoryId,
        'title': title,
        'status': status.name,
        'filePath': filePath,
        'mimeType': mimeType,
        'remotePath': remotePath,
        'note': note,
        'expiryDate': isoOrNull(expiryDate),
        'encrypted': encrypted,
      };

  /// Legacy records stored a `type` enum name; map it to a category id.
  static const _legacyTypes = {
    'emiratesId': 'emirates_id_front',
    'passport': 'passport',
    'visa': 'visa',
    'salaryCertificate': 'salary_certificate',
    'bankStatement': 'bank_statement',
    'labourContract': 'other',
    'custom': 'other',
  };

  factory ClientDocument.fromMap(Map m) => ClientDocument(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        clientId: MapRead.str(m, 'clientId'),
        categoryId: MapRead.strOrNull(m, 'categoryId') ?? _legacyTypes[m['type']] ?? 'other',
        title: MapRead.strOrNull(m, 'title') ?? MapRead.strOrNull(m, 'customName'),
        status: DocumentStatus.fromName(m['status']),
        filePath: MapRead.strOrNull(m, 'filePath'),
        mimeType: MapRead.strOrNull(m, 'mimeType'),
        remotePath: MapRead.strOrNull(m, 'remotePath'),
        note: MapRead.strOrNull(m, 'note'),
        expiryDate: MapRead.dateOrNull(m, 'expiryDate'),
        encrypted: MapRead.boolean(m, 'encrypted'),
      );
}
