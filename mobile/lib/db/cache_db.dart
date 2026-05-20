import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// Singleton SQLite manager for the read-cache.
///
/// One table, two payload columns. The key is `<memberId>:<path>` so caches
/// for distinct paired devices on the same install never bleed into each other.
class CacheDb {
  CacheDb._();
  static final CacheDb instance = CacheDb._();
  Database? _db;

  Future<Database> _open() async {
    if (_db != null) return _db!;
    final Directory dir = await getApplicationDocumentsDirectory();
    final String path = '${dir.path}${Platform.pathSeparator}fb_cache.db';
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (Database db, int _) => db.execute(
        'CREATE TABLE cache_read ('
        '  key TEXT PRIMARY KEY,'
        '  body TEXT NOT NULL,'
        '  fetched_at INTEGER NOT NULL'
        ')',
      ),
    );
    return _db!;
  }

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

  /// Wipes all cached rows. Called when a session is revoked so stale data
  /// belonging to a de-paired device does not leak to the next pairing.
  Future<void> clearAll() async {
    final Database db = await _open();
    await db.delete('cache_read');
  }
}
