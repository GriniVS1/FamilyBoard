import 'package:dio/dio.dart';

import '../models/family_member.dart';
import '../models/geocode_result.dart';
import '../models/setup_member_draft.dart';
import '../models/setup_status.dart';
import 'api_client.dart';

enum SetupErrorKind {
  network,
  alreadyComplete,
  invalidPin,
  tooManyAttempts,
  notFound,
  validation,
  unknown,
}

class SetupException implements Exception {
  const SetupException(this.kind);

  final SetupErrorKind kind;

  @override
  String toString() => 'SetupException($kind)';
}

/// Result of `POST /api/settings/pair-code` — a short-lived pairing code plus
/// the same LAN/mDNS/relay URLs the normal Settings-screen QR carries, so the
/// final onboarding step can hand off to the existing [PairService] instead
/// of re-implementing `POST /api/devices/pair`.
class PairCodeResult {
  const PairCodeResult({
    required this.code,
    required this.serverUrl,
    this.mdnsUrl,
    this.remoteUrl,
  });

  final String code;
  final String serverUrl;
  final String? mdnsUrl;
  final String? remoteUrl;
}

/// Talks to the wall's unauthenticated `/api/setup/*` mutation routes (plus
/// `/api/geocode` and `/api/settings/pair-code`) during app-first onboarding —
/// there is no paired [Session] yet, so every call here goes through
/// [ApiClientFactory.unauthenticated] pointed at the setup base URL the
/// `familyboard://setup` QR carried (verified via `GET /api/mobile/identity`
/// before any of this is called — see `SetupOnboardingController.start`).
class SetupService {
  SetupService({ApiClientFactory? clientFactory})
      : _clientFactory = clientFactory ?? const ApiClientFactory();

  final ApiClientFactory _clientFactory;

  Future<SetupStatus> fetchStatus(String baseUrl) async {
    final Response<Object?> response = await _get(baseUrl, '/api/setup/status');
    _guard(response);
    return SetupStatus.fromJson(_map(response));
  }

  Future<void> createFamily(String baseUrl, String name) async {
    final Response<Object?> response = await _post(
      baseUrl,
      '/api/setup/family',
      <String, Object?>{'name': name},
    );
    _guard(response);
  }

  Future<List<FamilyMember>> createMembers(
    String baseUrl,
    List<SetupMemberDraft> members,
  ) async {
    final Response<Object?> response = await _post(
      baseUrl,
      '/api/setup/members',
      <String, Object?>{'members': buildMembersPayload(members)},
    );
    _guard(response);
    return _memberList(response);
  }

  /// `GET /api/setup/members` — unauthenticated, only answers pre-pairing
  /// (see the route's guard). Used to populate the "who are you?" member
  /// picker in the final onboarding step.
  Future<List<FamilyMember>> fetchMembers(String baseUrl) async {
    final Response<Object?> response =
        await _get(baseUrl, '/api/setup/members');
    _guard(response);
    return _memberList(response);
  }

  Future<void> setPin(String baseUrl, String pin) async {
    final Response<Object?> response = await _post(
      baseUrl,
      '/api/setup/pin',
      <String, Object?>{'pin': pin},
    );
    _guard(response);
  }

  Future<void> setWeather(
    String baseUrl, {
    required double lat,
    required double lon,
    required String label,
  }) async {
    final Response<Object?> response = await _post(
      baseUrl,
      '/api/setup/weather',
      <String, Object?>{'lat': lat, 'lon': lon, 'label': label},
    );
    _guard(response);
  }

  /// `GET /api/geocode` — the wall's own Open-Meteo proxy, unauthenticated.
  Future<List<GeocodeResult>> geocode(
      String baseUrl, String query, String lang) async {
    final Dio dio = _clientFactory.unauthenticated(baseUrl);
    final Response<Object?> response;
    try {
      response = await dio.get<Object?>(
        '/api/geocode',
        queryParameters: <String, Object?>{'q': query, 'lang': lang},
      );
    } on DioException {
      throw const SetupException(SetupErrorKind.network);
    }
    _guard(response);
    final Object? results = _map(response)['results'];
    if (results is! List) {
      return const <GeocodeResult>[];
    }
    return results
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            GeocodeResult.fromJson(m.cast<String, Object?>()))
        .toList();
  }

  Future<PairCodeResult> requestPairCode(
    String baseUrl, {
    required String memberId,
    required String pin,
  }) async {
    final Response<Object?> response = await _post(
      baseUrl,
      '/api/settings/pair-code',
      <String, Object?>{'memberId': memberId, 'pin': pin},
    );
    _guard(response);
    final Map<String, Object?> map = _map(response);
    return PairCodeResult(
      code: map['code']! as String,
      serverUrl: map['serverUrl']! as String,
      mdnsUrl: map['mdnsUrl'] is String ? map['mdnsUrl'] as String : null,
      remoteUrl: map['remoteUrl'] is String ? map['remoteUrl'] as String : null,
    );
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  Future<Response<Object?>> _get(String baseUrl, String path) async {
    final Dio dio = _clientFactory.unauthenticated(baseUrl);
    try {
      return await dio.get<Object?>(path);
    } on DioException {
      throw const SetupException(SetupErrorKind.network);
    }
  }

  Future<Response<Object?>> _post(
    String baseUrl,
    String path,
    Map<String, Object?> body,
  ) async {
    final Dio dio = _clientFactory.unauthenticated(baseUrl);
    try {
      return await dio.post<Object?>(path, data: body);
    } on DioException {
      throw const SetupException(SetupErrorKind.network);
    }
  }

  void _guard(Response<Object?> response) {
    final int status = response.statusCode ?? 0;
    if (status == 200 || status == 201) {
      return;
    }
    final String? code = _errorCode(response.data);
    if (status == 403 || code == 'SETUP_ALREADY_COMPLETE') {
      throw const SetupException(SetupErrorKind.alreadyComplete);
    }
    if (status == 401 || code == 'INVALID_PIN') {
      throw const SetupException(SetupErrorKind.invalidPin);
    }
    if (status == 429 || code == 'TOO_MANY_ATTEMPTS') {
      throw const SetupException(SetupErrorKind.tooManyAttempts);
    }
    if (status == 404) {
      throw const SetupException(SetupErrorKind.notFound);
    }
    if (code == 'VALIDATION_ERROR') {
      throw const SetupException(SetupErrorKind.validation);
    }
    throw const SetupException(SetupErrorKind.unknown);
  }

  String? _errorCode(Object? body) {
    if (body is! Map) {
      return null;
    }
    final Object? error = (body as Map<Object?, Object?>)['error'];
    if (error is! Map) {
      return null;
    }
    final Object? code = (error as Map<Object?, Object?>)['code'];
    return code is String ? code : null;
  }

  Map<String, Object?> _map(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! Map) {
      throw const SetupException(SetupErrorKind.unknown);
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }

  List<FamilyMember> _memberList(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! List) {
      throw const SetupException(SetupErrorKind.unknown);
    }
    return data
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            FamilyMember.fromJson(m.cast<String, Object?>()))
        .toList();
  }
}
