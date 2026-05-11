import 'package:dio/dio.dart';

import '../models/session.dart';
import 'api_client.dart';

enum HeartbeatErrorKind { unauthorized, network, unknown }

class HeartbeatException implements Exception {
  const HeartbeatException(this.kind);

  final HeartbeatErrorKind kind;
}

class HeartbeatResult {
  const HeartbeatResult({required this.lastSeenAt});

  final DateTime lastSeenAt;
}

class HeartbeatService {
  HeartbeatService({ApiClientFactory? clientFactory})
      : _clientFactory = clientFactory ?? const ApiClientFactory();

  final ApiClientFactory _clientFactory;

  Future<HeartbeatResult> send(Session session) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.post<Object?>('/api/devices/me/heartbeat');
    } on DioException {
      throw const HeartbeatException(HeartbeatErrorKind.network);
    }

    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const HeartbeatException(HeartbeatErrorKind.unauthorized);
    }
    if (status != 200) {
      throw const HeartbeatException(HeartbeatErrorKind.unknown);
    }

    final Object? data = response.data;
    if (data is! Map) {
      throw const HeartbeatException(HeartbeatErrorKind.unknown);
    }
    final Map<String, Object?> payload =
        (data as Map<Object?, Object?>).cast<String, Object?>();
    final Object? raw = payload['lastSeenAt'];
    final DateTime? parsed = raw is String ? DateTime.tryParse(raw) : null;
    if (parsed == null) {
      throw const HeartbeatException(HeartbeatErrorKind.unknown);
    }
    return HeartbeatResult(lastSeenAt: parsed);
  }
}
