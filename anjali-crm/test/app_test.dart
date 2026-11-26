import 'dart:io';

import 'package:anjali_crm_ai/data/crm_database.dart';
import 'package:anjali_crm_ai/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  // Real SQLite answers on the real event loop, which the default test
  // binding's fake clock never runs; a query started after a save would never
  // finish. The live binding runs these tests on real time, like an on-device
  // integration test.
  final binding = LiveTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  setUp(() => CrmDatabase.instance = CrmDatabase.withPath(inMemoryDatabasePath));

  /// Waits (in real time) until nothing is loading, then for the UI to go
  /// idle. Fails after about 5 seconds instead of hanging.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 200; i++) {
      await tester.pump(const Duration(milliseconds: 25));
      if (i >= 4 && find.byType(CircularProgressIndicator).evaluate().isEmpty) break;
    }
    await tester.pumpAndSettle(const Duration(milliseconds: 16), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 5));
  }

  /// Call at the end of every test so each one starts from an empty database.
  Future<void> closeDb(WidgetTester tester) => CrmDatabase.instance.close();

  Future<void> openTab(WidgetTester tester, String label) async {
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
    await settle(tester);
  }

  Future<void> addContact(WidgetTester tester, String name, {String email = ''}) async {
    await tester.tap(find.text('Add contact'));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('contact-name')), name);
    if (email.isNotEmpty) await tester.enterText(find.byKey(const Key('contact-email')), email);
    await tester.tap(find.text('Save'));
    await settle(tester);
  }

  testWidgets('shows the dashboard with live counts', (tester) async {
    await CrmDatabase.instance.saveContact({'name': 'Alice', 'created_at': '2026-01-01T00:00:00.000'});
    await tester.pumpWidget(const AnjaliCrmApp());
    await settle(tester);
    expect(find.text('Anjali CRM AI'), findsWidgets);
    expect(find.descendant(of: find.widgetWithText(Card, 'Contacts'), matching: find.text('1')), findsOneWidget);
    await closeDb(tester);
  });

  testWidgets('contact form validates and keeps the dialog open on bad input', (tester) async {
    await tester.pumpWidget(const AnjaliCrmApp());
    await settle(tester);
    await openTab(tester, 'Contacts');

    await tester.tap(find.text('Add contact'));
    await settle(tester);
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.text('Name is required'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('contact-name')), 'Alice');
    await tester.enterText(find.byKey(const Key('contact-email')), 'not-an-email');
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.text('Enter a valid email address'), findsOneWidget);
    expect(find.text('New contact'), findsOneWidget, reason: 'dialog must stay open');

    await tester.enterText(find.byKey(const Key('contact-email')), 'alice@example.com');
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.text('New contact'), findsNothing);
    expect(find.text('Alice'), findsOneWidget);
    expect(find.text('alice@example.com'), findsOneWidget);
    await closeDb(tester);
  });

  testWidgets('closing a form dialog does not use disposed controllers', (tester) async {
    // The original screens disposed the dialog's TextEditingControllers right
    // after showDialog returned, while the dialog was still animating out.
    // Flutter reports that as an exception, which fails this test.
    await tester.pumpWidget(const AnjaliCrmApp());
    await settle(tester);
    await openTab(tester, 'Contacts');
    await tester.tap(find.text('Add contact'));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('contact-name')), 'Typed then cancelled');
    await tester.tap(find.text('Cancel'));
    // Draw every frame of the closing animation.
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await settle(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('No contacts yet'), findsOneWidget);

    await openTab(tester, 'Activities');
    await tester.tap(find.text('Add activity'));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('activity-title')), 'Call back');
    await tester.tap(find.text('Save'));
    // Draw every frame of the closing animation.
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await settle(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('Call back'), findsOneWidget);
    await closeDb(tester);
  });

  testWidgets('an activity can be linked to a contact, edited and deleted', (tester) async {
    await tester.pumpWidget(const AnjaliCrmApp());
    await settle(tester);
    await openTab(tester, 'Contacts');
    await addContact(tester, 'Alice');

    await openTab(tester, 'Activities');
    // The "Contact added." snackbar is still sliding over the FAB; clear it so
    // the next tap reaches the button.
    tester.state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger)).clearSnackBars();
    await settle(tester);
    await tester.tap(find.text('Add activity'));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('activity-title')), 'Send loan form');
    await tester.tap(find.byKey(const Key('activity-contact')));
    await settle(tester);
    await tester.tap(find.text('Alice').last);
    await settle(tester);
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.textContaining('With Alice'), findsOneWidget);

    // Edit: tapping the row opens the form pre-filled.
    await tester.tap(find.text('Send loan form'));
    await settle(tester);
    expect(find.text('Edit activity'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('activity-title')), 'Collect loan form');
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.text('Collect loan form'), findsOneWidget);
    expect(find.textContaining('With Alice'), findsOneWidget, reason: 'editing keeps the link');

    // Delete via the row menu.
    await tester.tap(find.byTooltip('Activity actions'));
    await settle(tester);
    await tester.tap(find.text('Delete'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await settle(tester);
    expect(find.text('Collect loan form'), findsNothing);
    expect(find.text('No activities. Add a follow-up to get started.'), findsOneWidget);
    await closeDb(tester);
  });

  testWidgets('a database failure shows an error with Retry, not an endless spinner', (tester) async {
    // SQLite creates missing folders, so make the path impossible: a
    // "folder" that is really a file.
    final blocker = File('${Directory.systemTemp.createTempSync('crm_test').path}/not-a-folder')..writeAsStringSync('x');
    addTearDown(() => blocker.parent.deleteSync(recursive: true));
    CrmDatabase.instance = CrmDatabase.withPath('${blocker.path}/crm.db');
    await tester.pumpWidget(const AnjaliCrmApp());
    await settle(tester);
    await openTab(tester, 'Contacts');
    expect(find.text('Could not load your data'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await closeDb(tester);
  });
}
