import 'sync_entity.dart';

/// Audio recording and/or dictated transcript attached to a client.
class VoiceNote extends SyncEntity {
  const VoiceNote({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.clientId,
    this.filePath,
    this.durationMs = 0,
    this.transcript,
    this.remotePath,
  });

  final String clientId;
  final String? filePath;
  final int durationMs;
  final String? transcript;
  final String? remotePath;

  bool get hasAudio => filePath != null && filePath!.isNotEmpty;

  VoiceNote copyWith({String? transcript, String? remotePath, String? filePath}) => VoiceNote(
        id: id,
        createdAt: createdAt,
        updatedAt: updatedAt,
        deleted: deleted,
        clientId: clientId,
        filePath: filePath ?? this.filePath,
        durationMs: durationMs,
        transcript: transcript ?? this.transcript,
        remotePath: remotePath ?? this.remotePath,
      );

  @override
  Map<String, dynamic> fieldsToMap() => {
        'clientId': clientId,
        'filePath': filePath,
        'durationMs': durationMs,
        'transcript': transcript,
        'remotePath': remotePath,
      };

  factory VoiceNote.fromMap(Map m) => VoiceNote(
        id: MapRead.str(m, 'id'),
        createdAt: MapRead.date(m, 'createdAt'),
        updatedAt: MapRead.date(m, 'updatedAt'),
        deleted: MapRead.boolean(m, 'deleted'),
        clientId: MapRead.str(m, 'clientId'),
        filePath: MapRead.strOrNull(m, 'filePath'),
        durationMs: MapRead.integer(m, 'durationMs'),
        transcript: MapRead.strOrNull(m, 'transcript'),
        remotePath: MapRead.strOrNull(m, 'remotePath'),
      );
}
