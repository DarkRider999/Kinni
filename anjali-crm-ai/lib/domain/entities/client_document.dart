import 'enums.dart';
import 'sync_entity.dart';

/// A document collected for a client's application.
class ClientDocument extends SyncEntity {
  const ClientDocument({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.clientId,
    required this.type,
    this.customName,
    this.status = DocumentStatus.pending,
    this.filePath,
    this.mimeType,
    this.remotePath,
    this.note,
  });

  final String clientId;
  final DocumentType type;
  final String? customName;
  final DocumentStatus status;
  final String? filePath;
  final String? mimeType;
  final String? remotePath;
  final String? note;

  String get displayName => type == DocumentType.custom ? (customName ?? 'Document') : type.label;
  bool get isPdf => (mimeType ?? '').contains('pdf') || (filePath ?? '').toLowerCase().endsWith('.pdf');
  bool get hasFile => filePath != null && filePath!.isNotEmpty;

  static const _unset = Object();

  ClientDocument copyWith({
    DocumentStatus? status,
    Object? filePath = _unset,
    Object? mimeType = _unset,
    Object? remotePath = _unset,
    Object? note = _unset,
    String? customName,
    bool? deleted,
  }) {
    T? pick<T>(Object? v, T? c) => identical(v, _unset) ? c : v as T?;
    return ClientDocument(
      id: id,
      createdAt: createdAt,
      updatedAt: updatedAt,
      deleted: deleted ?? this.deleted,
      clientId: clientId,
      type: type,
      customName: customName ?? this.customName,
      status: status ?? this.status,
      filePath: pick(filePath, this.filePath),
      mimeType: pick(mimeType, this.mimeType),
      remotePath: pick(remotePath, this.remotePath),
      note: pick(note, this.note),
    );
  }

  @override
  Map<String, dynamic> fieldsToMap() => {
        'clientId': clientId,
        'type': type.name,
        'customName': customName,
        'status': status.name,
        'filePath': filePath,
        'mimeType': mimeType,
        'remotePath': remotePath,
        'note': note,
      };

  factory ClientDocument.fromMap(Map m) => ClientDocument(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        clientId: MapRead.str(m, 'clientId'),
        type: DocumentType.fromName(m['type']),
        customName: MapRead.strOrNull(m, 'customName'),
        status: DocumentStatus.fromName(m['status']),
        filePath: MapRead.strOrNull(m, 'filePath'),
        mimeType: MapRead.strOrNull(m, 'mimeType'),
        remotePath: MapRead.strOrNull(m, 'remotePath'),
        note: MapRead.strOrNull(m, 'note'),
      );
}
