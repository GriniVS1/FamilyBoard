import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// A single entry retrieved from the write queue.
class QueuedWrite {
  const QueuedWrite({
    required this.id,
    required this.memberId,
    required this.method,
    required this.path,
    required this.body,
    required this.tempId,
    required this.retryCount,
    required this.lastError,
  });

  factory QueuedWrite.fromRow(Map<String, Object?> row) {
    return QueuedWrite(
      id: row['id']! as int,
      memberId: row['member_id']! as String,
      method: row['method']! as String,
      path: row['path']! as String,
      body: row['body'] as String?,
      tempId: row['temp_id'] as String?,
      retryCount: row['retry_count']! as int,
      lastError: row['last_error'] as String?,
    );
  }

  final int id;
  final String memberId;
  final String method;
  final String path;

  /// JSON-stringified body for POST / PATCH; null for DELETE.
  final String? body;

  /// Client-generated temp ID for insert operations; null for update / delete.
  final String? tempId;

  final int retryCount;
  final String? lastError;
}

/// Singleton SQLite manager for the read-cache and write-queue.
///
/// Schema v1: `cache_read` table.
/// Schema v2: adds `write_queue` table.
///
/// The key for cache_read is `<memberId>:<path>` so caches for distinct paired
/// devices on the same install never bleed into each other.
class CacheDb {
  CacheDb._();
  static final CacheDb instance = CacheDb._();
  Database? _db;

  static const int _maxQueuePerMember = 200;

  Future<Database> _open() async {
    if (_db != null) return _db!;
    final Directory dir = await getApplicationDocumentsDirectory();
    final String path = '${dir.path}${Platform.pathSeparator}fb_cache.db';
    _db = await openDatabase(
      path,
      version: 2,
      onCreate: (Database db, int _) async {
        await db.execute(
          'CREATE TABLE cache_read ('
          '  key TEXT PRIMARY KEY,'
          '  body TEXT NOT NULL,'
          '  fetched_at INTEGER NOT NULL'
          ')',
        );
        await _createWriteQueueTable(db);
      },
      onUpgrade: (Database db, int oldVersion, int newVersion) async {
        if (oldVersion < 2) {
          await _createWriteQueueTable(db);
        }
      },
    );
    return _db!;
  }

  Future<void> _createWriteQueueTable(Database db) async {
    await db.execute(
      'CREATE TABLE write_queue ('
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,'
      '  member_id TEXT NOT NULL,'
      '  method TEXT NOT NULL,'
      '  path TEXT NOT NULL,'
      '  body TEXT,'
      '  temp_id TEXT,'
      '  created_at INTEGER NOT NULL,'
      '  retry_count INTEGER NOT NULL DEFAULT 0,'
      '  next_attempt_at INTEGER NOT NULL DEFAULT 0,'
      '  last_error TEXT'
      ')',
    );
    await db.execute(
      'CREATE INDEX idx_write_queue_member_id '
      'ON write_queue(member_id, next_attempt_at)',
    );
  }

  // ---------------------------------------------------------------------------
  // Read-cache methods (unchanged from v1)
  // ---------------------------------------------------------------------------

  Future<void> write(String key, String body) async {
    final Database db = await _open();
    await db.insert(
      'cache_read',
      <String, Object?>{
        'key': key,
        'body': body,
        'fetched_at': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<({String body, DateTime fetchedAt})?> read(String key) async {
    final Database db = await _open();
    final List<Map<String, Object?>> rows = await db.query(
      'cache_read',
      where: 'key = ?',
      whereArgs: <Object>[key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return (
      body: rows.first['body']! as String,
      fetchedAt: DateTime.fromMillisecondsSinceEpoch(
        rows.first['fetched_at']! as int,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Write-queue methods
  // ---------------------------------------------------------------------------

  /// Enqueues a mutation. Returns the new row's auto-incremented ID.
  ///
  /// Throws [QueueFullException] when the queue already holds
  /// [_maxQueuePerMember] or more entries for [memberId].
  Future<int> enqueue({
    required String memberId,
    required String method,
    required String path,
    String? body,
    String? tempId,
  }) async {
    final Database db = await _open();
    final int count = await queueCount(memberId);
    if (count >= _maxQueuePerMember) {
      throw const QueueFullException();
    }
    return db.insert(
      'write_queue',
      <String, Object?>{
        'member_id': memberId,
        'method': method,
        'path': path,
        'body': body,
        'temp_id': tempId,
        'created_at': DateTime.now().millisecondsSinceEpoch,
        'retry_count': 0,
        'next_attempt_at': 0,
        'last_error': null,
      },
    );
  }

  /// Returns up to [limit] rows whose `next_attempt_at` is in the past,
  /// ordered FIFO.
  Future<List<QueuedWrite>> nextBatch({
    required String memberId,
    int limit = 20,
  }) async {
    final Database db = await _open();
    final int now = DateTime.now().millisecondsSinceEpoch;
    final List<Map<String, Object?>> rows = await db.query(
      'write_queue',
      where: 'member_id = ? AND next_attempt_at <= ?',
      whereArgs: <Object>[memberId, now],
      orderBy: 'id ASC',
      limit: limit,
    );
    return rows.map(QueuedWrite.fromRow).toList();
  }

  /// Bumps retry_count, sets next_attempt_at for backoff, stores the error.
  Future<void> markFailed(int id, String error, int retryDelayMs) async {
    final Database db = await _open();
    final int nextAttempt =
        DateTime.now().millisecondsSinceEpoch + retryDelayMs;
    await db.rawUpdate(
      'UPDATE write_queue '
      'SET retry_count = retry_count + 1, '
      '    next_attempt_at = ?, '
      '    last_error = ? '
      'WHERE id = ?',
      <Object>[nextAttempt, error, id],
    );
  }

  /// Removes a row after a successful replay or a permanent 4xx failure.
  Future<void> remove(int id) async {
    final Database db = await _open();
    await db.delete('write_queue', where: 'id = ?', whereArgs: <Object>[id]);
  }

  /// Count of pending items for a specific member.
  Future<int> queueCount(String memberId) async {
    final Database db = await _open();
    final List<Map<String, Object?>> result = await db.rawQuery(
      'SELECT COUNT(*) AS c FROM write_queue WHERE member_id = ?',
      <Object>[memberId],
    );
    return result.first['c'] as int;
  }

  /// Total count across all members (for app-shell badge).
  Future<int> totalQueueCount() async {
    final Database db = await _open();
    final List<Map<String, Object?>> result = await db.rawQuery(
      'SELECT COUNT(*) AS c FROM write_queue',
    );
    return result.first['c'] as int;
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /// Wipes all cached rows AND queued mutations.
  ///
  /// Called when a session is revoked so stale data belonging to a de-paired
  /// device can't leak to the next pairing on the same install.
  Future<void> clearAll() async {
    final Database db = await _open();
    await db.delete('cache_read');
    await db.delete('write_queue');
  }
}

/// Thrown by [CacheDb.enqueue] when the per-member queue cap is reached.
class QueueFullException implements Exception {
  const QueueFullException();
}
