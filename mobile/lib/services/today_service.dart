import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/session.dart';
import '../models/today.dart';
import 'api_client.dart';
import 'cache_service.dart';

/// Thrown when the server returns 401 (session revoked).
class TodaySessionRevokedException implements Exception {
  const TodaySessionRevokedException();
}

/// Thrown for non-401 failures (network, server error, parse error) when no
/// cached data is available.
class TodayFetchException implements Exception {
  const TodayFetchException(this.message);

  final String message;
}

class TodayService {
  TodayService({
    required ApiClientFactory clientFactory,
    required CacheDb cacheDb,
  })  : _clientFactory = clientFactory,
        _cached = CachedGet(cacheDb);

  final ApiClientFactory _clientFactory;
  final CachedGet _cached;

  Future<TodayPayload> fetchToday(Session session) async {
    final Dio dio = _clientFactory.authenticated(session);
    final CachedGetResult result;
    try {
      result = await _cached.get(
        dio: dio,
        path: '/api/mobile/today',
        memberId: session.member.id,
      );
    } on DioException catch (e) {
      throw TodayFetchException('Network error: ${e.message}');
    }

    if (result.statusCode == 401) {
      throw const TodaySessionRevokedException();
    }
    if (result.statusCode != 200) {
      throw TodayFetchException('Unexpected status ${result.statusCode}');
    }

    final Object? data = result.data;
    if (data is! Map) {
      throw const TodayFetchException('Unexpected response format');
    }
    try {
      return TodayPayload.fromJson(
        (data as Map<Object?, Object?>).cast<String, Object?>(),
        staleAt: result.cachedAt,
      );
    } catch (e) {
      throw TodayFetchException('Parse error: $e');
    }
  }
}
