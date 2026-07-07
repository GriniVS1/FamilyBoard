import 'package:dio/dio.dart';

import 'api_client.dart';

/// Result of `GET /api/mobile/identity` — unauthenticated, used to verify
/// that a candidate host is actually *this family's* wall before trusting
/// it (or before persisting it as the new `serverUrl`).
class IdentityResult {
  const IdentityResult({
    required this.installationId,
    this.familyName,
    this.appVersion,
  });

  final String installationId;
  final String? familyName;
  final String? appVersion;
}

/// Fetches `GET /api/mobile/identity`.
///
/// Called twice in the app's lifecycle: once right after pairing (to
/// persist the wall's stable identity for later verification) and
/// repeatedly during connection recovery (to confirm a rediscovered host —
/// alt URL or mDNS candidate — is the paired wall and not just some other
/// device answering on that port).
///
/// Uses a short default timeout: recovery probes several mDNS candidates in
/// sequence, and a dead host must not stall the whole scan for the default
/// 10s connect timeout used by ordinary API calls.
class IdentityService {
  IdentityService({
    ApiClientFactory? clientFactory,
    Duration? connectTimeout,
    Duration? receiveTimeout,
  })  : _clientFactory = clientFactory ?? const ApiClientFactory(),
        _connectTimeout = connectTimeout ?? const Duration(seconds: 3),
        _receiveTimeout = receiveTimeout ?? const Duration(seconds: 3);

  final ApiClientFactory _clientFactory;
  final Duration _connectTimeout;
  final Duration _receiveTimeout;

  /// Returns null on any network failure, non-200 response, or malformed
  /// body — callers treat a null result as "this is not the wall" rather
  /// than surfacing a separate error.
  Future<IdentityResult?> fetch(String baseUrl) async {
    final Dio dio = _clientFactory.unauthenticated(
      baseUrl,
      connectTimeout: _connectTimeout,
      receiveTimeout: _receiveTimeout,
    );
    final Response<Object?> response;
    try {
      response = await dio.get<Object?>('/api/mobile/identity');
    } on DioException {
      return null;
    }
    if ((response.statusCode ?? 0) != 200) {
      return null;
    }
    return _parse(response.data);
  }

  /// Accepts both the project's usual `{ data: { installationId, ... } }`
  /// `ok()` envelope and a flat `{ installationId, ... }` object.
  IdentityResult? _parse(Object? body) {
    if (body is! Map) {
      return null;
    }
    final Map<String, Object?> map =
        (body as Map<Object?, Object?>).cast<String, Object?>();
    final Object? nested = map['data'];
    final Map<String, Object?> payload = nested is Map
        ? (nested as Map<Object?, Object?>).cast<String, Object?>()
        : map;
    final Object? idRaw = payload['installationId'];
    if (idRaw is! String || idRaw.isEmpty) {
      return null;
    }
    final Object? familyNameRaw = payload['familyName'];
    final Object? appVersionRaw = payload['appVersion'];
    return IdentityResult(
      installationId: idRaw,
      familyName: familyNameRaw is String ? familyNameRaw : null,
      appVersion: appVersionRaw is String ? appVersionRaw : null,
    );
  }
}
