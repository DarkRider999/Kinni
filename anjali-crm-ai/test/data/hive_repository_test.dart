import 'dart:io';

import 'package:anjali_crm_ai/data/local/hive_repository.dart';
import 'package:anjali_crm_ai/data/repositories/repositories.dart';
import 'package:anjali_crm_ai/domain/entities/client.dart';
import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive_ce.dart';

import '../helpers.dart';

void main() {
  late Directory dir;
  late HiveRepository<Client> repo;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('anjali_hive_test');
    Hive.init(dir.path);
    final box = await Hive.openBox('clients_test', encryptionCipher: HiveAesCipher(List<int>.generate(32, (i) => i)));
    repo = HiveRepository(box, Client.fromMap, clock: () => DateTime.utc(2026, 10, 11, 12));
  });

  tearDown(() async {
    await Hive.close();
    await dir.delete(recursive: true);
  });

  test('entity survives an encrypted round trip with all fields', () async {
    final c = client(email: 'a@b.com', status: LeadStatus.underReview, priority: Priority.urgent, rating: 4, salary: 15000.5);
    await repo.upsert(c);
    final back = repo.getById(c.id)!;
    expect(back.toMap()..remove('updatedAt'), c.toMap()..remove('updatedAt'));
    expect(back.updatedAt.toUtc(), DateTime.utc(2026, 10, 11, 12));
  });

  test('dirty tracking, soft delete and purge', () async {
    await repo.upsert(client(id: 'a'));
    await repo.upsert(client(id: 'b', phone: '0559998888'));
    expect(repo.dirtyMaps().map((m) => m['id']), containsAll(['a', 'b']));
    expect(repo.dirtyMaps().first.containsKey('dirty'), isFalse, reason: 'dirty flag never leaves the device');
    await repo.markClean(['a', 'b']);
    expect(repo.dirtyMaps(), isEmpty);

    await repo.softDelete('a');
    expect(repo.getAll().map((c) => c.id), ['b']);
    expect(repo.getAll(includeDeleted: true), hasLength(2));
    await repo.markClean(['a']);
    expect(await repo.purgeDeleted(Duration.zero), 0, reason: 'not older than cutoff at same instant');
    expect(await repo.purgeDeleted(const Duration(days: -1)), 1);
  });

  test('watchAll emits current state then updates', () async {
    final stream = repo.watchAll();
    final events = <int>[];
    final sub = stream.listen((l) => events.add(l.length));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    await repo.upsert(client(id: 'z'));
    await Future<void>.delayed(const Duration(milliseconds: 150));
    await sub.cancel();
    expect(events.first, 0);
    expect(events.last, 1);
  });

  test('search ranks phone and name-prefix matches first', () async {
    await repo.upsertAll([
      client(id: '1', name: 'Priya Nair', phone: '0501111111'),
      client(id: '2', name: 'Rahul Menon', phone: '0502222222').copyWith(company: 'Priya Holdings'),
      client(id: '3', name: 'Omar', phone: '0503333333'),
    ]);
    expect(repo.search('priya').map((c) => c.id), ['1', '2']);
    expect(repo.search('050 333').single.id, '3');
    expect(repo.search('Interested'), isEmpty);
  });
}
