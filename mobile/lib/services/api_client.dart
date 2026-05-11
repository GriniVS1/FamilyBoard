import 'package:dio/dio.dart';

import '../models/session.dart';

/// Lightweight Dio factory.
///
/// For pairing we need a client without a bearer token but pointed at a
/// caller-supplied server URL; for authenticated calls we want a client whose
/// base URL and Authorization header are pinned to the active [Session].
class ApiClientFactory {
  const ApiClientFactory();

  Dio unauthenticated(String baseUrl) {
    return Dio(_baseOptions(baseUrl));
  }

  Dio authenticated(Session session) {
    final Dio dio = Dio(_baseOptions(session.serverUrl));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
          options.headers['Authorization'] = 'Bearer ${session.token}';
          handler.next(options);
        },
      ),
    );
    return dio;
  }

  BaseOptions _baseOptions(String baseUrl) {
    return BaseOptions(
      baseUrl: _normalize(baseUrl),
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 10),
      contentType: 'application/json',
      responseType: ResponseType.json,
      // Don't throw on 4xx; we inspect the error envelope manually.
      validateStatus: (int? status) => status != null && status < 500,
    );
  }

  String _normalize(String raw) {
    final String trimmed = raw.trim();
    final String withoutTrailingSlash =
        trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
    return withoutTrailingSlash;
  }
}
