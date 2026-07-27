import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/chore.dart';
import '../models/session.dart';
import 'api_client.dart';
import 'cache_service.dart';

/// Thrown when the server returns 401 (session revoked).
class ChoresSessionRevokedException implements Exception {
  const ChoresSessionRevokedException();
}

/// Thrown for non-401 failures (network, server error, parse error) when no
/// cached data is available.
class ChoresFetchException implements Exception {
  const ChoresFetchException(this.message);

  final String message;
}

/// Result of [ChoresService.fetchChores].
class ChoresResult {
  const ChoresResult({required this.chores, this.staleAt});

  final List<Chore> chores;

  /// Non-null when this result was served from the disk cache.
  final DateTime? staleAt;
}

/// Read-only client for `GET /api/mobile/chores` — the family-wide chore
/// list backing the Tasks screen's Ämtli segment. Writes (complete/undo/
/// create) still go through [MutationsService] — this service only backs
/// the read path.
class ChoresService {
  ChoresService({required this._clientFactory, required CacheDb cacheDb})
    : _cached = CachedGet(cacheDb);

  final ApiClientFactory _clientFactory;
  final CachedGet _cached;

  Future<ChoresResult> fetchChores(Session session) async {
    final CachedGetResult result;
    try {
      result = await _cached.get(
        dio: _clientFactory.authenticated(session),
        path: '/api/mobile/chores',
        memberId: session.member.id,
      );
    } on DioException catch (e) {
      throw ChoresFetchException('Network error: ${e.message}');
    }

    if (result.statusCode == 401) {
      throw const ChoresSessionRevokedException();
    }
    if (result.statusCode != 200) {
      throw ChoresFetchException('Unexpected status ${result.statusCode}');
    }

    final Object? data = result.data;
    if (data is! Map) {
      throw const ChoresFetchException('Unexpected response format');
    }
    try {
      final Map<String, Object?> body = (data as Map<Object?, Object?>)
          .cast<String, Object?>();
      final List<Object?> choresRaw = body['chores'] is List
          ? body['chores']! as List<Object?>
          : <Object?>[];
      final List<Chore> chores = choresRaw
          .whereType<Map<Object?, Object?>>()
          .map(
            (Map<Object?, Object?> c) =>
                Chore.fromJson(c.cast<String, Object?>()),
          )
          .toList();
      return ChoresResult(chores: chores, staleAt: result.cachedAt);
    } catch (e) {
      throw ChoresFetchException('Parse error: $e');
    }
  }
}
