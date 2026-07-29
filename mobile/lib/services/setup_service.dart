import 'package:dio/dio.dart';

import '../models/family_member.dart';
import '../models/geocode_result.dart';
import '../models/session.dart';
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

/// Parsed `session` payload from `POST /api/setup/pin` (only present when the
/// request included `device` — see [SetupService.setPin]). Deliberately
/// narrower than [Session]: it carries only what the wall's response knows
/// about (`token`/`deviceId`/`member`/`family`/`remoteUrl`), not the
/// caller-side fields (`serverUrl`/`altUrl`/`installationId`) the onboarding
/// controller already holds and must merge in itself, mirroring how
/// `PairService.pair` builds its `Session`. `remoteUrl` comes straight from
/// the wall (`connectedRemoteUrl()` in `src/app/api/setup/pin/route.ts`) — it
/// is null only when the relay tunnel wasn't up yet at setup time, not a
/// controller-side placeholder.
class SetupPinSession {
  const SetupPinSession({
    required this.token,
    required this.deviceId,
    required this.member,
    required this.family,
    this.remoteUrl,
  });

  /// Parses the `session` object nested in `POST /api/setup/pin`'s response
  /// (not the whole response body).
  factory SetupPinSession.fromJson(Map<String, Object?> json) {
    final Object? remoteUrlRaw = json['remoteUrl'];
    return SetupPinSession(
      token: json['token']! as String,
      deviceId: json['deviceId']! as String,
      member: Member.fromJson(
        (json['member']! as Map<Object?, Object?>).cast<String, Object?>(),
      ),
      family: Family.fromJson(
        (json['family']! as Map<Object?, Object?>).cast<String, Object?>(),
      ),
      remoteUrl: remoteUrlRaw is String && remoteUrlRaw.isNotEmpty
          ? remoteUrlRaw
          : null,
    );
  }

  final String token;
  final String deviceId;
  final Member member;
  final Family family;
  final String? remoteUrl;
}

/// Talks to the wall's unauthenticated `/api/setup/*` mutation routes (plus
/// `/api/geocode`) during app-first onboarding — there is no paired [Session]
/// yet, so every call here goes through [ApiClientFactory.unauthenticated]
/// pointed at the setup base URL the `familyboard://setup` QR carried
/// (verified via `GET /api/mobile/identity` before any of this is called —
/// see `SetupOnboardingController.start`).
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

  /// `POST /api/setup/pin` — always sends `device`, so the app-first wizard
  /// finishes onboarding already paired to the admin member (see the route's
  /// doc comment on `src/app/api/setup/pin/route.ts`). The on-wall wizard has
  /// no mobile equivalent of this call.
  Future<SetupPinSession> setPin(
    String baseUrl,
    String pin, {
    required String deviceName,
    required String devicePlatform,
  }) async {
    final Response<Object?> response = await _post(
      baseUrl,
      '/api/setup/pin',
      <String, Object?>{
        'pin': pin,
        'device': <String, Object?>{
          'name': deviceName,
          'platform': devicePlatform,
        },
      },
    );
    _guard(response);
    final Object? sessionRaw = _map(response)['session'];
    if (sessionRaw is! Map) {
      throw const SetupException(SetupErrorKind.unknown);
    }
    return SetupPinSession.fromJson(
      (sessionRaw as Map<Object?, Object?>).cast<String, Object?>(),
    );
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
    String baseUrl,
    String query,
    String lang,
  ) async {
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
        .map(
          (Map<Object?, Object?> m) =>
              GeocodeResult.fromJson(m.cast<String, Object?>()),
        )
        .toList();
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
        .map(
          (Map<Object?, Object?> m) =>
              FamilyMember.fromJson(m.cast<String, Object?>()),
        )
        .toList();
  }
}
