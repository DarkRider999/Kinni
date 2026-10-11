import 'dart:io';

import 'package:anjali_crm_ai/core/services/error_reporter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('uncaught save failures surface as a visible message', (tester) async {
    await tester.pumpWidget(MaterialApp(scaffoldMessengerKey: ErrorReporter.messengerKey, home: const Scaffold()));
    final handled = ErrorReporter.report(const FileSystemException('No space left on device'), StackTrace.current);
    await tester.pump();
    expect(handled, isTrue);
    expect(find.textContaining("Couldn't save your change"), findsOneWidget);
  });
}
