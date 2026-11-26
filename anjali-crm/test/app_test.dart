import 'dart:io';

import 'package:anjali_crm_ai/data/crm_database.dart';
import 'package:anjali_crm_ai/data/models.dart';
import 'package:anjali_crm_ai/main.dart';
import 'package:anjali_crm_ai/services/client_actions.dart';
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

  late List<Uri> opened;

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  setUp(() {
    CrmDatabase.instance = CrmDatabase.withPath(inMemoryDatabasePath);
    opened = [];
    ClientActions.opener = (uri) async {
      opened.add(uri);
      return true;
    };
    ClientActions.leaveGrace = const Duration(milliseconds: 50);
  });
  // Close even when a test fails, so the next test's in-memory database
  // starts empty (sqflite reuses an open database with the same path).
  tearDown(() => CrmDatabase.instance.close());

  /// Waits (in real time) until nothing is loading, then for the UI to go
  /// idle. Fails after about 5 seconds instead of hanging.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 200; i++) {
      await tester.pump(const Duration(milliseconds: 25));
      if (i >= 4 && find.byType(CircularProgressIndicator).evaluate().isEmpty) break;
    }
    await tester.pumpAndSettle(const Duration(milliseconds: 16), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 5));
  }

  /// A phone-sized screen.
  Future<void> startApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const AnjaliCrmApp());
    await settle(tester);
  }

  Future<void> closeDb() => CrmDatabase.instance.close();

  Future<void> tab(WidgetTester tester, String label) async {
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
    await settle(tester);
  }

  /// Scrolls [f] into view; lazily built lists may not have built it yet.
  Future<void> reveal(WidgetTester tester, Finder f) async {
    if (f.evaluate().isEmpty) {
      final form = find.descendant(of: find.byType(Form), matching: find.byType(Scrollable));
      await tester.scrollUntilVisible(f, 300, scrollable: form.evaluate().isNotEmpty ? form.first : find.byType(Scrollable).first);
    }
    await tester.ensureVisible(f);
    await tester.pumpAndSettle();
  }

  Future<void> tapText(WidgetTester tester, String text) async {
    final f = find.text(text).last;
    await reveal(tester, f);
    await tester.tap(f);
    await settle(tester);
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    final f = find.byKey(Key(key));
    await reveal(tester, f);
    await tester.tap(f);
    await settle(tester);
  }

  Future<int> seed(String name, {String phone = '', LeadStatus status = LeadStatus.newLead}) =>
      CrmDatabase.instance.saveClient(Client(name: name, phone: phone, status: status));

  testWidgets('dashboard counts the pipeline and a card opens the filtered clients list', (tester) async {
    await seed('Aisha', status: LeadStatus.interested);
    await seed('Bilal', status: LeadStatus.interested);
    await seed('Chen');
    await startApp(tester);

    final interestedCard = find.ancestor(of: find.text('Interested'), matching: find.byType(Card)).first;
    expect(find.descendant(of: interestedCard, matching: find.text('2')), findsOneWidget);
    await tester.tap(interestedCard);
    await settle(tester);

    expect(find.text('2 clients'), findsOneWidget);
    expect(find.text('Aisha'), findsOneWidget);
    expect(find.text('Bilal'), findsOneWidget);
    expect(find.text('Chen'), findsNothing);
    await closeDb();
  });

  testWidgets('adding a lead validates required fields, saves, and opens the profile', (tester) async {
    await startApp(tester);
    await tab(tester, 'Add Lead');

    await tapKey(tester, 'lead-save');
    expect(find.text('Full name is required'), findsOneWidget);
    expect(find.text('Phone is required'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('lead-name')), 'Aisha Khan');
    await tester.enterText(find.byKey(const Key('lead-phone')), '+971 50 123 4567');
    await reveal(tester, find.byKey(const Key('lead-salary')));
    await tester.enterText(find.byKey(const Key('lead-salary')), '15,000');
    await reveal(tester, find.byKey(const Key('lead-company')));
    await tester.enterText(find.byKey(const Key('lead-company')), 'Emirates NBD');
    await tapKey(tester, 'star-4');
    await tapKey(tester, 'lead-save');

    // Profile of the new lead.
    expect(find.text('Aisha Khan'), findsWidgets);
    expect(find.text('AED 15,000'), findsOneWidget);
    expect(find.text('Lead created'), findsOneWidget);
    final saved = (await tester.runAsync(() => CrmDatabase.instance.clients()))!;
    expect(saved.single.rating, 4);
    expect(saved.single.company, 'Emirates NBD');
    await closeDb();
  });

  testWidgets('a phone number already on file triggers the duplicate warning', (tester) async {
    await seed('Aisha', phone: '+971 50 123 4567');
    await startApp(tester);
    await tab(tester, 'Add Lead');
    await tester.enterText(find.byKey(const Key('lead-name')), 'Aisha again');
    await tester.enterText(find.byKey(const Key('lead-phone')), '050-123-4567');
    await tapKey(tester, 'lead-save');

    expect(find.text('Potential duplicate customer found'), findsOneWidget);
    await tapText(tester, 'Cancel');
    expect((await tester.runAsync(() => CrmDatabase.instance.clients()))!, hasLength(1), reason: 'cancel saves nothing');

    await tapKey(tester, 'lead-save');
    await tapText(tester, 'Continue anyway');
    expect((await tester.runAsync(() => CrmDatabase.instance.clients()))!, hasLength(2));
    await closeDb();
  });

  testWidgets('changing status to Approved asks for the amount and moves the pipeline', (tester) async {
    await seed('Aisha', phone: '0501234567');
    await startApp(tester);
    await tab(tester, 'Clients');
    await tapText(tester, 'Aisha');
    await tapKey(tester, 'change-status');
    await tapKey(tester, 'status-approved');
    await tapText(tester, 'Save');
    expect(find.text('Amount is required'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('status-amount')), '50000');
    await tapText(tester, 'Save');
    expect(find.text('AED 50,000'), findsOneWidget);
    expect(find.text('Status: Approved'), findsOneWidget);
    expect((await tester.runAsync(() => CrmDatabase.instance.clients()))!.single.status, LeadStatus.approved);
    await closeDb();
  });

  testWidgets('calling opens the dialer, then asks how the call went and logs it', (tester) async {
    await seed('Aisha', phone: '+971 50 123 4567');
    await startApp(tester);
    await tab(tester, 'Clients');
    await tester.tap(find.byTooltip('Call Aisha'));
    await settle(tester);

    expect(opened.single.toString(), 'tel:+971501234567');
    expect(find.text('How did the call with Aisha go?'), findsOneWidget);
    await tapText(tester, 'No answer');
    await tapText(tester, 'Save');
    expect(find.text('Call logged.'), findsOneWidget);

    final id = (await tester.runAsync(() => CrmDatabase.instance.clients()))!.single.id!;
    expect((await tester.runAsync(() => CrmDatabase.instance.calls(id)))!.single.outcome, 'No answer');
    await closeDb();
  });

  testWidgets('a number logged as wrong is flagged before the next call', (tester) async {
    final id = await seed('Aisha', phone: '0501234567');
    await CrmDatabase.instance.logCall(id, wrongNumberOutcome);
    await startApp(tester);
    await tab(tester, 'Clients');
    await tester.tap(find.byTooltip('Call Aisha'));
    await settle(tester);
    expect(find.text('Wrong number?'), findsOneWidget);
    await tapText(tester, 'Cancel');
    expect(opened, isEmpty, reason: 'cancelling must not dial');
    await closeDb();
  });

  testWidgets('swiping a client right opens WhatsApp with the international number', (tester) async {
    await seed('Aisha', phone: '050 123 4567');
    await startApp(tester);
    await tab(tester, 'Clients');
    await tester.drag(find.text('Aisha'), const Offset(400, 0));
    await settle(tester);
    expect(opened.single.toString(), 'https://wa.me/971501234567');
    expect(find.text('Aisha'), findsOneWidget, reason: 'the card is not dismissed');
    await closeDb();
  });

  testWidgets('followups land in the right tab, show the overdue badge, and can be completed', (tester) async {
    final id = await seed('Aisha', phone: '0501234567');
    final db = CrmDatabase.instance;
    final now = DateTime.now();
    await db.addFollowup(id, now.subtract(const Duration(hours: 3)), note: 'Collect salary certificate');
    await db.addFollowup(id, DateTime(now.year, now.month, now.day).add(const Duration(days: 1, hours: 10)), note: 'Tomorrow call');
    await startApp(tester);

    // Badge on the Followups tab.
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('1')), findsOneWidget);
    await tab(tester, 'Followups');
    expect(find.text('1 overdue'), findsOneWidget);
    expect(find.text('Tomorrow (1)'), findsOneWidget);

    await tapText(tester, 'Overdue (1)');
    expect(find.text('Collect salary certificate'), findsOneWidget);
    await tapText(tester, 'Mark complete');
    await tester.enterText(find.byKey(const Key('complete-outcome')), 'Received');
    await tapText(tester, 'Complete');

    expect(find.text('Overdue (0)'), findsOneWidget);
    expect(find.text('Completed (1)'), findsOneWidget);
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('1')), findsNothing, reason: 'badge cleared');
    await closeDb();
  });

  testWidgets('clients search narrows the list', (tester) async {
    await seed('Aisha', phone: '+971 50 123 4567');
    await seed('Bilal', phone: '+971 55 999 0000');
    await startApp(tester);
    await tab(tester, 'Clients');
    await tester.enterText(find.byKey(const Key('clients-search')), '050 123');
    await settle(tester);
    expect(find.text('Aisha'), findsOneWidget);
    expect(find.text('Bilal'), findsNothing);
    await closeDb();
  });

  testWidgets('closing a form dialog does not use disposed controllers', (tester) async {
    await seed('Aisha', phone: '0501234567');
    await startApp(tester);
    await tab(tester, 'Clients');
    await tapText(tester, 'Aisha');
    await tapText(tester, 'Followups (0)');
    await tapKey(tester, 'profile-add-followup');
    await tester.enterText(find.byKey(const Key('followup-note')), 'typed then cancelled');
    await tester.tap(find.text('Cancel'));
    // Draw every frame of the closing animation.
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await settle(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('No followups yet.'), findsOneWidget);
    await closeDb();
  });

  testWidgets('a database failure shows an error with Retry, not an endless spinner', (tester) async {
    // SQLite creates missing folders, so make the path impossible: a
    // "folder" that is really a file.
    final blocker = File('${Directory.systemTemp.createTempSync('crm_test').path}/not-a-folder')..writeAsStringSync('x');
    addTearDown(() => blocker.parent.deleteSync(recursive: true));
    CrmDatabase.instance = CrmDatabase.withPath('${blocker.path}/crm.db');
    await startApp(tester);
    expect(find.text('Could not load your data'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    await closeDb();
  });
}
