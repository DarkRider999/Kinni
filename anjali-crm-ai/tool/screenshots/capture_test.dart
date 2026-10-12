// Renders every screen of the app with demo data and writes PNGs to
// docs/user-guide/screens/ for the illustrated user guide.
//
// Not part of the normal suite (lives outside test/). Run with:
//   flutter test --suppress-analytics --no-pub tool/screenshots/capture_test.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:anjali_crm_ai/core/theme/app_theme.dart';
import 'package:anjali_crm_ai/data/local/hive_service.dart';
import 'package:anjali_crm_ai/data/local/settings_store.dart';
import 'package:anjali_crm_ai/data/seed/defaults.dart';
import 'package:anjali_crm_ai/domain/entities/activity.dart';
import 'package:anjali_crm_ai/domain/entities/call_log.dart';
import 'package:anjali_crm_ai/domain/entities/client.dart';
import 'package:anjali_crm_ai/domain/entities/client_document.dart';
import 'package:anjali_crm_ai/domain/entities/document_category.dart';
import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:anjali_crm_ai/domain/entities/followup.dart';
import 'package:anjali_crm_ai/domain/entities/user_profile.dart';
import 'package:anjali_crm_ai/domain/entities/voice_note.dart';
import 'package:anjali_crm_ai/features/card_scanner/card_scanner_screen.dart';
import 'package:anjali_crm_ai/features/clients/client_form_screen.dart';
import 'package:anjali_crm_ai/features/clients/client_list_screen.dart';
import 'package:anjali_crm_ai/features/clients/client_profile_screen.dart';
import 'package:anjali_crm_ai/features/documents/document_preview_screen.dart';
import 'package:anjali_crm_ai/features/documents/whatsapp_files_screen.dart';
import 'package:anjali_crm_ai/features/followups/followups_screen.dart';
import 'package:anjali_crm_ai/features/lock/lock_screen.dart';
import 'package:anjali_crm_ai/features/onboarding/onboarding_screen.dart';
import 'package:anjali_crm_ai/features/reports/reports_screen.dart';
import 'package:anjali_crm_ai/features/search/search_screen.dart';
import 'package:anjali_crm_ai/features/settings/about_screen.dart';
import 'package:anjali_crm_ai/features/settings/data_screens.dart';
import 'package:anjali_crm_ai/features/settings/document_categories_screen.dart';
import 'package:anjali_crm_ai/features/settings/message_templates_screen.dart';
import 'package:anjali_crm_ai/features/settings/notification_settings_screen.dart';
import 'package:anjali_crm_ai/features/settings/product_manager_screen.dart';
import 'package:anjali_crm_ai/features/settings/profile_screen.dart';
import 'package:anjali_crm_ai/features/settings/security_screens.dart';
import 'package:anjali_crm_ai/features/settings/settings_screen.dart';
import 'package:anjali_crm_ai/features/settings/voice_settings_screen.dart';
import 'package:anjali_crm_ai/features/shell/main_shell.dart';
import 'package:anjali_crm_ai/features/splash/splash_screen.dart';
import 'package:anjali_crm_ai/providers/app_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive_ce.dart';

const _out = 'docs/user-guide/screens';
const _fonts = '/opt/flutter/bin/cache/artifacts/material_fonts';
final _boundary = GlobalKey();
late Box _prefs;
late ClientDocument _passportDoc;

/// Sample scanned document shown in the preview screenshot (written in setUpAll).
late String _sampleDoc;

/// Fake WhatsApp media folders for the import screenshot.
late List<WhatsAppFolder> _waFolders;

/// Draws a sample passport data page as a PNG.
Future<Uint8List> _samplePassportPng() async {
  const w = 1000.0, h = 680.0;
  final rec = ui.PictureRecorder();
  final c = Canvas(rec);
  final card = RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, w, h), const Radius.circular(36));
  c.drawRRect(card, Paint()..shader = ui.Gradient.linear(Offset.zero, const Offset(w, h), [const Color(0xFFE8F1FB), const Color(0xFFD6E6F5)]));
  c.drawRect(const Rect.fromLTWH(0, 0, w, 110), Paint()..color = const Color(0xFF1E3A8A));
  c.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(50, 160, 260, 330), const Radius.circular(16)), Paint()..color = const Color(0xFFB6C7DC));
  c.drawCircle(const Offset(180, 280), 70, Paint()..color = const Color(0xFF8DA2BE));
  c.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(85, 360, 190, 130), const Radius.circular(60)), Paint()..color = const Color(0xFF8DA2BE));
  void text(String t, double x, double y, double size, {Color color = const Color(0xFF1F2937), FontWeight weight = FontWeight.w400}) {
    final b = ui.ParagraphBuilder(ui.ParagraphStyle(fontFamily: 'Roboto', fontSize: size, fontWeight: weight))
      ..pushStyle(ui.TextStyle(color: color))
      ..addText(t);
    c.drawParagraph(b.build()..layout(const ui.ParagraphConstraints(width: 900)), Offset(x, y));
  }
  text('REPUBLIC OF INDIA  ·  PASSPORT', 50, 34, 40, color: Colors.white, weight: FontWeight.w700);
  const rows = [
    ('Surname', 'KUMAR'), ('Given names', 'RAJESH'), ('Nationality', 'INDIAN'),
    ('Date of birth', '14/03/1988'), ('Passport no.', 'Z1234567'), ('Date of expiry', 'SAMPLE ONLY'),
  ];
  for (var i = 0; i < rows.length; i++) {
    text(rows[i].$1, 350, 150 + i * 62.0, 22, color: const Color(0xFF64748B));
    text(rows[i].$2, 350, 174 + i * 62.0, 30, weight: FontWeight.w700);
  }
  text('P<INDKUMAR<<RAJESH<<<<<<<<<<<<<<<<<<<<<<<<<<', 50, 560, 30, color: const Color(0xFF334155));
  text('Z1234567<0IND8803142M3501019<<<<<<<<<<<<<<04', 50, 605, 30, color: const Color(0xFF334155));
  final img = await rec.endRecording().toImage(w.toInt(), h.toInt());
  final data = await img.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

/// Lets real file I/O and image decoding finish, then repaints.
Future<void> _settleIo(WidgetTester t) async {
  for (var i = 0; i < 12; i++) {
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 150)));
    await t.pump(const Duration(milliseconds: 100));
  }
}

/// Runs a file operation; a file-system error fails the run with the path named.
T _io<T>(String path, T Function() op) {
  try {
    return op();
  } on FileSystemException catch (e) {
    fail('Screenshot harness could not access $path: ${e.message}');
  }
}

Future<void> _loadFonts() async {
  Future<ByteData> f(String n) async => ByteData.sublistView(_io('$_fonts/$n', () => File('$_fonts/$n').readAsBytesSync()));
  final roboto = FontLoader('Roboto');
  for (final n in ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Light.ttf']) {
    roboto.addFont(f(n));
  }
  await roboto.load();
  await (FontLoader('MaterialIcons')..addFont(f('MaterialIcons-Regular.otf'))).load();
}

DateTime _ago({int days = 0, int hours = 0}) => DateTime.now().subtract(Duration(days: days, hours: hours));
DateTime _in({int days = 0, int hours = 0}) => DateTime.now().add(Duration(days: days, hours: hours));

Future<void> _seed() async {
  final cats = Defaults.categories();
  final products = Defaults.products(['Personal Loan', 'Business Loan', 'Mortgage', 'Credit Card', 'Auto Loan', 'Insurance']);
  final productId = {for (final x in products) x.name: x.id};

  final people = <(String, String, String, LeadStatus, Priority, String, double, String, String, LeadSource)>[
    ('Rajesh Kumar', '+971 50 412 3345', 'Personal Loan', LeadStatus.documentsRequested, Priority.high, 'Emirates NBD', 28000, 'Dubai Marina', 'Senior Engineer', LeadSource.referral),
    ('Priya Sharma', '+971 55 230 4456', 'Credit Card', LeadStatus.interested, Priority.urgent, 'Etisalat', 19500, 'Al Barsha, Dubai', 'Branch Manager', LeadSource.whatsapp),
    ('Amit Patel', '+971 52 345 6678', 'Business Loan', LeadStatus.approved, Priority.medium, 'Patel General Trading', 65000, 'Deira, Dubai', 'Owner', LeadSource.walkIn),
    ('Sneha Reddy', '+971 56 450 7789', 'Mortgage', LeadStatus.newLead, Priority.high, 'ADNOC', 42000, 'Khalifa City, Abu Dhabi', 'Analyst', LeadSource.socialMedia),
    ('Vikram Singh', '+971 50 561 8890', 'Auto Loan', LeadStatus.disbursed, Priority.low, 'Emirates Airline', 16000, 'Al Nahda, Sharjah', 'Supervisor', LeadSource.existingCustomer),
    ('Lakshmi Iyer', '+971 55 672 9901', 'Personal Loan', LeadStatus.underReview, Priority.medium, 'NMC Healthcare', 14500, 'Al Qusais, Dubai', 'Nurse', LeadSource.event),
    ('Arjun Nair', '+971 52 783 1012', 'Insurance', LeadStatus.applicationSubmitted, Priority.medium, 'Accenture', 31000, 'Business Bay, Dubai', 'Consultant', LeadSource.coldCall),
    ('Meera Joshi', '+971 56 894 2123', 'Mortgage', LeadStatus.documentsReceived, Priority.high, 'Deloitte', 38000, 'JLT, Dubai', 'Accountant', LeadSource.website),
    ('Suresh Gupta', '+971 50 905 3234', 'Auto Loan', LeadStatus.notInterested, Priority.low, 'Gupta Electricals LLC', 12000, 'Ajman', 'Owner', LeadSource.businessCard),
    ('Kavita Desai', '+971 55 116 4345', 'Credit Card', LeadStatus.newLead, Priority.medium, 'Lulu Hypermarket', 11000, 'Al Majaz, Sharjah', 'Store Manager', LeadSource.referral),
    ('Rohit Verma', '+971 52 227 5456', 'Personal Loan', LeadStatus.interested, Priority.high, 'Abu Dhabi Islamic Bank', 24000, 'Al Reem Island, Abu Dhabi', 'Officer', LeadSource.walkIn),
    ('Anjana Menon', '+971 56 338 6567', 'Business Loan', LeadStatus.rejected, Priority.low, 'Freelancer', 9000, 'Al Karama, Dubai', 'Designer', LeadSource.socialMedia),
  ];
  final clients = <Client>[];
  final followups = <Followup>[];
  final calls = <CallLog>[];
  final acts = <Activity>[];
  for (var i = 0; i < people.length; i++) {
    final (name, phone, prod, status, pri, company, salary, city, title, src) = people[i];
    final created = _ago(days: 3 + i * 9);
    final id = 'c${i + 1}';
    final next = status.isOpen ? [_ago(hours: 20), _in(hours: 2), _in(hours: 5), _in(days: 2), _ago(days: 2), _in(days: 6)][i % 6] : null;
    clients.add(Client(
      id: id, createdAt: created, updatedAt: _ago(hours: i), name: name, phone: phone, whatsapp: phone,
      email: '${name.split(' ').first.toLowerCase()}@example.com', location: city, company: company, jobTitle: title,
      nationality: 'Indian', monthlySalary: salary, productId: productId[prod], leadSource: src, status: status, priority: pri,
      rating: 1 + (i * 7) % 5, nextFollowupAt: next, statusChangedAt: _ago(days: i),
      remarks: i == 0 ? 'Needs a personal loan for home renovation. Prefers calls after 6 pm.' : null,
      requestedAmount: salary * 20, approvedAmount: status.isConverted ? salary * 20 : null,
      disbursedAmount: status == LeadStatus.disbursed ? salary * 20 : null,
    ));
    acts.add(Activity(id: 'a$id', createdAt: created, updatedAt: created, clientId: id, type: ActivityType.created, title: 'Lead created', at: created));
    if (status != LeadStatus.newLead) {
      acts.add(Activity(
          id: 's$id', createdAt: _ago(days: i), updatedAt: _ago(days: i), clientId: id, type: ActivityType.statusChanged,
          title: 'Status → ${status.label}', fromStatus: LeadStatus.newLead, toStatus: status, at: _ago(days: i)));
    }
    if (next != null) {
      followups.add(Followup(
          id: 'f$id', createdAt: created, updatedAt: created, clientId: id, dueAt: next,
          note: status.isDocumentStage ? 'Collect pending documents' : 'Explain $prod options'));
    }
    followups.add(Followup(
        id: 'd$id', createdAt: created, updatedAt: created, clientId: id, dueAt: _ago(days: 1 + i % 4),
        note: 'Intro call', status: FollowupStatus.completed, completedAt: _ago(days: 1 + i % 4)));
    for (var k = 0; k < 1 + i % 3; k++) {
      final at = _ago(days: k * 2 + i % 3, hours: k + 1);
      calls.add(CallLog(
          id: 'k$id$k', createdAt: at, updatedAt: at, clientId: id, calledAt: at,
          outcome: CallOutcome.values[(i + k) % CallOutcome.values.length], durationSeconds: 60 + 37 * k + 11 * i));
    }
  }

  ClientDocument doc(String id, String client, String cat, DocumentStatus st, {DateTime? expiry, String? title, String? filePath}) => ClientDocument(
      id: id, createdAt: _ago(days: 4), updatedAt: _ago(days: 1), clientId: client, categoryId: cat, status: st,
      expiryDate: expiry, title: title, filePath: filePath, encrypted: false, mimeType: filePath == null ? 'image/jpeg' : 'image/png');
  _passportDoc = doc('doc1', 'c1', DocumentCategory.passport, DocumentStatus.verified, expiry: _in(days: 20), title: 'Passport_Rajesh.png', filePath: _sampleDoc);
  final docs = [
    _passportDoc,
    doc('doc2', 'c1', DocumentCategory.emiratesIdFront, DocumentStatus.received, title: 'EmiratesID_front.jpg'),
    doc('doc3', 'c1', DocumentCategory.emiratesIdBack, DocumentStatus.requested),
    doc('doc4', 'c8', DocumentCategory.passport, DocumentStatus.verified),
    doc('doc5', 'c8', DocumentCategory.emiratesIdFront, DocumentStatus.verified),
    doc('doc6', 'c8', DocumentCategory.salaryCertificate, DocumentStatus.received),
    doc('doc7', 'c6', DocumentCategory.passport, DocumentStatus.verified, expiry: _in(days: 12)),
    doc('doc8', 'c3', DocumentCategory.tradeLicense, DocumentStatus.verified, expiry: _ago(days: 3)),
  ];
  final notes = [
    VoiceNote(id: 'v1', createdAt: _ago(days: 1, hours: 2), updatedAt: _ago(days: 1), clientId: 'c1', durationMs: 42000,
        transcript: 'Rajesh wants AED 500,000 over 4 years. Send the Emirates ID and salary certificate checklist on WhatsApp.'),
    VoiceNote(id: 'v2', createdAt: _ago(days: 4), updatedAt: _ago(days: 4), clientId: 'c1', durationMs: 18000,
        transcript: 'Salary transfer to Emirates NBD since 2021. Call back Saturday morning.'),
  ];

  Future<void> put(String box, List<Map<String, dynamic>> maps) async {
    final b = Hive.box(box);
    await b.putAll({for (final m in maps) m['id']: {...m, 'dirty': false}});
  }

  await put(HiveService.documentCategories, [for (final c in cats) c.toMap()]);
  await put(HiveService.products, [for (final x in products) x.toMap()]);
  await put(HiveService.templates, [for (final t in Defaults.templates()) t.toMap()]);
  await put(HiveService.clients, [for (final c in clients) c.toMap()]);
  await put(HiveService.followups, [for (final f in followups) f.toMap()]);
  await put(HiveService.callLogs, [for (final c in calls) c.toMap()]);
  await put(HiveService.documents, [for (final d in docs) d.toMap()]);
  await put(HiveService.voiceNotes, [for (final v in notes) v.toMap()]);
  await put(HiveService.activities, [for (final a in acts) a.toMap()]);
  await SettingsStore(_prefs, Hive.box(HiveService.settings)).setProfile(const UserProfile(name: 'Anjali Menon', mobile: '+971 50 123 4567'));
  await _prefs.put('onboarded', true);
  await _prefs.put('themeMode', 'light');
}

Future<void> _shot(WidgetTester tester, String file, Widget screen, {Future<void> Function(WidgetTester)? interact}) async {
  tester.view.physicalSize = const Size(412 * 2.6, 892 * 2.6);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(RepaintBoundary(
    key: _boundary,
    child: ProviderScope(
      overrides: [prefsBoxProvider.overrideWithValue(_prefs)],
      child: MaterialApp(debugShowCheckedModeBanner: false, theme: AppTheme.light(), home: screen),
    ),
  ));
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
  if (interact != null) {
    await interact(tester);
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
  }
  final boundary = _boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    _io('$_out/$file.png', () => File('$_out/$file.png').writeAsBytesSync(bytes!.buffer.asUint8List()));
  });
  // Dispose the tree so stream subscriptions and timers are released.
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 2));
}

void main() {
  late Directory dir;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadFonts();
    _io(_out, () => Directory(_out).createSync(recursive: true));
    dir = await Directory.systemTemp.createTemp('anjali_shots');
    Hive.init(dir.path);
    _prefs = await Hive.openBox(HiveService.prefsBox);
    for (final name in HiveService.encryptedBoxes) {
      await Hive.openBox(name);
    }
    // permission_handler has no platform side in tests: report nothing granted.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('flutter.baseflow.com/permissions/methods'),
        (call) async => call.method == 'requestPermissions' ? <int, int>{} : 0);

    final png = await _samplePassportPng();
    _sampleDoc = '${dir.path}/passport_rajesh.png';
    _io(_sampleDoc, () => File(_sampleDoc).writeAsBytesSync(png));

    // Received WhatsApp files, newest first once scanned.
    final wa = Directory('${dir.path}/wa');
    _waFolders = [
      for (final f in WhatsAppFilesScreen.folders) WhatsAppFolder(f.label, ['${wa.path}/${f.label}']),
    ];
    final samples = <(int, String, List<int>)>[
      (0, 'IMG-20261012-WA0007.jpg', png),
      (1, 'Salary_Certificate_Rajesh.pdf', '%PDF-1.4 sample'.codeUnits),
      (2, 'IMG-20261011-WA0012.jpg', png),
      (3, 'Trade_License_Patel.pdf', '%PDF-1.4 sample'.codeUnits),
      (1, 'Bank_Statement_Sep.pdf', '%PDF-1.4 sample'.codeUnits),
    ];
    for (var i = 0; i < samples.length; i++) {
      final (folder, name, bytes) = samples[i];
      final path = '${_waFolders[folder].paths.first}/$name';
      _io(path, () => File(path)
        ..createSync(recursive: true)
        ..writeAsBytesSync(bytes)
        ..setLastModifiedSync(DateTime.now().subtract(Duration(hours: 3 * i + 1))));
    }

    await _seed();
  });

  tearDownAll(() async {
    await Hive.close();
    await dir.delete(recursive: true);
  });

  final screens = <(String, Widget Function(), Future<void> Function(WidgetTester)?)>[
    ('01-splash', () => SplashScreen(onDone: () {}), null),
    ('02-onboarding', () => OnboardingScreen(onFinished: () {}), null),
    ('03-lock-screen', () => const LockScreen(), null),
    ('04-home-dashboard', () => const MainShell(), null),
    ('05-client-list', () => const ClientListScreen(), null),
    ('06-client-form', () => const ClientFormScreen(), null),
    ('07-client-profile-timeline', () => const ClientProfileScreen(clientId: 'c1'), null),
    ('08-client-profile-notes', () => const ClientProfileScreen(clientId: 'c1', initialTab: 1), null),
    ('09-client-profile-documents', () => const ClientProfileScreen(clientId: 'c1', initialTab: 2), null),
    ('10-client-profile-calls', () => const ClientProfileScreen(clientId: 'c1', initialTab: 3), null),
    ('11-client-profile-followups', () => const ClientProfileScreen(clientId: 'c1', initialTab: 4), null),
    ('12-client-profile-files', () => const ClientProfileScreen(clientId: 'c1', initialTab: 5), null),
    ('13-document-preview', () => DocumentPreviewScreen(document: _passportDoc), _settleIo),
    ('14-whatsapp-files', () => WhatsAppFilesScreen(extensions: const ['jpg', 'jpeg', 'png', 'webp', 'pdf'], searchFolders: _waFolders), (t) async {
      await _settleIo(t);
      await t.tap(find.byType(CheckboxListTile).at(0));
      await t.tap(find.byType(CheckboxListTile).at(1));
      await _settleIo(t);
    }),
    ('15-card-scanner', () => const CardScannerScreen(), null),
    ('16-followups', () => const FollowupsScreen(), null),
    ('17-search', () => const SearchScreen(), (t) async {
      await t.enterText(find.byType(TextField).first, 'ra');
    }),
    ('18-reports', () => const ReportsScreen(), null),
    ('20-settings', () => const SettingsScreen(), null),
    ('21-profile', () => const ProfileScreen(), null),
    ('22-product-manager', () => const ProductManagerScreen(), null),
    ('23-document-categories', () => const DocumentCategoriesScreen(), null),
    ('24-message-templates', () => const MessageTemplatesScreen(), null),
    ('25-notification-settings', () => const NotificationSettingsScreen(), null),
    ('26-voice-settings', () => const VoiceSettingsScreen(), null),
    ('27-security', () => const SecurityScreen(), null),
    ('28-security-log', () => const SecurityLogScreen(), null),
    ('29-backup-restore', () => const BackupScreen(), null),
    ('30-cloud-sync', () => const CloudSyncScreen(), null),
    ('31-export', () => const ExportScreen(), null),
    ('32-sample-data', () => const SampleDataScreen(), null),
    ('33-about', () => const AboutScreen(), null),
    ('34-message-template-editor', () => const TemplateEditorScreen(), null),
  ];

  for (final (file, build, interact) in screens) {
    testWidgets(file, (tester) => _shot(tester, file, build(), interact: interact));
  }
}
