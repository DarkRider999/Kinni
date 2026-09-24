import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

import 'models.dart';

/// Base URL: `--dart-define=NF_API_URL=https://api.neonforge.ai`. The Android emulator reaches the
/// host machine at 10.0.2.2.
const String kApiUrl = String.fromEnvironment('NF_API_URL', defaultValue: 'http://10.0.2.2:8000');

class ApiClient {
  ApiClient({http.Client? httpClient, this.baseUrl = kApiUrl}) : _http = httpClient ?? http.Client();

  final http.Client _http;
  final String baseUrl;
  String? token;

  Map<String, String> get _headers => {
        if (token != null) 'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final req = http.Request(method, Uri.parse('$baseUrl/v1$path'))..headers.addAll(_headers);
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _http.send(req));
    if (res.statusCode == 204) return null;
    final data = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final err = (data is Map ? data['error'] : null) as Map<String, dynamic>? ?? {};
      throw ApiException(res.statusCode, (err['code'] ?? 'HTTP_ERROR') as String,
          (err['message'] ?? 'Request failed (${res.statusCode})') as String);
    }
    return data;
  }

  Future<(String, Me)> devLogin(String email, String plan) async {
    final r = await _send('POST', '/auth/dev-login', {'email': email, 'plan': plan}) as Map<String, dynamic>;
    return (r['access_token'] as String, Me.fromJson(r['user'] as Map<String, dynamic>));
  }

  Future<Me> me() async => Me.fromJson(await _send('GET', '/me') as Map<String, dynamic>);

  Future<Map<String, dynamic>> settings() async => await _send('GET', '/me/settings') as Map<String, dynamic>;
  Future<Map<String, dynamic>> putSettings(Map<String, dynamic> s) async =>
      await _send('PUT', '/me/settings', s) as Map<String, dynamic>;

  Future<List<MediaFile>> files({String? kind}) async {
    final r = await _send('GET', '/files${kind != null ? '?kind=$kind' : ''}') as Map<String, dynamic>;
    return (r['items'] as List).map((e) => MediaFile.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<MediaFile> file(String id) async => MediaFile.fromJson(await _send('GET', '/files/$id') as Map<String, dynamic>);

  /// Streams the file from disk (videos can be large) and reports progress.
  Future<MediaFile> upload(File file, {void Function(double)? onProgress}) async {
    final length = await file.length();
    var sent = 0;
    final stream = file.openRead().transform(StreamTransformer<List<int>, List<int>>.fromHandlers(
      handleData: (chunk, sink) {
        sent += chunk.length;
        onProgress?.call(sent / length);
        sink.add(chunk);
      },
    ));
    final req = http.MultipartRequest('POST', Uri.parse('$baseUrl/v1/files'))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'})
      ..files.add(http.MultipartFile('file', stream, length, filename: file.uri.pathSegments.last));
    final res = await http.Response.fromStream(await _http.send(req));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) {
      final err = data['error'] as Map<String, dynamic>? ?? {};
      throw ApiException(res.statusCode, (err['code'] ?? 'UPLOAD_FAILED') as String,
          (err['message'] ?? 'Upload failed') as String);
    }
    return MediaFile.fromJson(data);
  }

  Future<List<Preset>> presets() async {
    final r = await _send('GET', '/presets') as Map<String, dynamic>;
    return (r['items'] as List).map((e) => Preset.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<int> estimate(Map<String, dynamic> recipe, List<String> fileIds) async {
    final r = await _send('POST', '/recipes/estimate', {'recipe': recipe, 'file_ids': fileIds}) as Map<String, dynamic>;
    return r['total_credits'] as int;
  }

  Future<Job> preview(String fileId, Map<String, dynamic> recipe, {int atMs = 0}) async =>
      Job.fromJson(await _send('POST', '/previews', {'file_id': fileId, 'recipe': recipe, 'at_ms': atMs})
          as Map<String, dynamic>);

  Future<Job> render(String fileId, Map<String, dynamic> recipe) async =>
      Job.fromJson(await _send('POST', '/jobs', {'file_id': fileId, 'recipe': recipe}) as Map<String, dynamic>);

  Future<Job> job(String id) async => Job.fromJson(await _send('GET', '/jobs/$id') as Map<String, dynamic>);

  Future<Batch> createBatch(List<String> fileIds, Map<String, dynamic> recipe, {String? name}) async =>
      Batch.fromJson(await _send('POST', '/batches', {'file_ids': fileIds, 'recipe': recipe, 'name': name})
          as Map<String, dynamic>);

  Future<List<Batch>> batches() async {
    final r = await _send('GET', '/batches') as Map<String, dynamic>;
    return (r['items'] as List).map((e) => Batch.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Batch> batch(String id) async => Batch.fromJson(await _send('GET', '/batches/$id') as Map<String, dynamic>);

  Future<List<Job>> batchJobs(String id) async {
    final r = await _send('GET', '/batches/$id/jobs') as Map<String, dynamic>;
    return (r['items'] as List).map((e) => Job.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Batch> batchAction(String id, String action) async =>
      Batch.fromJson(await _send('POST', '/batches/$id/$action') as Map<String, dynamic>);

  Future<String> batchZipUrl(String id) async =>
      ((await _send('POST', '/batches/$id/download')) as Map<String, dynamic>)['url'] as String;

  Future<List<int>> download(String url) async {
    final res = await _http.get(Uri.parse(url));
    if (res.statusCode != 200) throw ApiException(res.statusCode, 'DOWNLOAD_FAILED', 'Download failed');
    return res.bodyBytes;
  }

  /// Live job/batch events; the caller handles reconnects.
  Stream<ServerEvent> events() {
    final ws = WebSocketChannel.connect(
        Uri.parse('${baseUrl.replaceFirst('http', 'ws')}/v1/ws?token=${Uri.encodeComponent(token ?? '')}'));
    return ws.stream.map((m) => ServerEvent(jsonDecode(m as String) as Map<String, dynamic>));
  }
}
