import '../entities/sync_entity.dart';

/// Generic persistence contract for syncable entities
/// (docs/06-api-design.md §1). Implemented by the Hive data layer.
abstract interface class Repository<T extends SyncEntity> {
  /// Emits the live (non-deleted) records now and after every change.
  Stream<List<T>> watchAll();

  List<T> getAll({bool includeDeleted = false});

  T? getById(String id);

  /// Inserts or replaces; stamps `updatedAt` and marks the record dirty.
  Future<void> upsert(T entity);

  Future<void> upsertAll(Iterable<T> entities);

  Future<void> softDelete(String id);

  /// Raw write used by sync / restore: keeps the given `updatedAt`, clean.
  Future<void> putRaw(Map<String, dynamic> map);

  /// Raw maps of records not yet pushed to the cloud.
  List<Map<String, dynamic>> dirtyMaps();

  Future<void> markClean(Iterable<String> ids);

  /// Removes soft-deleted, already-synced records older than [olderThan].
  Future<int> purgeDeleted(Duration olderThan);

  Future<void> clear();
}
