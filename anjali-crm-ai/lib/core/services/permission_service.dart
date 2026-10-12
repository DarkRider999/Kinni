import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

/// Requests a runtime permission with a rationale and a Settings fallback.
abstract final class Permissions {
  static Future<bool> ensure(BuildContext context, Permission permission, {required String rationale}) async {
    var status = await permission.status;
    if (status.isGranted || status.isLimited) return true;
    if (status.isPermanentlyDenied) {
      if (!context.mounted) return false;
      final open = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Permission needed'),
          content: Text('$rationale\n\nPlease allow it in Settings.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Not now')),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Open Settings')),
          ],
        ),
      );
      if (open == true) await openAppSettings();
      return false;
    }
    status = await permission.request();
    return status.isGranted || status.isLimited;
  }
}
