import 'package:anjali_crm_ai/data/crm_database.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

Map<String, Object?> contact(String name, {String company = '', String phone = '', String email = ''}) => {
      'name': name,
      'company': company,
      'phone': phone,
      'email': email,
      'notes': '',
      'created_at': '2026-01-01T00:00:00.000',
    };

Map<String, Object?> activity(String title, {String? due, int? contactId}) => {
      'title': title,
      'notes': '',
      'due_at': due,
      'contact_id': contactId,
      'completed': 0,
      'created_at': '2026-01-01T00:00:00.000',
    };

void main() {
  late CrmDatabase db;

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  setUp(() => db = CrmDatabase.withPath(inMemoryDatabasePath));
  tearDown(() => db.close());

  group('contacts', () {
    test('are listed by name, case-insensitively', () async {
      await db.saveContact(contact('bob'));
      await db.saveContact(contact('Alice'));
      await db.saveContact(contact('Carol'));
      final names = (await db.contacts()).map((c) => c['name']).toList();
      expect(names, ['Alice', 'bob', 'Carol']);
    });

    test('search matches name, company, phone and email', () async {
      await db.saveContact(contact('Alice', company: 'Emirates NBD'));
      await db.saveContact(contact('Bob', phone: '+971 50 123 4567'));
      await db.saveContact(contact('Carol', email: 'carol@example.com'));
      await db.saveContact(contact('Dan'));
      Future<List<Object?>> find(String q) async => (await db.contacts(search: q)).map((c) => c['name']).toList();
      expect(await find('nbd'), ['Alice']);
      expect(await find('123'), ['Bob']);
      expect(await find('EXAMPLE'), ['Carol']);
      expect(await find('  dan  '), ['Dan']);
      expect(await find('nobody'), isEmpty);
    });

    test('saving with an id updates in place and returns that id', () async {
      final id = await db.saveContact(contact('Alice'));
      final again = await db.saveContact({...contact('Alice Smith'), 'id': id});
      expect(again, id);
      final rows = await db.contacts();
      expect(rows, hasLength(1));
      expect(rows.single['name'], 'Alice Smith');
    });

    test('updating a contact that no longer exists fails loudly', () async {
      expect(() => db.saveContact({...contact('Ghost'), 'id': 999}), throwsStateError);
    });

    test('deleting a contact keeps its activities but unlinks them', () async {
      final id = await db.saveContact(contact('Alice'));
      await db.saveActivity(activity('Call Alice', contactId: id));
      await db.deleteContact(id);
      expect(await db.contacts(), isEmpty);
      final acts = await db.activities();
      expect(acts, hasLength(1));
      expect(acts.single['contact_id'], isNull);
      expect(acts.single['contact_name'], isNull);
    });

    test('foreign keys are enforced on every connection', () async {
      // A raw delete bypasses deleteContact; only SQLite's ON DELETE SET NULL
      // can unlink the activity, and SQLite applies it only when
      // PRAGMA foreign_keys is on.
      final id = await db.saveContact(contact('Alice'));
      await db.saveActivity(activity('Call Alice', contactId: id));
      await (await db.database).delete('contacts', where: 'id = ?', whereArgs: [id]);
      expect((await db.activities()).single['contact_id'], isNull);
    });
  });

  group('activities', () {
    test('carry the linked contact name', () async {
      final id = await db.saveContact(contact('Alice'));
      await db.saveActivity(activity('Call Alice', contactId: id));
      await db.saveActivity(activity('Admin'));
      final byTitle = {for (final a in await db.activities()) a['title']: a['contact_name']};
      expect(byTitle, {'Call Alice': 'Alice', 'Admin': null});
    });

    test('sort by due date with undated ones last', () async {
      await db.saveActivity(activity('undated'));
      await db.saveActivity(activity('later', due: '2026-03-01T00:00:00.000'));
      await db.saveActivity(activity('sooner', due: '2026-02-01T00:00:00.000'));
      expect((await db.activities()).map((a) => a['title']), ['sooner', 'later', 'undated']);
    });

    test('can be edited, completed and deleted', () async {
      final id = await db.saveActivity(activity('Draft'));
      // A row read back from activities() includes contact_name, which is not
      // a column; saving it must still work.
      final row = (await db.activities()).single;
      expect(await db.saveActivity({...row, 'title': 'Final'}), id);
      await db.setActivityCompleted(id, true);
      var a = (await db.activities()).single;
      expect(a['title'], 'Final');
      expect(a['completed'], 1);
      expect(await db.activities(openOnly: true), isEmpty);
      await db.deleteActivity(id);
      expect(await db.activities(), isEmpty);
    });

    test('updating an activity that no longer exists fails loudly', () async {
      expect(() => db.saveActivity({...activity('Ghost'), 'id': 999}), throwsStateError);
    });
  });

  test('counts contacts and open activities', () async {
    final id = await db.saveContact(contact('Alice'));
    await db.saveContact(contact('Bob'));
    final done = await db.saveActivity(activity('Done', contactId: id));
    await db.saveActivity(activity('Open'));
    await db.setActivityCompleted(done, true);
    expect(await db.contactCount(), 2);
    expect(await db.openActivityCount(), 1);
  });
}
