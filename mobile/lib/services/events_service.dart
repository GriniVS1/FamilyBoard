import 'package:dio/dio.dart';

import '../models/event.dart';
import '../models/session.dart';
import 'api_client.dart';

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
  EventsService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<List<MobileEvent>> fetchEvents({
    required Session session,
    required DateTime from,
    required DateTime to,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    final String fromIso = from.toUtc().toIso8601String();
    final String toIso = to.toUtc().toIso8601String();

    final Response<Object?> response;
    try {
      response = await dio.get<Object?>(
        '/api/mobile/events',
        queryParameters: <String, String>{'from': fromIso, 'to': toIso},
      );
    } on DioException catch (e) {
      throw EventsFetchException('Network error: ${e.message}');
    }

    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const EventsSessionRevokedException();
    }
    if (status == 400) {
      final Object? data = response.data;
      if (data is Map) {
        final Map<String, Object?> body =
            (data as Map<Object?, Object?>).cast<String, Object?>();
        final Object? error = body['error'];
        if (error is Map) {
          final Map<String, Object?> errorMap =
              (error as Map<Object?, Object?>).cast<String, Object?>();
          if (errorMap['code'] == 'RANGE_TOO_BROAD') {
            throw const EventsRangeTooBroadException();
          }
        }
      }
      throw const EventsFetchException('Bad request');
    }
    if (status != 200) {
      throw EventsFetchException('Unexpected status $status');
    }

    final Object? data = response.data;
    if (data is! Map) {
      throw const EventsFetchException('Unexpected response format');
    }
    try {
      final Map<String, Object?> body =
          (data as Map<Object?, Object?>).cast<String, Object?>();
      final List<Object?> eventsRaw = body['events'] is List
          ? body['events']! as List<Object?>
          : <Object?>[];
      return eventsRaw
          .whereType<Map<Object?, Object?>>()
          .map((Map<Object?, Object?> e) =>
              MobileEvent.fromJson(e.cast<String, Object?>()))
          .toList();
    } catch (e) {
      throw EventsFetchException('Parse error: $e');
    }
  }
}
