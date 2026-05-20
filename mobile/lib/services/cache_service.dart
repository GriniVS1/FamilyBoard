import 'dart:convert';

import 'package:dio/dio.dart';

import '../db/cache_db.dart';

/// Result type returned by [CachedGet.get].
typedef CachedGetResult = ({
  Object? data,
  int statusCode,
  DateTime? cachedAt,
  bool fromCache,
});

/// Wraps a network GET with a disk-cache fallback.
///
/// On a successful (2xx) response, the body is written to [CacheDb] under the
/// key `<memberId>:<path>[?<sorted-query>]`. On [DioException] (network or
/// 5xx) the last-written body is returned as stale data; if no cached row
/// exists the exception is re-thrown. Non-2xx responses are returned as-is
/// (so callers can still handle 401 etc.) but are never written to cache.
class CachedGet {
  const CachedGet(this._db);

  final CacheDb _db;

  Future<CachedGetResult> get({
    required Dio dio,
    required String path,
    required String memberId,
    Map<String, Object?>? queryParameters,
  }) async {
    final String key = _buildKey(memberId, path, queryParameters);
    try {
      final Response<Object?> response = await dio.get<Object?>(
        path,
        queryParameters: queryParameters,
      );
      final int status = response.statusCode ?? 0;
      final Object? body = response.data;

      // Only cache successful responses.
      if (status >= 200 && status < 300 && (body is Map || body is List)) {
        await _db.write(key, jsonEncode(body));
      }

      return (
        data: body,
        statusCode: status,
        cachedAt: null,
        fromCache: false,
      );
    } on DioException {
      final ({String body, DateTime fetchedAt})? hit = await _db.read(key);
      if (hit == null) rethrow;
      return (
        data: jsonDecode(hit.body),
        statusCode: 200,
        cachedAt: hit.fetchedAt,
        fromCache: true,
      );
    }
  }

  /// Builds a stable cache key that incorporates sorted query parameters so
  /// the same path with different query strings maps to distinct keys.
  String _buildKey(
    String memberId,
    String path,
    Map<String, Object?>? queryParameters,
  ) {
    if (queryParameters == null || queryParameters.isEmpty) {
      return '$memberId:$path';
    }
    final List<String> sortedPairs = queryParameters.entries
        .map((MapEntry<String, Object?> e) => '${e.key}=${e.value}')
        .toList()
      ..sort();
    return '$memberId:$path?${sortedPairs.join('&')}';
  }
}
