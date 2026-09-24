import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:neonforge/api/client.dart';
import 'package:neonforge/main.dart';
import 'package:neonforge/picker.dart';
import 'package:neonforge/screens/upload.dart';
import 'package:neonforge/state.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakePicker implements MediaPicker {
  FakePicker(this.files);
  final List<File> files;
  @override
  Future<List<File>> pickFiles({required bool multiple}) async => files;
  @override
  Future<List<File>> pickFolder() async => files;
}

Map<String, dynamic> plan = {
  'id': 'pro', 'name': 'Pro', 'monthly_credits': 1500, 'max_batch_files': 200, 'max_video_seconds': 600,
  'max_upload_mb': 2048, 'max_output_res': '4k', 'max_upscale': 4, 'watermark': false,
};
Map<String, dynamic> user = {'id': 'u1', 'email': 'a@b.co', 'display_name': 'Ada', 'plan': plan, 'credits': 1500};
Map<String, dynamic> file(String id) => {
      'id': id, 'kind': 'image', 'original_name': '$id.jpg', 'size_bytes': 1000, 'width': 10, 'height': 10,
      'duration_ms': null, 'analysis': {'face_count': 0}, 'url': 'http://x/$id', 'thumb_url': null,
    };
Map<String, dynamic> batch(String status, int done) => {
      'id': 'b1', 'name': 'Batch of 2', 'status': status, 'total_files': 2, 'done_files': done, 'failed_files': 0,
      'progress': done / 2, 'credits_reserved': 2, 'credits_spent': done,
    };
Map<String, dynamic> job(String id, String status) => {
      'id': id, 'batch_id': 'b1', 'file_id': 'f$id', 'kind': 'render', 'status': status, 'stage': null,
      'progress': status == 'succeeded' ? 1.0 : 0.0, 'credits_cost': 1, 'error': null, 'outputs': [],
    };

void main() {
  testWidgets('login → batch upload → recipe → batch progress', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(1080, 2400); // phone-sized surface
    tester.view.devicePixelRatio = 2.5;
    addTearDown(tester.view.reset);
    final requests = <String>[];
    var uploads = 0;
    Map<String, dynamic>? submitted;
    final mock = MockClient.streaming((req, body) async {
      final path = req.url.path;
      requests.add('${req.method} $path');
      Object res;
      if (path.endsWith('/auth/dev-login')) {
        res = {'access_token': 't', 'user': user};
      } else if (path.endsWith('/files') && req.method == 'GET') {
        res = {'items': []};
      } else if (path.endsWith('/files')) {
        await body.drain<void>();
        res = file('f${++uploads}');
      } else if (path.endsWith('/recipes/estimate')) {
        res = {'total_credits': 2, 'balance': 1500, 'affordable': true};
      } else if (path.endsWith('/batches') && req.method == 'POST') {
        submitted = jsonDecode(await utf8.decodeStream(body)) as Map<String, dynamic>;
        res = batch('running', 0);
      } else if (path.endsWith('/batches/b1')) {
        res = batch('completed', 2);
      } else if (path.endsWith('/batches/b1/jobs')) {
        res = {'items': [job('1', 'succeeded'), job('2', 'succeeded')]};
      } else if (path.endsWith('/batches')) {
        res = {'items': []};
      } else if (path.endsWith('/me/settings')) {
        res = {'language': 'en', 'quality_lane': 'balanced', 'default_image_format': 'jpg', 'default_video_format': 'mp4',
          'auto_delete_days': 30, 'strip_metadata': true, 'notify_job_complete': true};
      } else {
        res = {'error': {'code': 'NOT_FOUND', 'message': 'no route $path'}};
        return http.StreamedResponse(Stream.value(utf8.encode(jsonEncode(res))), 404);
      }
      return http.StreamedResponse(Stream.value(utf8.encode(jsonEncode(res))), 200);
    });

    final tmp = Directory.systemTemp.createTempSync('nf');
    final files = [for (final n in ['a', 'b']) File('${tmp.path}/$n.jpg')..writeAsBytesSync(List.filled(1000, 1))];
    mediaPicker = FakePicker(files);

    final session = Session(ApiClient(httpClient: mock, baseUrl: 'http://api'), liveEvents: false);
    await tester.runAsync(session.restore);
    await tester.pumpWidget(NeonForgeApp(session: session));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('email')), 'a@b.co');
    await tester.pump();
    await tester.tap(find.byKey(const Key('continue')));
    await tester.pumpAndSettle();
    expect(find.text('Single Edit'), findsOneWidget);
    expect(find.text('1500'), findsOneWidget);

    await tester.tap(find.byKey(const Key('batch-edit')));
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      await tester.tap(find.byKey(const Key('choose-files')));
      await Future<void>.delayed(const Duration(milliseconds: 300));
    });
    await tester.pumpAndSettle();
    expect(uploads, 2);
    await tester.tap(find.byKey(const Key('build-recipe')));
    await tester.pumpAndSettle();
    expect(find.text('Recipe · 2 files'), findsOneWidget);

    await tester.tap(find.byKey(const Key('add-hdr')));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('≈ 2 credits'), findsOneWidget);

    await tester.tap(find.byKey(const Key('start-batch')));
    await tester.pumpAndSettle();
    expect(submitted!['file_ids'], ['f1', 'f2']);
    expect((submitted!['recipe']['steps'] as List).map((s) => s['op']), ['enhance', 'hdr']);
    expect(find.byKey(const Key('batch-progress')), findsOneWidget);
    expect(find.text('2/2'), findsOneWidget);
    expect(find.byKey(const Key('batch-row')), findsNWidgets(2));
    tmp.deleteSync(recursive: true);
  });
}
