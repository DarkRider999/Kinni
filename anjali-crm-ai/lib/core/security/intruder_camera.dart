import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Silently captures a front-camera photo after repeated failed unlocks
/// (FR SEC-09). Fails quietly: a missing camera or permission must never
/// block the lock screen.
abstract final class IntruderCamera {
  static Future<String?> capture() async {
    CameraController? controller;
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) return null;
      final front = cams.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cams.first,
      );
      controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();
      // Give auto-exposure a moment to settle.
      await Future<void>.delayed(const Duration(milliseconds: 500));
      final shot = await controller.takePicture();
      final dir = Directory(p.join((await getApplicationDocumentsDirectory()).path, 'security'));
      await dir.create(recursive: true);
      final dest = p.join(dir.path, 'intruder_${DateTime.now().millisecondsSinceEpoch}.jpg');
      await File(shot.path).copy(dest);
      await File(shot.path).delete().catchError((_) => File(shot.path));
      return dest;
    } catch (e) {
      debugPrint('IntruderCamera: $e');
      return null;
    } finally {
      await controller?.dispose();
    }
  }
}
