import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:share_plus/share_plus.dart';

import '../../core/services/analytics_service.dart';
import '../../core/widgets/common.dart';

/// Opens the system share sheet for [paths]; reports failures to the user
/// instead of throwing (e.g. no app can handle the file).
Future<void> safeShare(BuildContext context, List<String> paths, {String? subject, String? text}) async {
  try {
    await SharePlus.instance.share(ShareParams(files: [for (final x in paths) XFile(x)], subject: subject, text: text));
  } catch (e, st) {
    Telemetry.recordError(e, st);
    if (context.mounted) showSnack(context, 'Could not share the file', error: true);
  }
}

/// Lets the user save a copy of [file]. Returns true when saved.
Future<bool> safeSaveCopy(BuildContext context, File file) async {
  try {
    final uri = await FilePicker.saveFile(fileName: p.basename(file.path), bytes: await file.readAsBytes());
    return uri != null;
  } catch (e, st) {
    Telemetry.recordError(e, st);
    if (context.mounted) showSnack(context, 'Could not save the file', error: true);
    return false;
  }
}
