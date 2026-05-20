import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/event.dart';
import '../models/session.dart';
import 'api_client.dart';
import 'cache_service.dart';

/// Thrown when the server returns 401 (session revoked or token expired).
class EventsSessionRevokedException implements Exception {
  const EventsSessionRevokedException();
}

/// Thrown when the server returns 400 RANGE_TOO_BROAD (> 500 events).
class EventsRangeTooBroadException implements Exception {
  const EventsRangeTooBroadException();
}

/// Thrown for any other fetch failure (network, server error, parse error).
class EventsFetchException implements Exception {
  const EventsFetchException(this.message);

  final String message;
}

class EventsService {
  EventsService({
    required ApiClientFactory clientFactory,
    required CacheDb cacheDb,
  })  : _clientFactory = clientFactory,
        _cached = CachedGet(cacheDb);

  final ApiClientFactory _clientFactory;
  final CachedGet _cached;

  Future<EventsResult> fetchEvents({
    required Session session,
    required DateTime from,
    required DateTime to,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    final String fromIso = from.toUtc().toIso8601String();
    final String toIso = to.toUtc().toIso8601String();
    final Map<String, Object?> queryParameters = <String, Object?>{
      'from': fromIso,
      'to': toIso,
    };

    final CachedGetResult result;
    try {
      result = await _cached.get(
        dio: dio,
        path: '/api/mobile/events',
        memberId: session.member.id,
        queryParameters: queryParameters,
      );
    } on DioException catch (e) {
      throw EventsFetchException('Network error: ${e.message}');
    }

    if (result.statusCode == 401) {
      throw const EventsSessionRevokedException();
    }
    if (result.statusCode == 400) {
      final Object? data = result.data;
      if (data is Map) {
        final Object? error = (data as Map<Object?, Object?>)['error'];
        if (error is Map) {
          final Object? code = (error as Map<Object?, Object?>)['code'];
          if (code == 'RANGE_TOO_BROAD') {
            throw const EventsRangeTooBroadException();
          }
        }
      }
      throw const EventsFetchException('Bad request');
    }
    if (result.statusCode != 200) {
      throw EventsFetchException('Unexpected status ${result.statusCode}');
    }

    final Object? data = result.data;
    if (data is! Map) {
      throw const EventsFetchException('Unexpected response format');
    }
    try {
      final Map<String, Object?> body =
          (data as Map<Object?, Object?>).cast<String, Object?>();
      final List<Object?> eventsRaw = body['events'] is List
          ? body['events']! as List<Object?>
          : <Object?>[];
      final List<MobileEvent> events = eventsRaw
          .whereType<Map<Object?, Object?>>()
          .map((Map<Object?, Object?> e) =>
              MobileEvent.fromJson(e.cast<String, Object?>()))
          .toList();
      return EventsResult(events: events, staleAt: result.cachedAt);
    } catch (e) {
      throw EventsFetchException('Parse error: $e');
    }
  }
}

/// Result of [EventsService.fetchEvents], including the event list and an
/// optional [staleAt] timestamp when served from the disk cache.
class EventsResult {
  const EventsResult({required this.events, this.staleAt});

  final List<MobileEvent> events;

  /// Non-null when this result was served from the disk cache.
  final DateTime? staleAt;
}
