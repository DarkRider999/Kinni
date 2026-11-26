import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Local SQLite store for contacts and activities.
///
/// The app uses [instance]. Tests build their own store with
/// [CrmDatabase.withPath] (for example `inMemoryDatabasePath`) so every test
/// starts from an empty database.
class CrmDatabase {
  CrmDatabase._(this._pathOverride);

  /// Store backed by [path] instead of the app's default database file.
  CrmDatabase.withPath(String path) : this._(path);

  static CrmDatabase instance = CrmDatabase._(null);

  static const fileName = 'anjali_crm_ai.db';
  static const schemaVersion = 1;

  final String? _pathOverride;
  Future<Database>? _opening;

  Future<Database> get database => _opening ??= _open();

  Future<Database> _open() async {
    final path = _pathOverride ?? p.join(await getDatabasesPath(), fileName);
    return openDatabase(
      path,
      version: schemaVersion,
      // SQLite leaves foreign keys off unless every connection turns them on;
      // without this the ON DELETE SET NULL rule below is never applied.
      onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE contacts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE activities(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            due_at TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            contact_id INTEGER,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE SET NULL
          )
        ''');
        await db.execute('CREATE INDEX idx_activities_contact ON activities(contact_id)');
      },
    );
  }

  Future<void> close() async {
    final opening = _opening;
    _opening = null;
    if (opening == null) return;
    final Database db;
    try {
      db = await opening;
    } catch (_) {
      return; // It never opened (the error was already shown), so nothing to close.
    }
    await db.close();
  }

  // ---------------------------------------------------------------- contacts

  Future<List<Map<String, Object?>>> contacts({String search = ''}) async {
    final db = await database;
    final term = search.trim();
    if (term.isEmpty) {
      return db.query('contacts', orderBy: 'name COLLATE NOCASE ASC');
    }
    final q = '%$term%';
    return db.query(
      'contacts',
      where: 'name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ?',
      whereArgs: [q, q, q, q],
      orderBy: 'name COLLATE NOCASE ASC',
    );
  }

  /// Inserts the contact when it has no `id`, otherwise updates it.
  /// Returns the contact's id.
  Future<int> saveContact(Map<String, Object?> contact) async {
    final db = await database;
    final id = contact['id'] as int?;
    if (id == null) return db.insert('contacts', contact);
    final changed = await db.update('contacts', contact, where: 'id = ?', whereArgs: [id]);
    if (changed == 0) throw StateError('Contact $id no longer exists.');
    return id;
  }

  /// Deletes the contact and unlinks its activities in one transaction, so a
  /// failure part-way leaves both tables unchanged.
  Future<void> deleteContact(int id) async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.update('activities', {'contact_id': null}, where: 'contact_id = ?', whereArgs: [id]);
      await txn.delete('contacts', where: 'id = ?', whereArgs: [id]);
    });
  }

  Future<int> contactCount() async {
    final db = await database;
    return Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM contacts')) ?? 0;
  }

  // -------------------------------------------------------------- activities

  /// Activities with the linked contact's name as `contact_name` (null when
  /// unlinked). Undated activities sort last.
  Future<List<Map<String, Object?>>> activities({bool openOnly = false}) async {
    final db = await database;
    return db.rawQuery('''
      SELECT a.*, c.name AS contact_name
      FROM activities a
      LEFT JOIN contacts c ON c.id = a.contact_id
      ${openOnly ? 'WHERE a.completed = 0' : ''}
      ORDER BY a.due_at IS NULL, a.due_at ASC, a.id DESC
    ''');
  }

  /// Inserts the activity when it has no `id`, otherwise updates it.
  /// Returns the activity's id.
  Future<int> saveActivity(Map<String, Object?> item) async {
    final db = await database;
    final row = Map<String, Object?>.of(item)..remove('contact_name');
    final id = row['id'] as int?;
    if (id == null) return db.insert('activities', row);
    final changed = await db.update('activities', row, where: 'id = ?', whereArgs: [id]);
    if (changed == 0) throw StateError('Activity $id no longer exists.');
    return id;
  }

  Future<void> setActivityCompleted(int id, bool completed) async {
    final db = await database;
    await db.update('activities', {'completed': completed ? 1 : 0}, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> deleteActivity(int id) async {
    final db = await database;
    await db.delete('activities', where: 'id = ?', whereArgs: [id]);
  }

  Future<int> openActivityCount() async {
    final db = await database;
    return Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM activities WHERE completed = 0'),
        ) ??
        0;
  }
}
