import 'dart:io';

import 'package:anjali_crm_ai/data/crm_database.dart';
import 'package:anjali_crm_ai/data/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

final fixedNow = DateTime(2026, 11, 26, 10, 0);

Client lead(String name, {String phone = '', LeadStatus status = LeadStatus.newLead, int? productId, double? salary, String company = '', String location = ''}) =>
    Client(name: name, phone: phone, status: status, productId: productId, salary: salary, company: company, location: location);

void main() {
  late CrmDatabase db;

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  setUp(() => db = CrmDatabase.withPath(inMemoryDatabasePath, clock: () => fixedNow));
  tearDown(() => db.close());

  test('a new database is seeded with the guide\'s six products and their documents', () async {
    final products = await db.products();
    expect(products.map((p) => p.name), ['Personal Loan', 'Business Loan', 'Mortgage', 'Credit Card', 'Auto Loan', 'Insurance']);
    final card = products.firstWhere((p) => p.name == 'Credit Card');
    expect(card.requiredDocs, contains('Credit Card Form'));
    expect(card.requiredDocs, isNot(contains('Loan Application Form')));
    expect(products.firstWhere((p) => p.name == 'Insurance').requiredDocs, ['Passport', 'Emirates ID Front', 'Emirates ID Back']);
  });

  group('clients', () {
    test('saving a new lead records "Lead created" on the timeline', () async {
      final id = await db.saveClient(lead('Aisha', phone: '+971 50 123 4567'));
      final c = await db.client(id);
      expect(c!.name, 'Aisha');
      expect(c.status, LeadStatus.newLead);
      expect(c.createdAt, fixedNow);
      expect((await db.timeline(id)).single.title, 'Lead created');
    });

    test('editing a lead that changed status logs both the edit and the status change', () async {
      final id = await db.saveClient(lead('Aisha'));
      final c = (await db.client(id))!;
      await db.saveClient(Client(id: id, name: c.name, phone: c.phone, status: LeadStatus.interested));
      final titles = (await db.timeline(id)).map((e) => e.title).toList();
      expect(titles, containsAll(['Details updated', 'Status: Interested', 'Lead created']));
    });

    test('updating a client that no longer exists fails loudly', () async {
      expect(() => db.saveClient(const Client(id: 999, name: 'Ghost', phone: '')), throwsStateError);
    });

    test('search covers name, phone in any format, company, location, product, status and salary', () async {
      final products = await db.products();
      final mortgage = products.firstWhere((p) => p.name == 'Mortgage').id;
      await db.saveClient(lead('Aisha', phone: '+971 50 123 4567', company: 'Emirates NBD'));
      await db.saveClient(lead('Bilal', location: 'Dubai Marina', productId: mortgage));
      await db.saveClient(lead('Chen', salary: 15000, status: LeadStatus.approved));
      Future<List<String>> find(String q) async => (await db.clients(ClientQuery(search: q, sort: ClientSort.nameAsc))).map((c) => c.name).toList();
      expect(await find('aish'), ['Aisha']);
      expect(await find('050 123 4567'), ['Aisha'], reason: 'local format finds the international number');
      expect(await find('nbd'), ['Aisha']);
      expect(await find('marina'), ['Bilal']);
      expect(await find('mortgage'), ['Bilal']);
      expect(await find('approved'), ['Chen']);
      expect(await find('15000'), ['Chen']);
      expect(await find('nobody'), isEmpty);
    });

    test('filters by status, product and priority', () async {
      final loan = (await db.products()).first.id;
      await db.saveClient(lead('A', status: LeadStatus.interested, productId: loan));
      await db.saveClient(const Client(name: 'B', phone: '', status: LeadStatus.interested, priority: Priority.high));
      await db.saveClient(lead('C', status: LeadStatus.rejected));
      Future<List<String>> names(ClientQuery q) async => (await db.clients(q)).map((c) => c.name).toList()..sort();
      expect(await names(const ClientQuery(statuses: {LeadStatus.interested})), ['A', 'B']);
      expect(await names(ClientQuery(productId: loan)), ['A']);
      expect(await names(const ClientQuery(priority: Priority.high)), ['B']);
    });

    test('sorts by next followup with no-followup leads last, and by lead score', () async {
      final a = await db.saveClient(lead('A'));
      final b = await db.saveClient(lead('B', status: LeadStatus.approved));
      await db.saveClient(lead('C'));
      await db.addFollowup(a, fixedNow.add(const Duration(days: 2)));
      await db.addFollowup(b, fixedNow.add(const Duration(days: 1)));
      expect((await db.clients(const ClientQuery(sort: ClientSort.nextFollowup))).map((c) => c.name), ['B', 'A', 'C']);
      expect((await db.clients(const ClientQuery(sort: ClientSort.leadScore))).first.name, 'B');
    });

    test('duplicate check matches the same number written differently', () async {
      final id = await db.saveClient(lead('Aisha', phone: '+971 50 123 4567'));
      expect((await db.clientsWithPhone('050-123-4567')).single.id, id);
      expect((await db.clientsWithPhone('00971501234567')).single.id, id);
      expect(await db.clientsWithPhone('050 999 0000'), isEmpty);
      expect(await db.clientsWithPhone('050-123-4567', excludeId: id), isEmpty, reason: 'editing yourself is not a duplicate');
      expect(await db.clientsWithPhone('123'), isEmpty, reason: 'too short to compare');
    });

    test('deleting a client removes their followups, calls and timeline', () async {
      final id = await db.saveClient(lead('Aisha'));
      await db.addFollowup(id, fixedNow);
      await db.logCall(id, 'No answer');
      await db.deleteClient(id);
      expect(await db.client(id), isNull);
      expect(await db.followups(), isEmpty);
      expect(await db.calls(id), isEmpty);
      expect(await db.timeline(id), isEmpty);
    });
  });

  group('pipeline', () {
    test('approved and disbursed store their AED amount', () async {
      final id = await db.saveClient(lead('Aisha'));
      await db.changeStatus(id, LeadStatus.approved, amount: 50000);
      await db.changeStatus(id, LeadStatus.disbursed, amount: 48000);
      final c = (await db.client(id))!;
      expect(c.status, LeadStatus.disbursed);
      expect(c.approvedAmount, 50000);
      expect(c.disbursedAmount, 48000);
      final events = await db.timeline(id);
      expect(events.first.title, 'Status: Disbursed');
      expect(events.first.detail, contains('AED 48000'));
    });

    test('approved without an amount is refused', () async {
      final id = await db.saveClient(lead('Aisha'));
      expect(() => db.changeStatus(id, LeadStatus.approved), throwsArgumentError);
      expect((await db.client(id))!.status, LeadStatus.newLead);
    });
  });

  group('followups and calls', () {
    test('complete, reopen, reschedule and delete', () async {
      final id = await db.saveClient(lead('Aisha'));
      final f = await db.addFollowup(id, fixedNow.add(const Duration(hours: 2)), note: 'Send form');
      await db.completeFollowup(f, outcome: 'Sent');
      var row = (await db.followups()).single;
      expect(row.isDone, isTrue);
      expect(row.outcome, 'Sent');
      expect(row.clientName, 'Aisha');
      await db.reopenFollowup(f);
      await db.rescheduleFollowup(f, fixedNow.add(const Duration(days: 3)));
      row = (await db.followups(clientId: id)).single;
      expect(row.isDone, isFalse);
      expect(row.dueAt, fixedNow.add(const Duration(days: 3)));
      await db.deleteFollowup(f);
      expect(await db.followups(), isEmpty);
    });

    test('a "call back" outcome schedules a followup', () async {
      final id = await db.saveClient(lead('Aisha'));
      final when = fixedNow.add(const Duration(days: 1));
      await db.logCall(id, callBackOutcome, notes: 'Busy at work', callBackAt: when);
      expect((await db.calls(id)).single.outcome, callBackOutcome);
      final f = (await db.followups(clientId: id)).single;
      expect(f.dueAt, when);
      expect(f.note, 'Call back');
    });

    test('the latest call decides the wrong-number warning', () async {
      final id = await db.saveClient(lead('Aisha'));
      expect(await db.isFlaggedWrongNumber(id), isFalse);
      await db.logCall(id, wrongNumberOutcome);
      expect(await db.isFlaggedWrongNumber(id), isTrue);
    });
  });

  test('dashboard counts statuses, today\'s and overdue followups, and this month\'s conversions', () async {
    final a = await db.saveClient(lead('A'));
    final b = await db.saveClient(lead('B'));
    await db.saveClient(lead('C', status: LeadStatus.interested));
    await db.changeStatus(b, LeadStatus.disbursed, amount: 30000);
    await db.addFollowup(a, DateTime(2026, 11, 26, 15)); // later today
    await db.addFollowup(a, DateTime(2026, 11, 25, 9)); // overdue
    await db.addFollowup(a, DateTime(2026, 11, 27, 9)); // tomorrow
    final s = await db.dashboard();
    expect(s.totalLeads, 3);
    expect(s.count(LeadStatus.newLead), 1);
    expect(s.count(LeadStatus.interested), 1);
    expect(s.count(LeadStatus.disbursed), 1);
    expect(s.followupsToday, 1);
    expect(s.overdue, 1);
    expect(s.conversionsThisMonth, 1);
    expect(s.disbursedThisMonth, 30000);
  });

  test('foreign keys are enforced on every connection', () async {
    final id = await db.saveClient(lead('Aisha'));
    await db.addFollowup(id, fixedNow);
    // A raw delete bypasses deleteClient; only ON DELETE CASCADE removes the
    // followup, and SQLite applies it only when PRAGMA foreign_keys is on.
    await (await db.database).delete('clients', where: 'id = ?', whereArgs: [id]);
    expect(await db.followups(), isEmpty);
  });

  test('upgrading a version 1 database keeps every contact and activity', () async {
    final dir = Directory.systemTemp.createTempSync('crm_migrate');
    addTearDown(() => dir.deleteSync(recursive: true));
    final path = '${dir.path}/v1.db';
    // Build the exact schema the original app shipped.
    final v1 = await databaseFactory.openDatabase(path, options: OpenDatabaseOptions(version: 1, onCreate: (d, _) async {
      await d.execute('''CREATE TABLE contacts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)''');
      await d.execute('''CREATE TABLE activities(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, due_at TEXT,
        completed INTEGER NOT NULL DEFAULT 0, contact_id INTEGER, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE SET NULL)''');
    }));
    await v1.insert('contacts', {'id': 7, 'name': 'Aisha', 'company': 'NBD', 'phone': '0501234567', 'email': 'a@x.com', 'notes': 'VIP', 'created_at': '2026-01-01T09:00:00.000'});
    await v1.insert('activities', {'title': 'Call', 'due_at': '2026-02-01T00:00:00.000', 'completed': 1, 'contact_id': 7, 'notes': 'about loan', 'created_at': '2026-01-02T00:00:00.000'});
    await v1.insert('activities', {'title': 'Admin', 'due_at': null, 'completed': 0, 'contact_id': null, 'notes': '', 'created_at': '2026-01-03T00:00:00.000'});
    await v1.close();

    final upgraded = CrmDatabase.withPath(path, clock: () => fixedNow);
    addTearDown(upgraded.close);
    final c = (await upgraded.client(7))!;
    expect(c.name, 'Aisha');
    expect(c.company, 'NBD');
    expect(c.email, 'a@x.com');
    expect(c.remarks, 'VIP');
    expect(c.status, LeadStatus.newLead);
    expect((await upgraded.clientsWithPhone('+971 50 123 4567')).single.id, 7, reason: 'phone key filled in');
    final fs = await upgraded.followups();
    expect(fs, hasLength(2));
    final linked = fs.firstWhere((f) => f.clientId == 7);
    expect(linked.note, 'Call\nabout loan');
    expect(linked.isDone, isTrue);
    final unlinked = fs.firstWhere((f) => f.clientId == null);
    expect(unlinked.note, 'Admin');
    expect(unlinked.dueAt, DateTime.parse('2026-01-03T00:00:00.000'), reason: 'undated activity falls back to its creation time');
    expect((await upgraded.products()).length, 6);
    final tables = (await (await upgraded.database).rawQuery("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r['name']);
    expect(tables, isNot(contains('contacts')));
    expect(tables, isNot(contains('activities')));
  });
}
