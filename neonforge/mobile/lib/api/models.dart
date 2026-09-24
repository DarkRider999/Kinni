// Mirrors the backend API (neonforge/backend, spec §5).

class Plan {
  Plan.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        name = j['name'] as String,
        monthlyCredits = j['monthly_credits'] as int,
        maxBatchFiles = j['max_batch_files'] as int,
        maxVideoSeconds = j['max_video_seconds'] as int,
        maxUploadMb = j['max_upload_mb'] as int,
        maxOutputRes = j['max_output_res'] as String,
        maxUpscale = j['max_upscale'] as int,
        watermark = j['watermark'] as bool;

  final String id, name, maxOutputRes;
  final int monthlyCredits, maxBatchFiles, maxVideoSeconds, maxUploadMb, maxUpscale;
  final bool watermark;
}

class Me {
  Me.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        email = j['email'] as String,
        displayName = (j['display_name'] ?? '') as String,
        plan = Plan.fromJson(j['plan'] as Map<String, dynamic>),
        credits = j['credits'] as int;

  final String id, email, displayName;
  final Plan plan;
  final int credits;
}

class MediaFile {
  MediaFile.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        kind = j['kind'] as String,
        originalName = j['original_name'] as String,
        sizeBytes = j['size_bytes'] as int,
        width = j['width'] as int?,
        height = j['height'] as int?,
        durationMs = j['duration_ms'] as int?,
        faceCount = ((j['analysis'] as Map<String, dynamic>?)?['face_count'] ?? 0) as int,
        url = j['url'] as String,
        thumbUrl = j['thumb_url'] as String?;

  final String id, kind, originalName, url;
  final String? thumbUrl;
  final int sizeBytes, faceCount;
  final int? width, height, durationMs;

  bool get isImage => kind == 'image';
}

class Output {
  Output.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        format = j['format'] as String,
        mimeType = j['mime_type'] as String,
        width = j['width'] as int?,
        height = j['height'] as int?,
        sizeBytes = j['size_bytes'] as int,
        filename = j['filename'] as String,
        url = j['url'] as String,
        downloadUrl = j['download_url'] as String;

  final String id, format, mimeType, filename, url, downloadUrl;
  final int? width, height;
  final int sizeBytes;
}

class Job {
  Job.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        batchId = j['batch_id'] as String?,
        fileId = j['file_id'] as String,
        kind = j['kind'] as String,
        status = j['status'] as String,
        stage = j['stage'] as String?,
        progress = (j['progress'] as num).toDouble(),
        creditsCost = (j['credits_cost'] ?? 0) as int,
        errorMessage = (j['error'] as Map<String, dynamic>?)?['message'] as String?,
        outputs = ((j['outputs'] as List?) ?? []).map((o) => Output.fromJson(o as Map<String, dynamic>)).toList();

  final String id, fileId, kind, status;
  final String? batchId, stage, errorMessage;
  final double progress;
  final int creditsCost;
  final List<Output> outputs;

  bool get isFinal => const {'succeeded', 'failed', 'cancelled'}.contains(status);
}

class Batch {
  Batch.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        name = (j['name'] ?? 'Batch') as String,
        status = j['status'] as String,
        totalFiles = j['total_files'] as int,
        doneFiles = j['done_files'] as int,
        failedFiles = j['failed_files'] as int,
        progress = (j['progress'] as num).toDouble(),
        creditsReserved = j['credits_reserved'] as int,
        creditsSpent = j['credits_spent'] as int;

  final String id, name, status;
  final int totalFiles, doneFiles, failedFiles, creditsReserved, creditsSpent;
  final double progress;
}

class Preset {
  Preset.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        category = j['category'] as String,
        name = j['name'] as String,
        payload = j['payload'] as Map<String, dynamic>;

  final String id, category, name;
  final Map<String, dynamic> payload;
}

/// A live `job.progress` / `batch.progress` event from the WebSocket.
class ServerEvent {
  ServerEvent(this.data);
  final Map<String, dynamic> data;
  String get type => data['type'] as String? ?? '';
  String? get jobId => data['job_id'] as String?;
  String? get batchId => type == 'batch.progress' ? data['id'] as String? : data['batch_id'] as String?;
  String get status => data['status'] as String? ?? '';
  double get progress => (data['progress'] as num?)?.toDouble() ?? 0;
  String? get stage => data['stage'] as String?;
}

class ApiException implements Exception {
  ApiException(this.status, this.code, this.message);
  final int status;
  final String code, message;
  @override
  String toString() => message;
}
