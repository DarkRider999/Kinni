import 'dart:io';

import 'package:file_picker/file_picker.dart';

const kAllowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi'];

/// Source of local media. Swappable in tests.
abstract class MediaPicker {
  Future<List<File>> pickFiles({required bool multiple});
  Future<List<File>> pickFolder();
}

class DeviceMediaPicker implements MediaPicker {
  @override
  Future<List<File>> pickFiles({required bool multiple}) async {
    // file_picker 13: pickFiles selects one or more, pickFile exactly one.
    final picked = multiple
        ? await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: kAllowedExtensions)
        : [?await FilePicker.pickFile(type: FileType.custom, allowedExtensions: kAllowedExtensions)];
    return [for (final f in picked) if (f.path != null) File(f.path!)];
  }

  @override
  Future<List<File>> pickFolder() async {
    final dir = await FilePicker.getDirectoryPath();
    if (dir == null) return [];
    final files = <File>[];
    await for (final e in Directory(dir).list(recursive: true, followLinks: false)) {
      if (e is File && kAllowedExtensions.contains(e.path.split('.').last.toLowerCase())) files.add(e);
    }
    return files;
  }
}
