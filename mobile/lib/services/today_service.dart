import 'package:dio/dio.dart';

import '../models/session.dart';
import '../models/today.dart';
import 'api_client.dart';

/// Thrown when the server returns 401 (session revoked).
class TodaySessionRevokedException implements Exception {
  const TodaySessionRevokedException();
}

/// Thrown for non-401 failures (network, server error, parse error).
class TodayFetchException implements Exception {
  const TodayFetchException(this.message);

  final String message;
}

class TodayService {
  TodayService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<TodayPayload> fetchToday(Session session) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.get<Object?>('/api/mobile/today');
    } on DioException catch (e) {
      throw TodayFetchException('Network error: ${e.message}');
    }

    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const TodaySessionRevokedException();
    }
    if (status != 200) {
      throw TodayFetchException('Unexpected status $status');
    }

    final Object? data = response.data;
    if (data is! Map) {
      throw const TodayFetchException('Unexpected response format');
    }
    try {
      return TodayPayload.fromJson(
        (data as Map<Object?, Object?>).cast<String, Object?>(),
      );
    } catch (e) {
      throw TodayFetchException('Parse error: $e');
    }
  }
}
