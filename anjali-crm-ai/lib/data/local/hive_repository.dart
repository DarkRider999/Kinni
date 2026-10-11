import 'dart:async';

import 'package:hive_ce/hive_ce.dart';

import '../../domain/entities/sync_entity.dart';
import '../../domain/repositories/repository.dart';

/// Hive implementation of [Repository]. Values are JSON-like maps keyed by id.
class HiveRepository<T extends SyncEntity> implements Repository<T> {
  HiveRepository(this.box, this.fromMap, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final Box box;
  final T Function(Map map) fromMap;
  final DateTime Function() _clock;

  T _decode(dynamic v) => fromMap(Map<String, dynamic>.from(v as Map));

  @override
  Stream<List<T>> watchAll() {
    late StreamController<List<T>> controller;
    StreamSubscription? sub;
    Timer? debounce;
    controller = StreamController<List<T>>(
      onListen: () {
        controller.add(getAll());
        sub = box.watch().listen((_) {
          // Coalesce bursts (e.g. sync of 500 records) into one emission.
          debounce?.cancel();
          debounce = Timer(const Duration(milliseconds: 60), () {
            if (!controller.isClosed && box.isOpen) controller.add(getAll());
          });
        });
      },
      onCancel: () async {
        debounce?.cancel();
        await sub?.cancel();
      },
    );
    return controller.stream;
  }

  @override
  List<T> getAll({bool includeDeleted = false}) {
    if (!box.isOpen) return <T>[];
    final out = <T>[];
    for (final v in box.values) {
      if (v is! Map) continue;
      if (!includeDeleted && v['deleted'] == true) continue;
      out.add(_decode(v));
    }
    return out;
  }

  @override
  T? getById(String id) {
    final v = box.get(id);
    if (v is! Map) return null;
    return _decode(v);
  }

  Map<String, dynamic> _stamp(T e) => {
        ...e.toMap(),
        'updatedAt': _clock().toUtc().toIso8601String(),
        'dirty': true,
      };

  @override
  Future<void> upsert(T entity) => box.put(entity.id, _stamp(entity));

  @override
  Future<void> upsertAll(Iterable<T> entities) => box.putAll({for (final e in entities) e.id: _stamp(e)});

  @override
  Future<void> softDelete(String id) async {
    final v = box.get(id);
    if (v is! Map) return;
    await box.put(id, {
      ...Map<String, dynamic>.from(v),
      'deleted': true,
      'updatedAt': _clock().toUtc().toIso8601String(),
      'dirty': true,
    });
  }

  @override
  Future<void> putRaw(Map<String, dynamic> map) {
    final id = map['id']?.toString();
    if (id == null || id.isEmpty) return Future.value();
    return box.put(id, {...map, 'dirty': false});
  }

  @override
  List<Map<String, dynamic>> dirtyMaps() => [
        for (final v in box.values)
          if (v is Map && v['dirty'] == true) Map<String, dynamic>.from(v)..remove('dirty'),
      ];

  @override
  Future<void> markClean(Iterable<String> ids) async {
    final updates = <String, dynamic>{};
    for (final id in ids) {
      final v = box.get(id);
      if (v is Map) updates[id] = {...Map<String, dynamic>.from(v), 'dirty': false};
    }
    if (updates.isNotEmpty) await box.putAll(updates);
  }

  @override
  Future<int> purgeDeleted(Duration olderThan) async {
    final cutoff = _clock().subtract(olderThan);
    final keys = <dynamic>[];
    for (final k in box.keys) {
      final v = box.get(k);
      if (v is Map && v['deleted'] == true && v['dirty'] != true) {
        final u = DateTime.tryParse('${v['updatedAt']}');
        if (u != null && u.isBefore(cutoff)) keys.add(k);
      }
    }
    await box.deleteAll(keys);
    return keys.length;
  }

  @override
  Future<void> clear() => box.clear();
}
