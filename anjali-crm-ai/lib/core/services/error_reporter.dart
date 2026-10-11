import 'dart:io';

import 'package:flutter/material.dart';
import 'package:hive_ce/hive_ce.dart';

import '../theme/app_colors.dart';
import 'analytics_service.dart';

/// App-wide fallback for errors that escape a screen's own handling
/// (e.g. a database write failing because storage is full). The user
/// always gets a visible message instead of a silent failure.
abstract final class ErrorReporter {
  /// Attached to MaterialApp.scaffoldMessengerKey.
  static final messengerKey = GlobalKey<ScaffoldMessengerState>();

  static String userMessage(Object error) {
    if (error is HiveError || error is FileSystemException) {
      return "Couldn't save your change. Please check free storage and try again.";
    }
    return 'Something went wrong. Please try again.';
  }

  /// Records [error] and shows a snackbar. Returns true (handled).
  static bool report(Object error, StackTrace stack) {
    Telemetry.recordError(error, stack);
    final messenger = messengerKey.currentState;
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(userMessage(error)), backgroundColor: AppColors.danger));
    return true;
  }
}
