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
import 'package:anjali_crm_ai/domain/entities/product.dart';
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
import 'package:anjali_crm_ai/features/maps/location_picker_screen.dart';
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

Future<void> _loadFonts() async {
  Future<ByteData> f(String n) async => ByteData.sublistView(await File('$_fonts/$n').readAsBytes());
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
  final now = DateTime.now();
  final cats = Defaults.categories().map((c) {
    const india = {
      DocumentCategory.passport: 'PAN Card',
      DocumentCategory.emiratesIdFront: 'Aadhaar Front',
      DocumentCategory.emiratesIdBack: 'Aadhaar Back',
      DocumentCategory.visa: 'Passport',
      DocumentCategory.salaryCertificate: 'Salary Slip',
      DocumentCategory.bankStatement: 'Bank Statement',
      DocumentCategory.creditCardForm: 'Proposal Form',
      DocumentCategory.loanApplicationForm: 'Medical Report',
      DocumentCategory.tradeLicense: 'Vehicle RC',
    };
    return DocumentCategory(
        id: c.id, createdAt: now, updatedAt: now, name: india[c.id] ?? c.name, sortOrder: c.sortOrder, supportsExpiry: c.supportsExpiry);
  }).toList();

  Product p(String id, String name, IconData icon, int color, int order, List<String> req) => Product(
      id: id, createdAt: now, updatedAt: now, name: name, iconCode: icon.codePoint, colorValue: color, sortOrder: order, requiredCategoryIds: req);
  final products = [
    p('lic', 'LIC Jeevan Anand', Icons.shield, 0xFF6C63FF, 0,
        [DocumentCategory.passport, DocumentCategory.emiratesIdFront, DocumentCategory.emiratesIdBack, DocumentCategory.creditCardForm]),
    p('health', 'Health Insurance', Icons.favorite, 0xFF22C55E, 1,
        [DocumentCategory.passport, DocumentCategory.emiratesIdFront, DocumentCategory.loanApplicationForm]),
    p('motor', 'Motor Insurance', Icons.directions_car, 0xFF0EA5E9, 2, [DocumentCategory.passport, DocumentCategory.tradeLicense]),
    p('term', 'Term Life Plan', Icons.account_balance_wallet, 0xFFF59E0B, 3,
        [DocumentCategory.passport, DocumentCategory.emiratesIdFront, DocumentCategory.salaryCertificate, DocumentCategory.bankStatement]),
    p('mf', 'Mutual Fund SIP', Icons.trending_up, 0xFFFF6B9D, 4, [DocumentCategory.passport, DocumentCategory.bankStatement]),
  ];

  final people = <(String, String, String, LeadStatus, Priority, String, double, String, String, LeadSource)>[
    ('Rajesh Kumar', '+91 98450 12345', 'lic', LeadStatus.documentsRequested, Priority.high, 'Infosys', 85000, 'Bengaluru', 'Senior Engineer', LeadSource.referral),
    ('Priya Sharma', '+91 99000 23456', 'health', LeadStatus.interested, Priority.urgent, 'HDFC Bank', 62000, 'Pune', 'Branch Manager', LeadSource.whatsapp),
    ('Amit Patel', '+91 98250 34567', 'motor', LeadStatus.approved, Priority.medium, 'Patel Traders', 120000, 'Ahmedabad', 'Owner', LeadSource.walkIn),
    ('Sneha Reddy', '+91 90000 45678', 'term', LeadStatus.newLead, Priority.high, 'Wipro', 74000, 'Hyderabad', 'Analyst', LeadSource.socialMedia),
    ('Vikram Singh', '+91 98110 56789', 'lic', LeadStatus.disbursed, Priority.low, 'Indian Railways', 58000, 'New Delhi', 'Supervisor', LeadSource.existingCustomer),
    ('Lakshmi Iyer', '+91 94440 67890', 'health', LeadStatus.underReview, Priority.medium, 'Apollo Hospitals', 66000, 'Chennai', 'Nurse', LeadSource.event),
    ('Arjun Nair', '+91 98470 78901', 'mf', LeadStatus.applicationSubmitted, Priority.medium, 'TCS', 92000, 'Kochi', 'Consultant', LeadSource.coldCall),
    ('Meera Joshi', '+91 98200 89012', 'term', LeadStatus.documentsReceived, Priority.high, 'Tata Motors', 81000, 'Mumbai', 'Accountant', LeadSource.website),
    ('Suresh Gupta', '+91 98390 90123', 'motor', LeadStatus.notInterested, Priority.low, 'Gupta Electricals', 45000, 'Lucknow', 'Owner', LeadSource.businessCard),
    ('Kavita Desai', '+91 97230 11223', 'health', LeadStatus.newLead, Priority.medium, 'Reliance Retail', 52000, 'Surat', 'Store Manager', LeadSource.referral),
    ('Rohit Verma', '+91 98720 33445', 'lic', LeadStatus.interested, Priority.high, 'State Bank of India', 70000, 'Jaipur', 'Officer', LeadSource.walkIn),
    ('Anjana Menon', '+91 94470 55667', 'term', LeadStatus.rejected, Priority.low, 'Freelancer', 38000, 'Thrissur', 'Designer', LeadSource.socialMedia),
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
      email: '${name.split(' ').first.toLowerCase()}@example.in', location: city, company: company, jobTitle: title,
      nationality: 'Indian', monthlySalary: salary, productId: prod, leadSource: src, status: status, priority: pri,
      rating: 1 + (i * 7) % 5, nextFollowupAt: next, statusChangedAt: _ago(days: i),
      remarks: i == 0 ? 'Wants a 20-year policy for child education. Prefers calls after 6 pm.' : null,
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
          note: status.isDocumentStage ? 'Collect pending documents' : 'Explain premium options for ${products.firstWhere((x) => x.id == prod).name}'));
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

  ClientDocument doc(String id, String client, String cat, DocumentStatus st, {DateTime? expiry, String? title}) => ClientDocument(
      id: id, createdAt: _ago(days: 4), updatedAt: _ago(days: 1), clientId: client, categoryId: cat, status: st,
      expiryDate: expiry, title: title, encrypted: false, mimeType: 'image/jpeg');
  _passportDoc = doc('doc1', 'c1', DocumentCategory.passport, DocumentStatus.verified, expiry: _in(days: 20), title: 'PAN_Rajesh.jpg');
  final docs = [
    _passportDoc,
    doc('doc2', 'c1', DocumentCategory.emiratesIdFront, DocumentStatus.received, title: 'Aadhaar_front.jpg'),
    doc('doc3', 'c1', DocumentCategory.emiratesIdBack, DocumentStatus.requested),
    doc('doc4', 'c8', DocumentCategory.passport, DocumentStatus.verified),
    doc('doc5', 'c8', DocumentCategory.emiratesIdFront, DocumentStatus.verified),
    doc('doc6', 'c8', DocumentCategory.salaryCertificate, DocumentStatus.received),
    doc('doc7', 'c6', DocumentCategory.passport, DocumentStatus.verified, expiry: _in(days: 12)),
    doc('doc8', 'c3', DocumentCategory.tradeLicense, DocumentStatus.verified, expiry: _ago(days: 3)),
  ];
  final notes = [
    VoiceNote(id: 'v1', createdAt: _ago(days: 1, hours: 2), updatedAt: _ago(days: 1), clientId: 'c1', durationMs: 42000,
        transcript: 'Rajesh wants the Jeevan Anand quote for 20 lakh cover. Send PAN and Aadhaar checklist on WhatsApp.'),
    VoiceNote(id: 'v2', createdAt: _ago(days: 4), updatedAt: _ago(days: 4), clientId: 'c1', durationMs: 18000,
        transcript: 'Spouse will also be added as nominee. Call back Saturday morning.'),
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
  await SettingsStore(_prefs, Hive.box(HiveService.settings)).setProfile(const UserProfile(name: 'Anjali Menon', mobile: '+91 98765 43210'));
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
    await File('$_out/$file.png').writeAsBytes(bytes!.buffer.asUint8List());
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
    Directory(_out).createSync(recursive: true);
    dir = await Directory.systemTemp.createTemp('anjali_shots');
    Hive.init(dir.path);
    _prefs = await Hive.openBox(HiveService.prefsBox);
    for (final name in HiveService.encryptedBoxes) {
      await Hive.openBox(name);
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
    ('13-document-preview', () => DocumentPreviewScreen(document: _passportDoc), null),
    ('14-whatsapp-files', () => const WhatsAppFilesScreen(extensions: ['jpg', 'jpeg', 'png', 'pdf']), null),
    ('15-card-scanner', () => const CardScannerScreen(), null),
    ('16-followups', () => const FollowupsScreen(), null),
    ('17-search', () => const SearchScreen(), (t) async {
      await t.enterText(find.byType(TextField).first, 'ra');
    }),
    ('18-reports', () => const ReportsScreen(), null),
    ('19-location-picker', () => const LocationPickerScreen(), null),
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
