import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'lead_score.dart';
import 'models.dart';
import 'phone.dart';

/// How the clients list is ordered (guide §6 "Sort").
enum ClientSort { recentlyUpdated, nameAsc, leadScore, nextFollowup }

/// Filters for [CrmDatabase.clients]. Empty fields mean "any".
class ClientQuery {
  const ClientQuery({
    this.search = '',
    this.statuses = const {},
    this.productId,
    this.priority,
    this.sort = ClientSort.recentlyUpdated,
  });

  final String search;
  final Set<LeadStatus> statuses;
  final int? productId;
  final Priority? priority;
  final ClientSort sort;
}

/// Counts behind the Home dashboard (guide §5).
class DashboardStats {
  const DashboardStats({
    required this.byStatus,
    required this.totalLeads,
    required this.followupsToday,
    required this.overdue,
    required this.conversionsThisMonth,
    required this.disbursedThisMonth,
  });

  final Map<LeadStatus, int> byStatus;
  final int totalLeads;
  final int followupsToday;
  final int overdue;

  /// Leads that reached Approved or Disbursed this calendar month.
  final int conversionsThisMonth;

  /// AED disbursed this calendar month.
  final double disbursedThisMonth;

  int count(LeadStatus s) => byStatus[s] ?? 0;
}

/// Local SQLite store.
///
/// The app uses [instance]. Tests build their own with
/// [CrmDatabase.withPath] (for example `inMemoryDatabasePath`).
class CrmDatabase {
  CrmDatabase._(this._pathOverride, this._clock);

  /// Store backed by [path]. [clock] lets tests fix "now".
  CrmDatabase.withPath(String path, {DateTime Function()? clock}) : this._(path, clock ?? DateTime.now);

  static CrmDatabase instance = CrmDatabase._(null, DateTime.now);

  static const fileName = 'anjali_crm_ai.db';

  /// 1: contacts + activities (original source). 2: lead CRM (clients,
  /// products, followups, calls, timeline).
  static const schemaVersion = 2;

  final String? _pathOverride;
  final DateTime Function() _clock;
  Future<Database>? _opening;

  DateTime get now => _clock();
  String _stamp([DateTime? t]) => (t ?? now).toIso8601String();

  Future<Database> get database => _opening ??= _open();

  Future<Database> _open() async {
    final path = _pathOverride ?? p.join(await getDatabasesPath(), fileName);
    return openDatabase(
      path,
      version: schemaVersion,
      // SQLite leaves foreign keys off unless every connection turns them on.
      onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
      onCreate: (db, version) async {
        await _createV2(db);
        await _seedProducts(db);
      },
      onUpgrade: (db, from, to) async {
        if (from < 2) await _upgradeV1ToV2(db);
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

  // ------------------------------------------------------------------ schema

  static Future<void> _createV2(DatabaseExecutor db) async {
    await db.execute('''
      CREATE TABLE products(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        required_docs TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      )''');
    await db.execute('''
      CREATE TABLE clients(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        phone_key TEXT NOT NULL DEFAULT '',
        whatsapp TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL DEFAULT '',
        job_title TEXT NOT NULL DEFAULT '',
        nationality TEXT NOT NULL DEFAULT '',
        salary REAL,
        requested_amount REAL,
        approved_amount REAL,
        disbursed_amount REAL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        source TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new_lead',
        priority TEXT NOT NULL DEFAULT 'medium',
        rating INTEGER NOT NULL DEFAULT 0,
        remarks TEXT NOT NULL DEFAULT '',
        is_sample INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status_changed_at TEXT NOT NULL
      )''');
    await db.execute('CREATE INDEX idx_clients_phone_key ON clients(phone_key)');
    await db.execute('CREATE INDEX idx_clients_status ON clients(status)');
    await db.execute('''
      CREATE TABLE followups(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        due_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        completed_at TEXT,
        outcome TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )''');
    await db.execute('CREATE INDEX idx_followups_client ON followups(client_id)');
    await db.execute('CREATE INDEX idx_followups_due ON followups(completed_at, due_at)');
    await db.execute('''
      CREATE TABLE calls(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        called_at TEXT NOT NULL,
        outcome TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      )''');
    await db.execute('CREATE INDEX idx_calls_client ON calls(client_id)');
    await db.execute('''
      CREATE TABLE timeline(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        at TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT ''
      )''');
    await db.execute('CREATE INDEX idx_timeline_client ON timeline(client_id, at)');
  }

  /// The products and required documents listed in the user guide (§22).
  static const defaultProducts = <String, List<String>>{
    'Personal Loan': _loanDocs,
    'Business Loan': [
      'Passport', 'Emirates ID Front', 'Emirates ID Back', 'Bank Statement',
      'Company Trade License', 'Loan Application Form',
    ],
    'Mortgage': _loanDocs,
    'Credit Card': [
      'Passport', 'Emirates ID Front', 'Emirates ID Back', 'Visa',
      'Salary Certificate', 'Bank Statement', 'Credit Card Form',
    ],
    'Auto Loan': _loanDocs,
    'Insurance': ['Passport', 'Emirates ID Front', 'Emirates ID Back'],
  };
  static const _loanDocs = [
    'Passport', 'Emirates ID Front', 'Emirates ID Back', 'Visa',
    'Salary Certificate', 'Bank Statement', 'Loan Application Form',
  ];

  static Future<void> _seedProducts(DatabaseExecutor db) async {
    var order = 0;
    for (final e in defaultProducts.entries) {
      await db.insert('products', {'name': e.key, 'required_docs': e.value.join('|'), 'sort_order': order++});
    }
  }

  /// Version 1 had `contacts` and `activities`. Every contact becomes a New
  /// Lead and every activity a followup, so nothing is lost on update.
  /// sqflite runs this inside one transaction: it applies fully or not at all.
  static Future<void> _upgradeV1ToV2(DatabaseExecutor db) async {
    await _createV2(db);
    await _seedProducts(db);
    final contacts = await db.query('contacts', orderBy: 'id');
    for (final c in contacts) {
      final phone = c['phone'] as String;
      final created = c['created_at'] as String;
      await db.insert('clients', {
        'id': c['id'], // keep ids so migrated activities stay linked
        'name': c['name'],
        'phone': phone,
        'phone_key': phoneKey(phone),
        'email': c['email'],
        'company': c['company'],
        'remarks': c['notes'],
        'created_at': created,
        'updated_at': created,
        'status_changed_at': created,
      });
      await db.insert('timeline', {
        'client_id': c['id'],
        'at': created,
        'kind': TimelineKind.created.name,
        'title': 'Lead created',
        'detail': 'Imported from the previous version',
      });
    }
    final activities = await db.query('activities', orderBy: 'id');
    for (final a in activities) {
      final created = a['created_at'] as String;
      final title = a['title'] as String;
      final notes = a['notes'] as String;
      await db.insert('followups', {
        'client_id': a['contact_id'],
        'due_at': (a['due_at'] as String?) ?? created,
        'note': notes.isEmpty ? title : '$title\n$notes',
        'completed_at': a['completed'] == 1 ? created : null,
        'created_at': created,
      });
    }
    await db.execute('DROP TABLE activities');
    await db.execute('DROP TABLE contacts');
  }

  // ---------------------------------------------------------------- products

  Future<List<Product>> products({bool activeOnly = false}) async {
    final db = await database;
    final rows = await db.query('products', where: activeOnly ? 'active = 1' : null, orderBy: 'sort_order, name');
    return rows.map(Product.fromRow).toList();
  }

  // ----------------------------------------------------------------- clients

  static const _clientSelect = '''
    SELECT c.*, pr.name AS product_name,
      (SELECT MIN(f.due_at) FROM followups f
        WHERE f.client_id = c.id AND f.completed_at IS NULL) AS next_followup_at
    FROM clients c
    LEFT JOIN products pr ON pr.id = c.product_id''';

  /// Clients matching [q]. Search covers name, phone (any formatting),
  /// company, location, product, status and salary (guide §16).
  Future<List<Client>> clients([ClientQuery q = const ClientQuery()]) async {
    final db = await database;
    final where = <String>[];
    final args = <Object?>[];

    final term = q.search.trim();
    if (term.isNotEmpty) {
      final like = '%$term%';
      final parts = [
        'c.name LIKE ?', 'c.phone LIKE ?', 'c.company LIKE ?', 'c.location LIKE ?',
        'pr.name LIKE ?', "CAST(CAST(c.salary AS INTEGER) AS TEXT) LIKE ?",
      ];
      args.addAll([like, like, like, like, like, like]);
      final digits = phoneSearchDigits(term);
      if (digits.length >= 3) {
        parts.add('c.phone_key LIKE ?');
        args.add('%$digits%');
      }
      final statusHits = LeadStatus.values.where((s) => s.label.toLowerCase().contains(term.toLowerCase()));
      if (statusHits.isNotEmpty) {
        parts.add('c.status IN (${List.filled(statusHits.length, '?').join(',')})');
        args.addAll(statusHits.map((s) => s.key));
      }
      where.add('(${parts.join(' OR ')})');
    }
    if (q.statuses.isNotEmpty) {
      where.add('c.status IN (${List.filled(q.statuses.length, '?').join(',')})');
      args.addAll(q.statuses.map((s) => s.key));
    }
    if (q.productId != null) {
      where.add('c.product_id = ?');
      args.add(q.productId);
    }
    if (q.priority != null) {
      where.add('c.priority = ?');
      args.add(q.priority!.key);
    }

    final order = switch (q.sort) {
      ClientSort.nameAsc => 'c.name COLLATE NOCASE ASC',
      ClientSort.nextFollowup => 'next_followup_at IS NULL, next_followup_at ASC, c.name COLLATE NOCASE',
      _ => 'c.updated_at DESC, c.id DESC',
    };
    final rows = await db.rawQuery(
      '$_clientSelect ${where.isEmpty ? '' : 'WHERE ${where.join(' AND ')}'} ORDER BY $order',
      args,
    );
    final list = rows.map(Client.fromRow).toList();
    if (q.sort == ClientSort.leadScore) {
      final at = now;
      list.sort((a, b) => leadScore(b, now: at).compareTo(leadScore(a, now: at)));
    }
    return list;
  }

  Future<Client?> client(int id) async {
    final db = await database;
    final rows = await db.rawQuery('$_clientSelect WHERE c.id = ?', [id]);
    return rows.isEmpty ? null : Client.fromRow(rows.single);
  }

  /// Existing clients whose phone or WhatsApp number is the same number as
  /// [phone], however it is written (guide §7 "Duplicates").
  Future<List<Client>> clientsWithPhone(String phone, {int? excludeId}) async {
    final key = phoneKey(phone);
    if (key.length < 7) return const [];
    final db = await database;
    final rows = await db.rawQuery(
      '$_clientSelect WHERE c.phone_key = ? ${excludeId == null ? '' : 'AND c.id != ?'} ORDER BY c.name',
      [key, if (excludeId != null) excludeId],
    );
    return rows.map(Client.fromRow).toList();
  }

  /// Inserts the client when [Client.id] is null, otherwise updates it, and
  /// records the change on the timeline. Returns the id.
  Future<int> saveClient(Client c) async {
    final db = await database;
    final stamp = _stamp();
    return db.transaction((txn) async {
      final row = {...c.toRow(), 'phone_key': phoneKey(c.phone), 'updated_at': stamp};
      if (c.id == null) {
        final id = await txn.insert('clients', {...row, 'created_at': stamp, 'status_changed_at': stamp});
        await _addEvent(txn, id, TimelineKind.created, 'Lead created',
            [c.productName, c.status.label].whereType<String>().join(' · '), stamp);
        return id;
      }
      final before = await txn.query('clients', columns: ['status'], where: 'id = ?', whereArgs: [c.id]);
      if (before.isEmpty) throw StateError('Client ${c.id} no longer exists.');
      final oldStatus = LeadStatus.fromKey(before.single['status'] as String?);
      await txn.update('clients', {
        ...row,
        if (oldStatus != c.status) 'status_changed_at': stamp,
      }, where: 'id = ?', whereArgs: [c.id]);
      await _addEvent(txn, c.id!, TimelineKind.edited, 'Details updated', '', stamp);
      if (oldStatus != c.status) {
        await _addEvent(txn, c.id!, TimelineKind.statusChanged, 'Status: ${c.status.label}', 'From ${oldStatus.label}', stamp);
      }
      return c.id!;
    });
  }

  /// Moves a lead to [status]. For Approved and Disbursed, [amount] (AED) is
  /// stored as the approved or disbursed amount.
  Future<void> changeStatus(int clientId, LeadStatus status, {double? amount, String note = ''}) async {
    if (status.needsAmount && (amount == null || amount <= 0)) {
      throw ArgumentError('${status.label} needs an amount in AED.');
    }
    final db = await database;
    final stamp = _stamp();
    await db.transaction((txn) async {
      final before = await txn.query('clients', columns: ['status'], where: 'id = ?', whereArgs: [clientId]);
      if (before.isEmpty) throw StateError('Client $clientId no longer exists.');
      final oldStatus = LeadStatus.fromKey(before.single['status'] as String?);
      await txn.update('clients', {
        'status': status.key,
        'status_changed_at': stamp,
        'updated_at': stamp,
        if (status == LeadStatus.approved) 'approved_amount': amount,
        if (status == LeadStatus.disbursed) 'disbursed_amount': amount,
      }, where: 'id = ?', whereArgs: [clientId]);
      final detail = [
        'From ${oldStatus.label}',
        if (amount != null) 'AED ${amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2)}',
        if (note.trim().isNotEmpty) note.trim(),
      ].join(' · ');
      await _addEvent(txn, clientId, TimelineKind.statusChanged, 'Status: ${status.label}', detail, stamp);
    });
  }

  /// Deletes the client with their followups, calls and timeline (guide §8).
  Future<void> deleteClient(int id) async {
    final db = await database;
    await db.delete('clients', where: 'id = ?', whereArgs: [id]);
  }

  // --------------------------------------------------------------- followups

  static const _followupSelect = '''
    SELECT f.*, c.name AS client_name, c.phone AS client_phone
    FROM followups f LEFT JOIN clients c ON c.id = f.client_id''';

  /// Followups, optionally for one client. Open ones first by due time, then
  /// completed ones newest first.
  Future<List<Followup>> followups({int? clientId}) async {
    final db = await database;
    final rows = await db.rawQuery(
      '$_followupSelect ${clientId == null ? '' : 'WHERE f.client_id = ?'} '
      'ORDER BY f.completed_at IS NOT NULL, '
      'CASE WHEN f.completed_at IS NULL THEN f.due_at END ASC, f.completed_at DESC',
      [if (clientId != null) clientId],
    );
    return rows.map(Followup.fromRow).toList();
  }

  Future<int> addFollowup(int clientId, DateTime dueAt, {String note = ''}) async {
    final db = await database;
    final stamp = _stamp();
    return db.transaction((txn) async {
      final id = await txn.insert('followups', {
        'client_id': clientId,
        'due_at': dueAt.toIso8601String(),
        'note': note.trim(),
        'created_at': stamp,
      });
      await _touch(txn, clientId, stamp);
      await _addEvent(txn, clientId, TimelineKind.followupAdded, 'Followup scheduled', _when(dueAt, note), stamp);
      return id;
    });
  }

  Future<void> completeFollowup(int id, {String outcome = ''}) async {
    final db = await database;
    final stamp = _stamp();
    await db.transaction((txn) async {
      final rows = await txn.query('followups', where: 'id = ?', whereArgs: [id]);
      if (rows.isEmpty) throw StateError('Followup $id no longer exists.');
      await txn.update('followups', {'completed_at': stamp, 'outcome': outcome.trim()}, where: 'id = ?', whereArgs: [id]);
      final clientId = rows.single['client_id'] as int?;
      if (clientId != null) {
        await _touch(txn, clientId, stamp);
        await _addEvent(txn, clientId, TimelineKind.followupDone, 'Followup completed',
            [rows.single['note'] as String, outcome.trim()].where((s) => s.isNotEmpty).join(' · '), stamp);
      }
    });
  }

  /// Puts a completed followup back on the open list.
  Future<void> reopenFollowup(int id) async {
    final db = await database;
    await db.update('followups', {'completed_at': null, 'outcome': ''}, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> rescheduleFollowup(int id, DateTime dueAt) async {
    final db = await database;
    final changed = await db.update('followups', {'due_at': dueAt.toIso8601String()}, where: 'id = ?', whereArgs: [id]);
    if (changed == 0) throw StateError('Followup $id no longer exists.');
  }

  Future<void> deleteFollowup(int id) async {
    final db = await database;
    await db.delete('followups', where: 'id = ?', whereArgs: [id]);
  }

  // ------------------------------------------------------------------- calls

  /// Records a call outcome. "Answered - call back" with [callBackAt] also
  /// schedules a followup (guide §13).
  Future<void> logCall(int clientId, String outcome, {String notes = '', DateTime? callBackAt}) async {
    final db = await database;
    final stamp = _stamp();
    await db.transaction((txn) async {
      await txn.insert('calls', {'client_id': clientId, 'called_at': stamp, 'outcome': outcome, 'notes': notes.trim()});
      await _touch(txn, clientId, stamp);
      await _addEvent(txn, clientId, TimelineKind.call, 'Call: $outcome', notes.trim(), stamp);
      if (callBackAt != null) {
        await txn.insert('followups', {
          'client_id': clientId,
          'due_at': callBackAt.toIso8601String(),
          'note': 'Call back',
          'created_at': stamp,
        });
        await _addEvent(txn, clientId, TimelineKind.followupAdded, 'Followup scheduled', _when(callBackAt, 'Call back'), stamp);
      }
    });
  }

  Future<List<CallLog>> calls(int clientId) async {
    final db = await database;
    final rows = await db.query('calls', where: 'client_id = ?', whereArgs: [clientId], orderBy: 'called_at DESC, id DESC');
    return rows.map(CallLog.fromRow).toList();
  }

  /// True when the client's latest call was logged as a wrong number, so the
  /// app can warn before dialling again (guide §13).
  Future<bool> isFlaggedWrongNumber(int clientId) async {
    final db = await database;
    final rows = await db.query('calls', columns: ['outcome'], where: 'client_id = ?', whereArgs: [clientId],
        orderBy: 'called_at DESC, id DESC', limit: 1);
    return rows.isNotEmpty && rows.single['outcome'] == wrongNumberOutcome;
  }

  // ---------------------------------------------------------------- timeline

  Future<List<TimelineEvent>> timeline(int clientId) async {
    final db = await database;
    final rows = await db.query('timeline', where: 'client_id = ?', whereArgs: [clientId], orderBy: 'at DESC, id DESC');
    return rows.map(TimelineEvent.fromRow).toList();
  }

  Future<void> addNote(int clientId, String note) async {
    final text = note.trim();
    if (text.isEmpty) throw ArgumentError('Note is empty.');
    final db = await database;
    final stamp = _stamp();
    await db.transaction((txn) async {
      await _touch(txn, clientId, stamp);
      await _addEvent(txn, clientId, TimelineKind.note, 'Note', text, stamp);
    });
  }

  // --------------------------------------------------------------- dashboard

  Future<DashboardStats> dashboard() async {
    final db = await database;
    final t = now;
    final startOfDay = DateTime(t.year, t.month, t.day);
    final startOfTomorrow = startOfDay.add(const Duration(days: 1));
    final startOfMonth = DateTime(t.year, t.month);

    final byStatus = <LeadStatus, int>{};
    var total = 0;
    for (final r in await db.rawQuery('SELECT status, COUNT(*) AS n FROM clients GROUP BY status')) {
      final n = r['n'] as int;
      byStatus[LeadStatus.fromKey(r['status'] as String?)] = n;
      total += n;
    }
    Future<int> count(String sql, List<Object?> args) async => Sqflite.firstIntValue(await db.rawQuery(sql, args)) ?? 0;

    final today = await count(
      'SELECT COUNT(*) FROM followups WHERE completed_at IS NULL AND due_at >= ? AND due_at < ?',
      [startOfDay.toIso8601String(), startOfTomorrow.toIso8601String()],
    );
    final overdue = await count(
      'SELECT COUNT(*) FROM followups WHERE completed_at IS NULL AND due_at < ?',
      [t.toIso8601String()],
    );
    final conversions = await count(
      "SELECT COUNT(*) FROM clients WHERE status IN ('approved','disbursed') AND status_changed_at >= ?",
      [startOfMonth.toIso8601String()],
    );
    final disbursed = await db.rawQuery(
      "SELECT COALESCE(SUM(disbursed_amount), 0) AS s FROM clients WHERE status = 'disbursed' AND status_changed_at >= ?",
      [startOfMonth.toIso8601String()],
    );
    return DashboardStats(
      byStatus: byStatus,
      totalLeads: total,
      followupsToday: today,
      overdue: overdue,
      conversionsThisMonth: conversions,
      disbursedThisMonth: (disbursed.single['s'] as num).toDouble(),
    );
  }

  // ----------------------------------------------------------------- helpers

  Future<void> _touch(DatabaseExecutor db, int clientId, String stamp) =>
      db.update('clients', {'updated_at': stamp}, where: 'id = ?', whereArgs: [clientId]);

  Future<void> _addEvent(DatabaseExecutor db, int clientId, TimelineKind kind, String title, String detail, String stamp) =>
      db.insert('timeline', {'client_id': clientId, 'at': stamp, 'kind': kind.name, 'title': title, 'detail': detail});

  static String _when(DateTime at, String note) {
    String two(int n) => n.toString().padLeft(2, '0');
    final s = '${at.year}-${two(at.month)}-${two(at.day)} ${two(at.hour)}:${two(at.minute)}';
    return note.trim().isEmpty ? s : '$s · ${note.trim()}';
  }
}
