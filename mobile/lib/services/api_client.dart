import 'package:dio/dio.dart';

import '../models/session.dart';

/// Invoked when an authenticated request fails with a network-level error
/// (not a 401, not a 5xx — the wall is simply unreachable at [session]'s
/// current `serverUrl`, e.g. because its LAN IP changed).
///
/// Returns the new base URL to retry against, or null if recovery found
/// nothing (in which case the original error is surfaced as usual).
/// Implementations are responsible for verifying the candidate is actually
/// the paired wall (via the identity endpoint) and for persisting the
/// updated [Session] — this factory only cares about the URL to retry with.
typedef ConnectionRecoveryHook = Future<String?> Function(Session session);

/// Lightweight Dio factory.
///
/// For pairing we need a client without a bearer token but pointed at a
/// caller-supplied server URL; for authenticated calls we want a client whose
/// base URL and Authorization header are pinned to the active [Session].
///
/// When [recovery] is supplied, [authenticated] wires an error interceptor
/// that, on a pure network failure (connection refused / timed out — not a
/// 401 or a 5xx from a live server), asks [recovery] for a fresh base URL and
/// transparently retries the original request against it. This is the single
/// choke point for the DHCP-IP-change self-healing story: every service in
/// `lib/services/**` builds its Dio via [authenticated], so none of them need
/// to know recovery exists.
class ApiClientFactory {
  const ApiClientFactory({this.recovery});

  final ConnectionRecoveryHook? recovery;

  Dio unauthenticated(
    String baseUrl, {
    Duration? connectTimeout,
    Duration? receiveTimeout,
  }) {
    return Dio(
      _baseOptions(
        baseUrl,
        connectTimeout: connectTimeout,
        receiveTimeout: receiveTimeout,
      ),
    );
  }

  Dio authenticated(Session session) {
    final Dio dio = Dio(_baseOptions(session.effectiveUrl));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
          options.headers['Authorization'] = 'Bearer ${session.token}';
          handler.next(options);
        },
        onError: recovery == null
            ? null
            : (DioException err, ErrorInterceptorHandler handler) async {
                if (!_isRecoverableNetworkError(err)) {
                  handler.next(err);
                  return;
                }
                final String? newBaseUrl = await recovery!(session);
                if (newBaseUrl == null) {
                  handler.next(err);
                  return;
                }
                try {
                  final RequestOptions retryOptions = err.requestOptions;
                  retryOptions.baseUrl = _normalize(newBaseUrl);
                  final Response<Object?> retried =
                      await dio.fetch<Object?>(retryOptions);
                  handler.resolve(retried);
                } on DioException catch (retryError) {
                  handler.next(retryError);
                }
              },
      ),
    );
    return dio;
  }

  /// True for connection-level failures (refused / timed out / DNS failure)
  /// where the server at the current URL simply isn't reachable — as opposed
  /// to a 401 (handled by callers as a session problem) or a 5xx (the server
  /// answered, so there's nothing to rediscover). Mirrors the classification
  /// `WriteQueueService._isNetworkFailure` uses for its own retry-vs-queue
  /// decision.
  static bool _isRecoverableNetworkError(DioException err) {
    return err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.receiveTimeout;
  }

  BaseOptions _baseOptions(
    String baseUrl, {
    Duration? connectTimeout,
    Duration? receiveTimeout,
  }) {
    return BaseOptions(
      baseUrl: _normalize(baseUrl),
      // Short on purpose: off-LAN, the first request against a stale LAN
      // `serverUrl` must fail fast so the recovery ladder in
      // `ConnectionRecoveryService` can fall through to the cloud relay
      // without a long user-visible stall.
      connectTimeout: connectTimeout ?? const Duration(seconds: 4),
      receiveTimeout: receiveTimeout ?? const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 10),
      contentType: 'application/json',
      responseType: ResponseType.json,
      // The wall API never issues 3xx. Disabling redirect-following prevents
      // dart:io from forwarding the Authorization header to a redirect target
      // on an untrusted LAN. (CVE class: token exfiltration via open redirect.)
      followRedirects: false,
      maxRedirects: 0,
      // Don't throw on 4xx; we inspect the error envelope manually.
      validateStatus: (int? status) => status != null && status < 500,
    );
  }

  String _normalize(String raw) {
    final String trimmed = raw.trim();
    final String withoutTrailingSlash = trimmed.endsWith('/')
        ? trimmed.substring(0, trimmed.length - 1)
        : trimmed;
    return withoutTrailingSlash;
  }
}
