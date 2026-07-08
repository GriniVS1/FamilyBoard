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

/// Error codes the wall's write endpoints return in their
/// `{ error: { code } }` envelope. [unknown] covers anything else (including
/// 5xx and network failures).
enum EventWriteErrorCode {
  googleReadOnly,
  microsoftReadOnly,
  overrideNotSupported,
  notFound,
  unknown,
}

/// Thrown by create/update/delete on a non-2xx response other than 401.
class EventsWriteException implements Exception {
  const EventsWriteException(this.code, {this.message});

  final EventWriteErrorCode code;
  final String? message;
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

  /// Online-only — unlike the read path above, writes never queue offline
  /// (there is no sensible replay story for a stale recurrence edit).
  Future<MobileEvent> createEvent({
    required Session session,
    required String memberId,
    required String title,
    String? description,
    String? location,
    required DateTime startsAt,
    required DateTime endsAt,
    bool allDay = false,
    String? color,
    String? rrule,
  }) async {
    final Response<Object?> response = await _write(
      session,
      method: 'POST',
      path: '',
      body: <String, Object?>{
        'memberId': memberId,
        'title': title,
        if (description != null && description.isNotEmpty)
          'description': description,
        if (location != null && location.isNotEmpty) 'location': location,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt.toUtc().toIso8601String(),
        'allDay': allDay,
        if (color != null) 'color': color,
        if (rrule != null) 'rrule': rrule,
      },
    );
    _guardWrite(response, expected: const <int>{200, 201});
    return MobileEvent.fromJson(_extractEventMap(response));
  }

  /// [patch] is sent verbatim as the PATCH body — callers decide which subset
  /// of fields to include (e.g. only `memberId`/`color` for a read-only
  /// synced event).
  Future<void> updateEvent({
    required Session session,
    required String id,
    required String scope,
    required Map<String, Object?> patch,
  }) async {
    final Response<Object?> response = await _write(
      session,
      method: 'PATCH',
      path: '/${Uri.encodeComponent(id)}',
      query: <String, Object?>{'scope': scope},
      body: patch,
    );
    _guardWrite(response, expected: const <int>{200});
  }

  Future<void> deleteEvent({
    required Session session,
    required String id,
    required String scope,
  }) async {
    final Response<Object?> response = await _write(
      session,
      method: 'DELETE',
      path: '/${Uri.encodeComponent(id)}',
      query: <String, Object?>{'scope': scope},
    );
    _guardWrite(response, expected: const <int>{200});
  }

  Future<Response<Object?>> _write(
    Session session, {
    required String method,
    required String path,
    Map<String, Object?>? query,
    Map<String, Object?>? body,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await dio.request<Object?>(
        '/api/mobile/events$path',
        data: body,
        queryParameters: query,
        options: Options(method: method),
      );
    } on DioException catch (e) {
      throw EventsWriteException(
        EventWriteErrorCode.unknown,
        message: 'Network error: ${e.message}',
      );
    }
  }

  void _guardWrite(Response<Object?> response, {required Set<int> expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const EventsSessionRevokedException();
    }
    if (expected.contains(status)) {
      return;
    }
    final String code = _errorCodeFromResponse(response);
    switch (code) {
      case 'GOOGLE_EVENT_READ_ONLY':
        throw const EventsWriteException(EventWriteErrorCode.googleReadOnly);
      case 'MICROSOFT_EVENT_READ_ONLY':
        throw const EventsWriteException(EventWriteErrorCode.microsoftReadOnly);
      case 'OVERRIDE_NOT_SUPPORTED':
        throw const EventsWriteException(
            EventWriteErrorCode.overrideNotSupported);
      case 'EVENT_NOT_FOUND':
        throw const EventsWriteException(EventWriteErrorCode.notFound);
      default:
        throw EventsWriteException(
          EventWriteErrorCode.unknown,
          message: '$status $code',
        );
    }
  }

  String _errorCodeFromResponse(Response<Object?> response) {
    final Object? data = response.data;
    if (data is Map) {
      final Object? error = (data as Map<Object?, Object?>)['error'];
      if (error is Map) {
        final Object? code = (error as Map<Object?, Object?>)['code'];
        if (code is String) {
          return code;
        }
      }
    }
    return 'UNKNOWN';
  }

  Map<String, Object?> _extractEventMap(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! Map) {
      throw const EventsWriteException(EventWriteErrorCode.unknown);
    }
    final Map<String, Object?> body =
        (data as Map<Object?, Object?>).cast<String, Object?>();
    final Object? eventRaw = body['event'];
    if (eventRaw is! Map) {
      throw const EventsWriteException(EventWriteErrorCode.unknown);
    }
    return (eventRaw as Map<Object?, Object?>).cast<String, Object?>();
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
